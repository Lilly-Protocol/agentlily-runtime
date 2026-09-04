import { describe, it, expect, vi } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";

describe("AgentRuntime.stop with RuntimeStopOptions (#233)", () => {
  it("honors clearListeners: true by emptying eventBus listeners", async () => {
    const runtime = new AgentRuntime({
      runtimeId: "rt-clear-test",
      logger: {
        level: "error",
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    });

    const listener = vi.fn();
    runtime.getDependencies().eventBus.on("runtime.started", listener);

    await runtime.start();
    expect(listener).toHaveBeenCalledTimes(1);

    await runtime.stop({ clearListeners: true });

    // Subsequent emit on eventBus should have no listeners
    runtime.getDependencies().eventBus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-clear-test", occurredAt: new Date().toISOString() }
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(runtime.getDependencies().eventBus.listenerCount()).toBe(0);
  });

  it("honors drainTimeoutMs by waiting for in-flight tasks or timing out without hanging", async () => {
    const runtime = new AgentRuntime({
      runtimeId: "rt-drain-opt-test",
      logger: {
        level: "error",
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    });

    runtime.registerTool({
      name: "slowTool",
      description: "Delays execution",
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { ok: true };
      }
    });

    await runtime.start();

    const taskPromise = runtime.executeTask({
      taskId: "task-slow-1",
      agentId: "agent-1",
      toolName: "slowTool",
      input: "execute slow task",
      payload: {}
    });

    expect(runtime.getInFlightTaskCount()).toBe(1);

    await runtime.stop({ drainTimeoutMs: 150 });

    const result = await taskPromise;
    expect(result.output).toEqual({ ok: true });
    expect(runtime.getInFlightTaskCount()).toBe(0);
  });

  it("times out cleanly when in-flight task exceeds drainTimeoutMs", async () => {
    const runtime = new AgentRuntime({
      runtimeId: "rt-drain-timeout-test",
      logger: {
        level: "error",
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    });

    let resolveSlowTask!: () => void;
    runtime.registerTool({
      name: "verySlowTool",
      description: "Hangs until manual resolve",
      execute: async () => {
        await new Promise<void>((resolve) => {
          resolveSlowTask = resolve;
        });
        return { ok: true };
      }
    });

    await runtime.start();

    const taskPromise = runtime.executeTask({
      taskId: "task-very-slow",
      agentId: "agent-1",
      toolName: "verySlowTool",
      input: "hang task",
      payload: {}
    });

    expect(runtime.getInFlightTaskCount()).toBe(1);

    const startStop = Date.now();
    await runtime.stop({ drainTimeoutMs: 40 });
    const elapsed = Date.now() - startStop;

    expect(elapsed).toBeGreaterThanOrEqual(30);

    resolveSlowTask();
    await taskPromise;
    expect(runtime.getInFlightTaskCount()).toBe(0);
  });

  it("emits runtime.stopped only once across multiple stop calls with options", async () => {
    const runtime = new AgentRuntime({
      runtimeId: "rt-multi-stop",
      logger: {
        level: "error",
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    });

    let stopEventCount = 0;
    runtime.getDependencies().eventBus.on("runtime.stopped", () => {
      stopEventCount++;
    });

    await runtime.start();
    await runtime.stop({ clearListeners: false });
    await runtime.stop({ clearListeners: true });

    expect(stopEventCount).toBe(1);
  });
});
