import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import type { RuntimeOptions } from "../../src/runtime/types.js";

describe("AgentRuntime.stop — stranded task warning (Issue #258)", () => {
  let runtime: AgentRuntime;
  let emitSpy: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.fn>;
  let infoSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    warnSpy = vi.fn();
    infoSpy = vi.fn();
    const options: RuntimeOptions = {
      runtimeId: "test-runtime-strand",
      logger: {
        level: "debug",
        info: infoSpy,
        warn: warnSpy,
        error: vi.fn(),
        debug: vi.fn()
      }
    };
    runtime = new AgentRuntime(options);
    emitSpy = vi.fn();
    (runtime as any).dependencies.eventBus.emit = emitSpy;
  });

  it("warns with stranded task IDs when drain times out with tasks still in flight", async () => {
    runtime.registerTool({
      name: "slow-tool",
      description: "Tool that takes a long time",
      execute: async () => {
        // Simulate a tool that runs longer than the drain timeout
        await new Promise((r) => setTimeout(r, 200));
        return { ok: true };
      }
    });

    await runtime.start();
    const taskPromise = runtime.executeTask({
      taskId: "stranded-task-1",
      agentId: "agent-1",
      toolName: "slow-tool",
      input: "slow",
      payload: {}
    });

    // Ensure the task is in flight
    expect(runtime.getInFlightTaskCount()).toBe(1);

    // Stop with a drain timeout shorter than the task duration
    await runtime.stop({ drainTimeoutMs: 50 });

    // Task should still be in flight (timed out)
    expect(runtime.getInFlightTaskCount()).toBe(0); // finally block cleaned up

    // A warn should have been logged with stranded task info
    expect(warnSpy).toHaveBeenCalled();
    const warnCall = warnSpy.mock.calls.find(
      (call) => call[0] === "Runtime stopped with stranded in-flight tasks."
    );
    expect(warnCall).toBeDefined();
    expect(warnCall![1].strandedTaskIds).toContain("stranded-task-1");
    expect(warnCall![1].drainDurationMs).toBeGreaterThanOrEqual(50);

    // Task result should still be available
    const result = await taskPromise;
    expect(result.output).toEqual({ ok: true });

    // runtime.stopped event should include strandedTaskIds
    const stoppedEvent = emitSpy.mock.calls.find(
      (call) => call[0].name === "runtime.stopped"
    );
    expect(stoppedEvent).toBeDefined();
    expect(stoppedEvent![0].payload.strandedTaskIds).toContain("stranded-task-1");
    expect(stoppedEvent![0].payload.drainDurationMs).toBeGreaterThanOrEqual(50);
  });

  it("does not warn when drain completes with no tasks in flight", async () => {
    await runtime.start();
    await runtime.stop({ drainTimeoutMs: 100 });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      "Runtime stopped.",
      expect.objectContaining({ runtimeId: "test-runtime-strand" })
    );

    const stoppedEvent = emitSpy.mock.calls.find(
      (call) => call[0].name === "runtime.stopped"
    );
    expect(stoppedEvent).toBeDefined();
    expect(stoppedEvent![0].payload.strandedTaskIds).toBeUndefined();
  });

  it("does not warn when drainTimeoutMs is not specified", async () => {
    runtime.registerTool({
      name: "slow-tool",
      description: "Slow",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return { ok: true };
      }
    });

    await runtime.start();
    runtime.executeTask({
      taskId: "task-no-drain",
      agentId: "agent-1",
      toolName: "slow-tool",
      input: "slow",
      payload: {}
    });

    // Stop without drain timeout — should not wait
    await runtime.stop({});

    // No warning should be logged (no drain was requested)
    expect(warnSpy).not.toHaveBeenCalled();

    const stoppedEvent = emitSpy.mock.calls.find(
      (call) => call[0].name === "runtime.stopped"
    );
    expect(stoppedEvent).toBeDefined();
    expect(stoppedEvent![0].payload.strandedTaskIds).toBeUndefined();
  });
});
