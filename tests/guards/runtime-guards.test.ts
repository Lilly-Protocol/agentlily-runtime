import { describe, it, expect } from "vitest";
import { assertNonEmptyValue } from "../../src/guards/runtime-guards.js";
import { RuntimeError } from "../../src/errors/runtime-errors.js";

describe("assertNonEmptyValue", () => {
  it("throws with default INVALID_TASK code for empty string", () => {
    expect(() => assertNonEmptyValue("", "taskId")).toThrow(RuntimeError);
    try {
      assertNonEmptyValue("", "taskId");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.message).toContain("taskId must be a non-empty string.");
      expect(err.details?.fieldName).toBe("taskId");
    }
  });

  it("throws for whitespace-only string", () => {
    expect(() => assertNonEmptyValue("   ", "name")).toThrow(RuntimeError);
    try {
      assertNonEmptyValue("   ", "name");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.details?.fieldName).toBe("name");
    }
  });

  it("does not throw for valid padded string", () => {
    expect(() => assertNonEmptyValue("  valid  ", "field")).not.toThrow();
  });

  it("respects overridden EXECUTION_FAILED error code", () => {
    try {
      assertNonEmptyValue("", "taskRef", "EXECUTION_FAILED");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("EXECUTION_FAILED");
      expect(err.details?.fieldName).toBe("taskRef");
    }
  });

  it("includes fieldName in details matching input parameter", () => {
    try {
      assertNonEmptyValue("\t\n", "customField");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.details?.fieldName).toBe("customField");
      expect(err.message).toContain("customField");
    }
  });
});
