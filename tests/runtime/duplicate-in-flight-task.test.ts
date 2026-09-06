import { describe, expect, it } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";

describe("AgentRuntime duplicate in-flight task IDs", () => {
  it("rejects a duplicate active task without emitting a failed lifecycle event", async () => {
    const runtime = new AgentRuntime({ runtimeId: "duplicate-id-runtime" });
    let release!: () => void;

    runtime.registerTool({
      name: "blocking",
      description: "waits for release",
      execute: async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { ok: true };
      }
    });

    const failedEvents: unknown[] = [];
    runtime.getDependencies().eventBus.on("runtime.task.failed", (event) => {
      failedEvents.push(event);
    });

    await runtime.start();
    const first = runtime.executeTask({
      taskId: "same-id",
      agentId: "agent-a",
      toolName: "blocking",
      input: "first",
      payload: {}
    });

    expect(runtime.getInFlightTaskCount()).toBe(1);

    await expect(
      runtime.executeTask({
        taskId: "same-id",
        agentId: "agent-b",
        toolName: "blocking",
        input: "duplicate",
        payload: {}
      })
    ).rejects.toMatchObject({
      code: "DUPLICATE_IN_FLIGHT_TASK",
      details: { taskId: "same-id" }
    });

    expect(runtime.getInFlightTaskCount()).toBe(1);
    expect(failedEvents).toHaveLength(0);

    release();
    await first;
    expect(runtime.getInFlightTaskCount()).toBe(0);
  });

  it("allows the same task ID again after the previous execution settles", async () => {
    const runtime = new AgentRuntime({ runtimeId: "task-id-reuse-runtime" });
    runtime.registerTool({
      name: "echo",
      description: "returns success",
      execute: async () => ({ ok: true })
    });

    await runtime.start();

    const task = {
      taskId: "reusable-id",
      agentId: "agent-a",
      toolName: "echo",
      input: "echo",
      payload: { value: 1 }
    };

    await expect(runtime.executeTask(task)).resolves.toBeDefined();
    await expect(runtime.executeTask(task)).resolves.toBeDefined();
    expect(runtime.getInFlightTaskCount()).toBe(0);
  });
});
