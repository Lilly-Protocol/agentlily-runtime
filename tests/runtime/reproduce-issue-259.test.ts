import { describe, it, expect, vi } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";

describe("Issue #259 Reproduction — Await in-flight task promises in AgentRuntime.stop() instead of busy-polling", () => {
  it("does not use sleep-based busy-polling loop during task draining when tasks complete", async () => {
    const runtime = new AgentRuntime({
      runtimeId: "rt-reproduce-polling",
      logger: {
        level: "error",
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    });

    const sleepSpy = vi.spyOn(runtime as any, "sleep");

    runtime.registerTool({
      name: "delayed-work",
      description: "Work that completes after a brief delay",
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { completed: true };
      }
    });

    await runtime.start();

    const taskPromise = runtime.executeTask({
      taskId: "task-polling-1",
      agentId: "agent-1",
      toolName: "delayed-work",
      input: "run delayed work",
      payload: {}
    });

    await runtime.stop({ drainTimeoutMs: 1000 });
    await taskPromise;

    // Issue #259: drainInFlightTasks in current implementation uses a busy-wait loop:
    // while (this.inFlightTasks.size > 0) { await this.sleep(Math.min(5, remaining)); }
    // When tasks are in-flight, sleep(5) is invoked repeatedly every 5ms.
    // The expected behavior is event-driven draining that awaits task promises directly
    // without executing a sleep-polling loop.
    const shortSleepPolls = sleepSpy.mock.calls.filter(
      ([ms]) => typeof ms === "number" && ms <= 5
    );
    expect(shortSleepPolls).toHaveLength(0);
    expect(sleepSpy).not.toHaveBeenCalledWith(5);
  });

  it("awaits in-flight task promises directly and unblocks immediately upon task completion", async () => {
    const runtime = new AgentRuntime({
      runtimeId: "rt-reproduce-promise-await",
      logger: {
        level: "error",
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    });

    let resolveTask!: (value: unknown) => void;
    const taskExecutionPromise = new Promise((resolve) => {
      resolveTask = resolve;
    });

    runtime.registerTool({
      name: "controlled-task",
      description: "Task controlled by external promise resolution",
      execute: () => taskExecutionPromise
    });

    await runtime.start();

    const taskPromise = runtime.executeTask({
      taskId: "task-controlled-1",
      agentId: "agent-1",
      toolName: "controlled-task",
      input: "run controlled task",
      payload: {}
    });

    // Interface Contract from PROJECT.md:
    // Runtime must track in-flight task promises (inFlightPromises: Map<string, Promise<unknown>>)
    // so stop() can await them directly via Promise.allSettled instead of polling a Set of strings.
    const inFlightPromises = (runtime as any).inFlightPromises;
    expect(inFlightPromises).toBeDefined();
    expect(
      inFlightPromises instanceof Map || inFlightPromises instanceof Set
    ).toBe(true);
    expect(inFlightPromises.size).toBe(1);

    let stopSettled = false;
    const stopPromise = runtime.stop({ drainTimeoutMs: 5000 }).then(() => {
      stopSettled = true;
    });

    // Flush immediate microtasks
    await new Promise((resolve) => setTimeout(resolve, 20));

    // While task execution promise is pending, stop should remain in-flight
    expect(stopSettled).toBe(false);
    expect(runtime.getInFlightTaskCount()).toBe(1);

    // Resolve task execution promise directly
    resolveTask({ status: "success" });

    await taskPromise;
    await stopPromise;

    expect(stopSettled).toBe(true);
    expect(runtime.getInFlightTaskCount()).toBe(0);
    expect((runtime as any).inFlightPromises.size).toBe(0);
  });

  it("tracks multiple concurrent in-flight task promises and drains without busy-polling", async () => {
    const runtime = new AgentRuntime({
      runtimeId: "rt-reproduce-concurrent",
      logger: {
        level: "error",
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    });

    const sleepSpy = vi.spyOn(runtime as any, "sleep");

    runtime.registerTool<{ delayMs: number }, { delayed: number }>({
      name: "variable-delay",
      description: "Task taking variable delay",
      execute: async ({ payload }) => {
        await new Promise((resolve) => setTimeout(resolve, payload.delayMs));
        return { delayed: payload.delayMs };
      }
    });

    await runtime.start();

    const task1 = runtime.executeTask<{ delayMs: number }, { delayed: number }>(
      {
        taskId: "task-concurrent-1",
        agentId: "agent-1",
        toolName: "variable-delay",
        input: "delay 15",
        payload: { delayMs: 15 }
      }
    );

    const task2 = runtime.executeTask<{ delayMs: number }, { delayed: number }>(
      {
        taskId: "task-concurrent-2",
        agentId: "agent-2",
        toolName: "variable-delay",
        input: "delay 35",
        payload: { delayMs: 35 }
      }
    );

    // Verify task promises are tracked concurrently
    const inFlightPromises = (runtime as any).inFlightPromises;
    expect(inFlightPromises).toBeDefined();
    expect(inFlightPromises.size).toBe(2);

    await runtime.stop({ drainTimeoutMs: 2000 });
    await Promise.all([task1, task2]);

    const shortSleepPolls = sleepSpy.mock.calls.filter(
      ([ms]) => typeof ms === "number" && ms <= 5
    );
    expect(shortSleepPolls).toHaveLength(0);
    expect(sleepSpy).not.toHaveBeenCalledWith(5);
    expect((runtime as any).inFlightPromises.size).toBe(0);
  });
});
