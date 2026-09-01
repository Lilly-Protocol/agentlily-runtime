import { describe, it, expect } from "vitest";
import { assertNonEmptyValue } from "../../src/guards/runtime-guards.js";
import { RuntimeError } from "../../src/errors/runtime-errors.js";

describe("assertNonEmptyValue edge cases (Issue #152)", () => {
  it("rejects whitespace-only string with INVALID_TASK", () => {
    try {
      assertNonEmptyValue("   \t\n  ", "field");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
      expect(err.details?.fieldName).toBe("field");
    }
  });

  it("accepts string with leading/trailing whitespace but non-empty content", () => {
    expect(() => assertNonEmptyValue("  valid  ", "field")).not.toThrow();
  });

  it("uses default INVALID_TASK code when not overridden", () => {
    try {
      assertNonEmptyValue("", "taskId");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("INVALID_TASK");
    }
  });

  it("respects overridden EXECUTION_FAILED code", () => {
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
      assertNonEmptyValue("\n\r\t", "customField");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.details?.fieldName).toBe("customField");
      expect(err.message).toContain("customField");
    }
  });

  it("rejects single space character", () => {
    expect(() => assertNonEmptyValue(" ", "x")).toThrow(RuntimeError);
  });

  it("accepts single non-whitespace character", () => {
    expect(() => assertNonEmptyValue("a", "x")).not.toThrow();
  });
});
