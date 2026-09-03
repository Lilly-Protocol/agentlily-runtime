import { describe, it, expect, vi, beforeEach } from "vitest";
import { InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import type { RuntimeOptions } from "../../src/runtime/types.js";

describe("AgentRuntime.stop", () => {
  let runtime: AgentRuntime;
  let emitSpy: ReturnType<typeof vi.fn>;
  let logger: InMemoryRuntimeLogger;

  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  function taskInput(taskId: string) {
    return {
      taskId,
      agentId: "agent-1",
      toolName: "blocked",
      input: "test",
      payload: {}
    };
  }

  function registerBlockedTask() {
    const started = deferred();
    const release = deferred();

    runtime.registerTool({
      name: "blocked",
      description: "Waits until released",
      execute: async () => {
        started.resolve();
        await release.promise;
        return { done: true };
      }
    });

    return { started, release };
  }

  beforeEach(() => {
    logger = new InMemoryRuntimeLogger();
    const options: RuntimeOptions = {
      runtimeId: "test-runtime-stop",
      logger
    };
    runtime = new AgentRuntime(options);
    emitSpy = vi.fn();
    // Replace eventBus.emit with spy to capture events
    (runtime as any).dependencies.eventBus.emit = emitSpy;
  });

  it("emits runtime.stopped event when stop is called after start", async () => {
    await runtime.start();
    await runtime.stop();

    const stoppedEvent = emitSpy.mock.calls.find(
      (call) => call[0].name === "runtime.stopped"
    );
    expect(stoppedEvent).toBeDefined();
    expect(stoppedEvent![0].payload.runtimeId).toBe("test-runtime-stop");
    expect(stoppedEvent![0].payload.occurredAt).toBeDefined();
  });

  it("does not emit runtime.stopped if runtime was never started", async () => {
    await runtime.stop();

    const stoppedEvent = emitSpy.mock.calls.find(
      (call) => call[0].name === "runtime.stopped"
    );
    expect(stoppedEvent).toBeUndefined();
  });

  it("does not emit runtime.stopped twice on consecutive stop calls", async () => {
    await runtime.start();
    await runtime.stop();
    await runtime.stop();

    const stoppedEvents = emitSpy.mock.calls.filter(
      (call) => call[0].name === "runtime.stopped"
    );
    expect(stoppedEvents.length).toBe(1);
  });

  it("warns once when the drain timeout expires with a task in flight", async () => {
    const { started, release } = registerBlockedTask();

    await runtime.start();
    const taskPromise = runtime.executeTask(taskInput("task-timeout"));
    await started.promise;

    await runtime.stop({ drainTimeoutMs: 15 });
    await runtime.stop({ drainTimeoutMs: 15 });

    const warnings = logger.entries.filter((entry) => entry.level === "warn");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain("task-timeout");
    expect(warnings[0]?.metadata).toMatchObject({
      runtimeId: "test-runtime-stop",
      taskIds: ["task-timeout"],
      inFlightTaskCount: 1,
      drainTimeoutMs: 15,
      drainElapsedMs: expect.any(Number)
    });

    release.resolve();
    await taskPromise;
  });

  it("does not warn when all tasks drain before the timeout", async () => {
    const { started, release } = registerBlockedTask();

    await runtime.start();
    const taskPromise = runtime.executeTask(taskInput("task-drained"));
    await started.promise;
    release.resolve();

    await runtime.stop({ drainTimeoutMs: 50 });
    await taskPromise;

    expect(
      logger.entries.filter((entry) => entry.level === "warn")
    ).toHaveLength(0);
    expect(runtime.getInFlightTaskCount()).toBe(0);
  });

  it.each([undefined, 0])(
    "does not warn when drainTimeoutMs is %s",
    async (drainTimeoutMs) => {
      const { started, release } = registerBlockedTask();

      await runtime.start();
      const taskPromise = runtime.executeTask(taskInput("task-no-timeout"));
      await started.promise;

      const options = drainTimeoutMs === undefined ? {} : { drainTimeoutMs };
      await runtime.stop(options);

      expect(
        logger.entries.filter((entry) => entry.level === "warn")
      ).toHaveLength(0);
      expect(runtime.getInFlightTaskCount()).toBe(1);

      release.resolve();
      await taskPromise;
      expect(runtime.getInFlightTaskCount()).toBe(0);
    }
  );
});
