import { describe, it, expect } from "vitest";
import { TaskRunner } from "../../src/tasks/task-runner.js";
import { RuntimeError } from "../../src/errors/runtime-errors.js";
import { InMemoryMemoryStore } from "../../src/memory/memory-store.js";

describe("TaskRunner INVALID_TASK rejection paths", () => {
  const stubExecutor = { execute: async () => ({}) };
  const memoryStore = new InMemoryMemoryStore();
  const runner = new TaskRunner(stubExecutor as any, memoryStore);
  const ctx = {} as any;

  it("rejects with INVALID_TASK when taskId is empty", async () => {
    try {
      await runner.run(
        { taskId: "", agentId: "a", toolName: "t", input: "i", payload: {} },
        ctx
      );
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.details?.fieldName).toBe("taskId");
    }
  });

  it("rejects with INVALID_TASK when agentId is whitespace-only", async () => {
    try {
      await runner.run(
        {
          taskId: "t1",
          agentId: "   ",
          toolName: "t",
          input: "i",
          payload: {}
        },
        ctx
      );
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.details?.fieldName).toBe("agentId");
    }
  });

  it("rejects with INVALID_TASK when toolName is empty", async () => {
    try {
      await runner.run(
        { taskId: "t1", agentId: "a1", toolName: "", input: "i", payload: {} },
        ctx
      );
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.details?.fieldName).toBe("toolName");
    }
  });

  it("rejects with INVALID_TASK when input is missing or blank", async () => {
    try {
      await runner.run(
        {
          taskId: "t1",
          agentId: "a1",
          toolName: "t",
          input: "\n\t",
          payload: {}
        },
        ctx
      );
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.details?.fieldName).toBe("input");
    }
  });
});

describe("TaskRunner RuntimeError preservation vs generic wrap", () => {
  it("preserves RuntimeError instance unchanged with its original code, message, and details", async () => {
    const customError = new RuntimeError("DUPLICATE_TOOL", "Custom tool error", {
      customField: "custom-value",
      numericVal: 42
    });

    const throwingExecutor = {
      execute: async () => {
        throw customError;
      }
    };
    const memoryStore = new InMemoryMemoryStore();
    const runner = new TaskRunner(throwingExecutor as any, memoryStore);
    const ctx = {} as any;

    try {
      await runner.run(
        { taskId: "task-custom", agentId: "agent-custom", toolName: "tool-custom", input: "input-custom", payload: {} },
        ctx
      );
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBe(customError);
      const err = e as RuntimeError;
      expect(err.code).toBe("DUPLICATE_TOOL");
      expect(err.message).toBe("Custom tool error");
      expect(err.details).toEqual({
        customField: "custom-value",
        numericVal: 42
      });
    }
  });

  it("wraps non-RuntimeError exceptions in EXECUTION_FAILED preserving the error message and cause", async () => {
    const genericError = new Error("Something went unexpectedly wrong");

    const throwingExecutor = {
      execute: async () => {
        throw genericError;
      }
    };
    const memoryStore = new InMemoryMemoryStore();
    const runner = new TaskRunner(throwingExecutor as any, memoryStore);
    const ctx = {} as any;

    try {
      await runner.run(
        { taskId: "task-gen", agentId: "agent-gen", toolName: "tool-gen", input: "input-gen", payload: {} },
        ctx
      );
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err).toBeInstanceOf(RuntimeError);
      expect(err.code).toBe("EXECUTION_FAILED");
      expect(err.message).toBe("Something went unexpectedly wrong");
      expect(err.details?.cause).toBe("Something went unexpectedly wrong");
    }
  });
});
