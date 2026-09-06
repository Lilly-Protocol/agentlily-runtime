import { describe, expect, it } from "vitest";
import { AgentRuntime, RuntimeEventBus } from "../../src/index.js";

describe("AgentRuntime task timeout", () => {
  it("fails a hung task, clears in-flight state, and emits runtime.task.failed", async () => {
    const eventBus = new RuntimeEventBus();
    const failures: Array<{ taskId: string; reason: string }> = [];

    eventBus.on("runtime.task.failed", (event) => {
      failures.push({
        taskId: event.payload.taskId,
        reason: event.payload.reason
      });
    });

    const runtime = new AgentRuntime({
      runtimeId: "runtime-task-timeout",
      eventBus,
      maxTaskDurationMs: 10
    });
    runtime.registerTool({
      name: "hang",
      description: "Never resolves.",
      execute() {
        return new Promise<never>(() => {});
      }
    });

    await runtime.start();

    await expect(
      runtime.executeTask({
        taskId: "task-timeout",
        agentId: "agent-timeout",
        toolName: "hang",
        input: "Wait forever",
        payload: {}
      })
    ).rejects.toMatchObject({
      code: "EXECUTION_FAILED",
      details: { timeoutMs: 10 }
    });

    expect(runtime.getInFlightTaskCount()).toBe(0);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.taskId).toBe("task-timeout");
    expect(failures[0]?.reason).toContain("timed out after 10ms");
  });
});
