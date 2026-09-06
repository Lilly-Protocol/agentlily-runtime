import { describe, it, expect } from "vitest";
import { RuntimeError } from "../../src/errors/runtime-errors.js";

describe("RuntimeError construction and code values (Issue #110)", () => {
  it("sets name to RuntimeError", () => {
    const err = new RuntimeError("INVALID_TASK", "test message");
    expect(err.name).toBe("RuntimeError");
  });

  it("preserves the provided error code", () => {
    const err = new RuntimeError("TOOL_NOT_FOUND", "missing tool");
    expect(err.code).toBe("TOOL_NOT_FOUND");
  });

  it("preserves the provided message", () => {
    const err = new RuntimeError("EXECUTION_FAILED", "something broke");
    expect(err.message).toBe("something broke");
  });

  it("stores details when provided", () => {
    const details = { fieldName: "taskId", cause: "empty" };
    const err = new RuntimeError("INVALID_TASK", "bad input", details);
    expect(err.details).toEqual(details);
  });

  it("leaves details undefined when not provided", () => {
    const err = new RuntimeError("RUNTIME_NOT_STARTED", "not started");
    expect(err.details).toBeUndefined();
  });

  it("is an instance of Error", () => {
    const err = new RuntimeError("DUPLICATE_TOOL", "dup");
    expect(err).toBeInstanceOf(Error);
  });

  it("supports all valid RuntimeErrorCode values", () => {
    const codes = [
      "RUNTIME_NOT_STARTED",
      "RUNTIME_ALREADY_STARTED",
      "TOOL_NOT_FOUND",
      "DUPLICATE_TOOL",
      "INVALID_TASK",
      "EXECUTION_FAILED",
      "STORAGE_CORRUPTED"
    ] as const;

    for (const code of codes) {
      const err = new RuntimeError(code, `message for ${code}`);
      expect(err.code).toBe(code);
    }
  });
});
