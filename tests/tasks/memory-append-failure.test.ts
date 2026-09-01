import { describe, it, expect } from "vitest";
import { TaskRunner } from "../../src/tasks/task-runner.js";
import { RuntimeError } from "../../src/errors/runtime-errors.js";

describe("TaskRunner memory append failure propagation", () => {
  const stubExecutor = { execute: async () => ({ ok: true }) };

  it("propagates memory store append rejection as EXECUTION_FAILED with cause", async () => {
    const throwingStore = {
      append: async () => { throw new Error("DB connection lost"); },
      listByAgent: async () => [],
    };

    const runner = new TaskRunner(stubExecutor as any, throwingStore as any);
    const ctx = {} as any;

    try {
      await runner.run(
        { taskId: "t1", agentId: "a1", toolName: "noop", input: "go", payload: {} },
        ctx
      );
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("EXECUTION_FAILED");
      expect(err.details?.cause).toContain("DB connection lost");
    }
  });

  it("preserves original RuntimeError from executor without wrapping", async () => {
    const failingExecutor = {
      execute: async () => { throw new RuntimeError("TOOL_NOT_FOUND", "Tool missing"); },
    };
    const noopStore = { append: async () => {}, listByAgent: async () => [] };

    const runner = new TaskRunner(failingExecutor as any, noopStore as any);
    const ctx = {} as any;

    try {
      await runner.run(
        { taskId: "t2", agentId: "a2", toolName: "missing", input: "go", payload: {} },
        ctx
      );
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("TOOL_NOT_FOUND");
    }
  });
});
