import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import type { RuntimeOptions } from "../../src/runtime/types.js";

describe("AgentRuntime.stop", () => {
  let runtime: AgentRuntime;
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const options: RuntimeOptions = {
      runtimeId: "test-runtime-stop",
      logger: {
        level: "error",
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
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

  it("warns when stop drain times out with tasks still in flight", async () => {
    const { InMemoryRuntimeLogger } = await import(
      "../../src/logger/runtime-logger.js"
    );
    const logger = new InMemoryRuntimeLogger({ level: "debug" });
    const rt = new AgentRuntime({
      runtimeId: "rt-warn-stranded",
      logger
    });

    let releaseTask!: () => void;
    rt.registerTool({
      name: "long-task",
      description: "Long running task",
      execute: async () => {
        await new Promise<void>((resolve) => {
          releaseTask = resolve;
        });
        return { done: true };
      }
    });

    await rt.start();

    const taskPromise = rt.executeTask({
      taskId: "stranded-task-99",
      agentId: "agent-1",
      toolName: "long-task",
      input: "do work",
      payload: {}
    });

    expect(rt.getInFlightTaskCount()).toBe(1);

    // Stop with drain timeout of 30ms (task will still be in flight)
    await rt.stop({ drainTimeoutMs: 30 });

    const warnEntries = logger.entries.filter((e) => e.level === "warn");
    expect(warnEntries.length).toBe(1);
    expect(warnEntries[0]?.message).toContain("stranded-task-99");
    expect(warnEntries[0]?.metadata).toMatchObject({
      runtimeId: "rt-warn-stranded",
      strandedTaskIds: ["stranded-task-99"],
      drainTimeoutMs: 30
    });

    // Clean up stranded task
    releaseTask();
    await taskPromise;
  });

  it("does not log warning when drainTimeoutMs is omitted or tasks finish before timeout", async () => {
    const { InMemoryRuntimeLogger } = await import(
      "../../src/logger/runtime-logger.js"
    );
    const logger = new InMemoryRuntimeLogger({ level: "debug" });
    const rt = new AgentRuntime({
      runtimeId: "rt-clean-drain",
      logger
    });

    rt.registerTool({
      name: "fast-task",
      description: "Fast task",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { done: true };
      }
    });

    await rt.start();

    const taskPromise = rt.executeTask({
      taskId: "fast-task-1",
      agentId: "agent-1",
      toolName: "fast-task",
      input: "fast work",
      payload: {}
    });

    // Graceful drain completes within 200ms
    await rt.stop({ drainTimeoutMs: 200 });
    await taskPromise;

    // No warning should be logged because task finished before deadline
    const warnEntries = logger.entries.filter((e) => e.level === "warn");
    expect(warnEntries.length).toBe(0);
  });
});
