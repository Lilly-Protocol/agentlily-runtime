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
      await runner.run({ taskId: "", agentId: "a", toolName: "t", input: "i", payload: {} }, ctx);
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.details?.fieldName).toBe("taskId");
    }
  });

  it("rejects with INVALID_TASK when agentId is whitespace-only", async () => {
    try {
      await runner.run({ taskId: "t1", agentId: "   ", toolName: "t", input: "i", payload: {} }, ctx);
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.details?.fieldName).toBe("agentId");
    }
  });

  it("rejects with INVALID_TASK when toolName is empty", async () => {
    try {
      await runner.run({ taskId: "t1", agentId: "a1", toolName: "", input: "i", payload: {} }, ctx);
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.details?.fieldName).toBe("toolName");
    }
  });

  it("rejects with INVALID_TASK when input is missing or blank", async () => {
    try {
      await runner.run({ taskId: "t1", agentId: "a1", toolName: "t", input: "\n\t", payload: {} }, ctx);
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.details?.fieldName).toBe("input");
    }
  });
});
