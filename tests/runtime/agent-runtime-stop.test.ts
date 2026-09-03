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

  it("returns promptly when in-flight tasks finish early rather than waiting for full drain timeout", async () => {
    runtime.registerTool({
      name: "quick-task",
      description: "Quick task",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 25));
        return { done: true };
      }
    });

    await runtime.start();

    const taskPromise = runtime.executeTask({
      taskId: "task-quick-1",
      agentId: "agent-1",
      toolName: "quick-task",
      input: "run",
      payload: {}
    });

    expect(runtime.getInFlightTaskCount()).toBe(1);

    const stopStart = Date.now();
    // Large drainTimeoutMs (1500ms), but task finishes in ~25ms
    await runtime.stop({ drainTimeoutMs: 1500 });
    const elapsed = Date.now() - stopStart;

    // Must return promptly (well under the 1500ms timeout)
    expect(elapsed).toBeLessThan(400);
    expect(runtime.getInFlightTaskCount()).toBe(0);
    await expect(taskPromise).resolves.toBeDefined();
  });

  it("leaves stop unblocked when tasks exceed drainTimeoutMs and preserves in-flight count", async () => {
    let unblockTool!: () => void;
    runtime.registerTool({
      name: "slow-task",
      description: "Slow task that exceeds drain timeout",
      execute: async () => {
        await new Promise<void>((r) => {
          unblockTool = r;
        });
        return { done: true };
      }
    });

    await runtime.start();

    const taskPromise = runtime.executeTask({
      taskId: "task-slow-1",
      agentId: "agent-1",
      toolName: "slow-task",
      input: "run",
      payload: {}
    });

    expect(runtime.getInFlightTaskCount()).toBe(1);

    const stopStart = Date.now();
    // Short drain timeout of 50ms
    await runtime.stop({ drainTimeoutMs: 50 });
    const elapsed = Date.now() - stopStart;

    // stop() unblocks around 50ms without waiting indefinitely
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(elapsed).toBeLessThan(350);

    // Runtime is stopped, but task is still in flight (stranded)
    expect(runtime.isRunning()).toBe(false);
    expect(runtime.getInFlightTaskCount()).toBe(1);

    // Clean up stranded task
    unblockTool();
    await taskPromise;
    expect(runtime.getInFlightTaskCount()).toBe(0);
  });
});
