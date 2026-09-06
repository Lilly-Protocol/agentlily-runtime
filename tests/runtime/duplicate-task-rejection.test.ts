import { describe, it, expect } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import { RuntimeError } from "../../src/errors/runtime-errors.js";

describe("AgentRuntime duplicate in-flight task rejection", () => {
  it("rejects second executeTask call when identical taskId is already in flight", async () => {
    const runtime = new AgentRuntime({
      runtimeId: "rt-dupe-test"
    });

    let releaseTask!: () => void;
    runtime.registerTool({
      name: "blocking-tool",
      description: "Blocks until released",
      execute: async () => {
        await new Promise<void>((resolve) => {
          releaseTask = resolve;
        });
        return { success: true };
      }
    });

    await runtime.start();

    const failedEvents: unknown[] = [];
    runtime.getDependencies().eventBus.on("runtime.task.failed", (event) => {
      failedEvents.push(event);
    });

    // Launch task 1
    const task1Promise = runtime.executeTask({
      taskId: "unique-task-1",
      agentId: "agent-alpha",
      toolName: "blocking-tool",
      input: "run",
      payload: {}
    });

    expect(runtime.getInFlightTaskCount()).toBe(1);

    // Launch task 2 with identical taskId while task 1 is in flight
    await expect(
      runtime.executeTask({
        taskId: "unique-task-1",
        agentId: "agent-beta",
        toolName: "blocking-tool",
        input: "run concurrent duplicate",
        payload: {}
      })
    ).rejects.toThrowError(RuntimeError);

    await expect(
      runtime.executeTask({
        taskId: "unique-task-1",
        agentId: "agent-beta",
        toolName: "blocking-tool",
        input: "run concurrent duplicate",
        payload: {}
      })
    ).rejects.toMatchObject({
      name: "RuntimeError",
      code: "DUPLICATE_IN_FLIGHT_TASK",
      message: 'Task "unique-task-1" is already in flight.',
      details: { taskId: "unique-task-1" }
    });

    // inFlightCount remains 1 (only the first task)
    expect(runtime.getInFlightTaskCount()).toBe(1);

    // No runtime.task.failed event should have fired for the early rejection
    expect(failedEvents.length).toBe(0);

    // Complete task 1
    releaseTask();
    await expect(task1Promise).resolves.toBeDefined();

    // Now inFlightCount is 0
    expect(runtime.getInFlightTaskCount()).toBe(0);

    // Now that task 1 is finished, the same taskId can be executed again cleanly
    let releaseTask2!: () => void;
    runtime.registerTool({
      name: "second-tool",
      description: "Second tool",
      execute: async () => {
        await new Promise<void>((r) => {
          releaseTask2 = r;
        });
        return { rerun: true };
      }
    });

    const taskRerunPromise = runtime.executeTask({
      taskId: "unique-task-1",
      agentId: "agent-alpha",
      toolName: "second-tool",
      input: "rerun after finish",
      payload: {}
    });
    expect(runtime.getInFlightTaskCount()).toBe(1);
    releaseTask2();
    await expect(taskRerunPromise).resolves.toBeDefined();
    expect(runtime.getInFlightTaskCount()).toBe(0);
  });

  it("removes in-flight task tracking when task fails", async () => {
    const runtime = new AgentRuntime({
      runtimeId: "rt-dupe-fail-test"
    });

    runtime.registerTool({
      name: "failing-tool",
      description: "Throws error",
      execute: async () => {
        throw new Error("Deliberate tool failure");
      }
    });

    await runtime.start();

    await expect(
      runtime.executeTask({
        taskId: "failing-task-1",
        agentId: "agent-alpha",
        toolName: "failing-tool",
        input: "fail",
        payload: {}
      })
    ).rejects.toThrow("Deliberate tool failure");

    // Must be removed from in-flight tasks after failure
    expect(runtime.getInFlightTaskCount()).toBe(0);
  });
});
