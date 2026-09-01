import { describe, expect, it } from "vitest";
import {
  assertMaxToolCalls,
  assertNonEmptyValue,
  assertRuntimeStarted,
  RuntimeError
} from "../src/index.js";

describe("runtime guards", () => {
  describe("assertMaxToolCalls", () => {
    it("allows tool call when count is strictly below the limit", () => {
      expect(() => assertMaxToolCalls(0, 3)).not.toThrow();
      expect(() => assertMaxToolCalls(2, 3)).not.toThrow();
    });

    it("throws MAX_TOOL_CALLS_EXCEEDED when count reaches or exceeds the limit", () => {
      expect(() => assertMaxToolCalls(3, 3)).toThrowError(RuntimeError);

      try {
        assertMaxToolCalls(3, 3);
      } catch (error) {
        expect(error).toBeInstanceOf(RuntimeError);
        const runtimeErr = error as RuntimeError;
        expect(runtimeErr.code).toBe("MAX_TOOL_CALLS_EXCEEDED");
        expect(runtimeErr.message).toContain(
          "maximum allowed tool calls limit of 3"
        );
        expect(runtimeErr.details).toEqual({
          currentToolCalls: 3,
          maxToolCalls: 3
        });
      }
    });

    it("throws when maxToolCalls is 0 on any invocation attempt", () => {
      expect(() => assertMaxToolCalls(0, 0)).toThrowError(RuntimeError);
    });

    it("does not throw when maxToolCalls is negative (unrestricted / disabled)", () => {
      expect(() => assertMaxToolCalls(10, -1)).not.toThrow();
    });
  });

  describe("assertRuntimeStarted", () => {
    it("passes when runtime is started", () => {
      expect(() => assertRuntimeStarted(true)).not.toThrow();
    });

    it("throws RUNTIME_NOT_STARTED when false", () => {
      expect(() => assertRuntimeStarted(false)).toThrowError(RuntimeError);
    });
  });

  describe("assertNonEmptyValue", () => {
    it("passes on non-empty string", () => {
      expect(() => assertNonEmptyValue("valid", "testField")).not.toThrow();
    });

    it("throws on empty or whitespace string", () => {
      expect(() => assertNonEmptyValue("", "testField")).toThrowError(
        RuntimeError
      );
      expect(() => assertNonEmptyValue("   ", "testField")).toThrowError(
        RuntimeError
      );
    });
  });
});
