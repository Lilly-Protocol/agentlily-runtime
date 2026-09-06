import { describe, it, expect, vi } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import { RuntimeError } from "../../src/errors/runtime-errors.js";
import type { RuntimeTask } from "../../src/tasks/task-types.js";

describe("AgentRuntime task validation before event emission", () => {
  it("rejects task with empty taskId without emitting runtime.task.received or runtime.task.failed", async () => {
    const runtime = new AgentRuntime({ runtimeId: "test-runtime" });
    await runtime.start();

    const eventSpy = vi.fn();
    runtime.getDependencies().eventBus.on("runtime.task.received", eventSpy);
    runtime.getDependencies().eventBus.on("runtime.task.failed", eventSpy);

    const invalidTask: RuntimeTask<unknown> = {
      taskId: "   ",
      agentId: "agent-1",
      toolName: "test-tool",
      input: "test input",
      payload: {}
    };

    let thrownError: unknown;
    try {
      await runtime.executeTask(invalidTask);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(RuntimeError);
    expect((thrownError as RuntimeError).code).toBe("INVALID_TASK");
    expect((thrownError as RuntimeError).message).toContain("taskId must be a non-empty string");

    // Must NOT have emitted any task lifecycle events
    expect(eventSpy).not.toHaveBeenCalled();
  });

  it("rejects task with empty agentId, toolName, or input without emitting events", async () => {
    const runtime = new AgentRuntime({ runtimeId: "test-runtime" });
    await runtime.start();

    const eventSpy = vi.fn();
    runtime.getDependencies().eventBus.on("runtime.task.received", eventSpy);
    runtime.getDependencies().eventBus.on("runtime.task.failed", eventSpy);

    const testCases: Array<{ task: RuntimeTask<unknown>; field: string }> = [
      {
        task: { taskId: "t1", agentId: "", toolName: "tool", input: "inp", payload: {} },
        field: "agentId"
      },
      {
        task: { taskId: "t2", agentId: "a1", toolName: "", input: "inp", payload: {} },
        field: "toolName"
      },
      {
        task: { taskId: "t3", agentId: "a1", toolName: "tool", input: " ", payload: {} },
        field: "input"
      }
    ];

    for (const { task, field } of testCases) {
      eventSpy.mockClear();
      let err: unknown;
      try {
        await runtime.executeTask(task);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(RuntimeError);
      expect((err as RuntimeError).code).toBe("INVALID_TASK");
      expect((err as RuntimeError).message).toContain(`${field} must be a non-empty string`);
      expect(eventSpy).not.toHaveBeenCalled();
    }
  });
});
