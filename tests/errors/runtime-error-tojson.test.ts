import { describe, it, expect } from "vitest";
import { RuntimeError } from "../../src/errors/runtime-errors.js";

describe("RuntimeError toJSON serialization (Issue #155)", () => {
  it("includes code and details in JSON.stringify output", () => {
    const err = new RuntimeError("INVALID_TASK", "bad input", { fieldName: "taskId" });
    const json = JSON.parse(JSON.stringify(err));
    expect(json.code).toBe("INVALID_TASK");
    expect(json.details).toEqual({ fieldName: "taskId" });
    expect(json.message).toBe("bad input");
    expect(json.name).toBe("RuntimeError");
  });

  it("includes stack trace in toJSON output", () => {
    const err = new RuntimeError("EXECUTION_FAILED", "oops");
    const json = err.toJSON();
    expect(json.stack).toBeDefined();
    expect(typeof json.stack).toBe("string");
    expect((json.stack as string).length).toBeGreaterThan(0);
  });

  it("serializes undefined details as undefined in toJSON", () => {
    const err = new RuntimeError("TOOL_NOT_FOUND", "missing");
    const json = err.toJSON();
    expect(json.details).toBeUndefined();
    expect(json.code).toBe("TOOL_NOT_FOUND");
  });

  it("preserves all fields through JSON round-trip", () => {
    const original = new RuntimeError("DUPLICATE_TOOL", "dup", { toolName: "echo" });
    const restored = JSON.parse(JSON.stringify(original));
    expect(restored.name).toBe("RuntimeError");
    expect(restored.code).toBe("DUPLICATE_TOOL");
    expect(restored.message).toBe("dup");
    expect(restored.details).toEqual({ toolName: "echo" });
    expect(restored.stack).toBeDefined();
  });
});
