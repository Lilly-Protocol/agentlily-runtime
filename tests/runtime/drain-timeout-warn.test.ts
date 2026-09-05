import { describe, expect, it } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import { InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("AgentRuntime.stop stranded task timeout warning (#258)", () => {
  it("records a warn entry with stranded task ID(s) and elapsed time when tasks exceed drainTimeoutMs", async () => {
    const logger = new InMemoryRuntimeLogger();
    const runtime = new AgentRuntime({
      runtimeId: "rt-warn-stranded",
      logger
    });

    runtime.registerTool({
      name: "longBlockingTool",
      description: "Blocks execution past drain timeout",
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        return { ok: true };
      }
    });

    await runtime.start();

    // Start in-flight task
    const taskPromise = runtime.executeTask({
      taskId: "stranded-task-abc",
      agentId: "agent-warn-1",
      toolName: "longBlockingTool",
      input: "do long work",
      payload: {}
    });

    expect(runtime.getInFlightTaskCount()).toBe(1);

    // Stop with short drain timeout
    await runtime.stop({ drainTimeoutMs: 50 });

    expect(runtime.isRunning()).toBe(false);

    // Check warn-level entries
    const warnEntries = logger.entries.filter((entry) => entry.level === "warn");
    expect(warnEntries.length).toBeGreaterThanOrEqual(1);

    const strandedWarn = warnEntries.find((entry) =>
      entry.message.includes("Tasks still in flight after drain timeout")
    );
    expect(strandedWarn).toBeDefined();

    // Assert that the stranded task ID is present in both message and metadata
    expect(strandedWarn?.message).toContain("stranded-task-abc");
    expect(strandedWarn?.metadata).toMatchObject({
      runtimeId: "rt-warn-stranded",
      inFlightTasks: ["stranded-task-abc"],
      strandedTasks: ["stranded-task-abc"]
    });
    expect(typeof strandedWarn?.metadata?.elapsedDrainMs).toBe("number");
    expect((strandedWarn?.metadata?.elapsedDrainMs as number)).toBeGreaterThanOrEqual(40);

    // Cleanup promise
    await taskPromise;
  });

  it("does not log any warning when drainTimeoutMs is omitted", async () => {
    const logger = new InMemoryRuntimeLogger();
    const runtime = new AgentRuntime({
      runtimeId: "rt-no-timeout-warn",
      logger
    });

    runtime.registerTool({
      name: "fastTool",
      description: "Fast tool",
      execute: async () => ({ ok: true })
    });

    await runtime.start();
    await runtime.stop(); // drainTimeoutMs omitted

    const warnEntries = logger.entries.filter((entry) => entry.level === "warn");
    expect(warnEntries.length).toBe(0);
  });

  it("does not log any warning when all tasks finish before drainTimeoutMs expires", async () => {
    const logger = new InMemoryRuntimeLogger();
    const runtime = new AgentRuntime({
      runtimeId: "rt-clean-drain",
      logger
    });

    runtime.registerTool({
      name: "quickWork",
      description: "Completes quickly",
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { done: true };
      }
    });

    await runtime.start();

    const taskPromise = runtime.executeTask({
      taskId: "quick-task-1",
      agentId: "agent-quick",
      toolName: "quickWork",
      input: "quick",
      payload: {}
    });

    await runtime.stop({ drainTimeoutMs: 200 });

    const result = await taskPromise;
    expect(result.output).toEqual({ done: true });

    const warnEntries = logger.entries.filter((entry) => entry.level === "warn");
    expect(warnEntries.length).toBe(0);
  });

  it("does not log any warning when stop is called with drainTimeoutMs but no tasks were started", async () => {
    const logger = new InMemoryRuntimeLogger();
    const runtime = new AgentRuntime({
      runtimeId: "rt-zero-tasks",
      logger
    });

    await runtime.start();
    await runtime.stop({ drainTimeoutMs: 100 });

    const warnEntries = logger.entries.filter((entry) => entry.level === "warn");
    expect(warnEntries.length).toBe(0);
  });
});
