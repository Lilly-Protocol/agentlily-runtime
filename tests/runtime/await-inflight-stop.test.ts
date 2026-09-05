import { describe, expect, it } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import { InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("AgentRuntime.stop in-flight task promise awaiting (#259)", () => {
  it("returns promptly when in-flight tasks finish early instead of waiting for the full drainTimeoutMs", async () => {
    const logger = new InMemoryRuntimeLogger();
    const runtime = new AgentRuntime({
      runtimeId: "rt-drain-prompt",
      logger
    });

    runtime.registerTool({
      name: "fastWork",
      description: "Quick async work",
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { completed: true };
      }
    });

    await runtime.start();
    expect(runtime.isRunning()).toBe(true);

    const taskPromise = runtime.executeTask({
      taskId: "task-fast-1",
      agentId: "agent-1",
      toolName: "fastWork",
      input: "do work",
      payload: {}
    });

    expect(runtime.getInFlightTaskCount()).toBe(1);

    const startTime = Date.now();
    // Configure a large drain timeout of 2500ms
    await runtime.stop({ drainTimeoutMs: 2500 });
    const elapsed = Date.now() - startTime;

    // Must return promptly as soon as the 30ms task finishes, well below the 2500ms deadline
    expect(elapsed).toBeLessThan(500);

    const result = await taskPromise;
    expect(result.output).toEqual({ completed: true });
    expect(runtime.isRunning()).toBe(false);
    expect(runtime.getInFlightTaskCount()).toBe(0);

    // No warning should be logged because work finished within the timeout
    const warnings = logger.entries.filter((entry) => entry.level === "warn");
    expect(warnings.length).toBe(0);
  });

  it("leaves stop() unblocked when in-flight tasks exceed drainTimeoutMs and logs stranded state", async () => {
    const logger = new InMemoryRuntimeLogger();
    const runtime = new AgentRuntime({
      runtimeId: "rt-drain-timeout",
      logger
    });

    runtime.registerTool({
      name: "slowWork",
      description: "Slow blocking work exceeding timeout",
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { completed: true };
      }
    });

    await runtime.start();

    // Launch task that will outlive the 60ms drain timeout
    const taskPromise = runtime.executeTask({
      taskId: "task-slow-1",
      agentId: "agent-1",
      toolName: "slowWork",
      input: "slow",
      payload: {}
    });

    expect(runtime.getInFlightTaskCount()).toBe(1);

    const startTime = Date.now();
    await runtime.stop({ drainTimeoutMs: 60 });
    const elapsed = Date.now() - startTime;

    // stop() unblocks around ~60ms without waiting for the 1000ms task
    expect(elapsed).toBeLessThan(300);
    expect(runtime.isRunning()).toBe(false);

    // Assert that stranded task state is logged as a warning
    const warnings = logger.entries.filter((entry) => entry.level === "warn");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    const strandedWarning = warnings.find((entry) =>
      entry.message.includes("Tasks still in flight after drain timeout")
    );
    expect(strandedWarning).toBeDefined();
    expect(strandedWarning?.metadata).toMatchObject({
      runtimeId: "rt-drain-timeout",
      inFlightTaskCount: 1,
      inFlightTasks: ["task-slow-1"]
    });

    // Cleanup lingering task promise
    await taskPromise;
  });

  it("returns immediately without warnings when stop() is called with no in-flight tasks", async () => {
    const logger = new InMemoryRuntimeLogger();
    const runtime = new AgentRuntime({
      runtimeId: "rt-empty-drain",
      logger
    });

    await runtime.start();

    const startTime = Date.now();
    await runtime.stop({ drainTimeoutMs: 2000 });
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(50);
    expect(runtime.isRunning()).toBe(false);
    expect(runtime.getInFlightTaskCount()).toBe(0);

    const warnings = logger.entries.filter((entry) => entry.level === "warn");
    expect(warnings.length).toBe(0);
  });
});
