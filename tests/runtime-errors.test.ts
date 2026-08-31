import { describe, expect, it } from "vitest";
import { RuntimeError } from "../src/index.js";

describe("RuntimeError serialization (issue #155)", () => {
  it("toJSON() includes name, code, message, details, and stack", () => {
    const error = new RuntimeError("TOOL_NOT_FOUND", "echo tool is missing", {
      agentId: "agent-1",
      taskName: "task-1"
    });

    const json = error.toJSON();

    expect(json.name).toBe("RuntimeError");
    expect(json.code).toBe("TOOL_NOT_FOUND");
    expect(json.message).toBe("echo tool is missing");
    expect(json.details).toEqual({
      agentId: "agent-1",
      taskName: "task-1"
    });
    expect(typeof json.stack).toBe("string");
    expect(json.stack).toContain("RuntimeError");
  });

  it("code and details survive JSON.stringify", () => {
    const error = new RuntimeError("INVALID_TASK", "task payload rejected", {
      reason: "unknown tool"
    });

    const roundTripped = JSON.parse(JSON.stringify(error)) as {
      name: string;
      code: string;
      message: string;
      details: Record<string, unknown>;
      stack: string;
    };

    expect(roundTripped.code).toBe("INVALID_TASK");
    expect(roundTripped.details).toEqual({ reason: "unknown tool" });
    expect(roundTripped.message).toBe("task payload rejected");
  });

  it("toJSON() handles an error without details", () => {
    const error = new RuntimeError("EXECUTION_FAILED", "step blew up");
    const json = error.toJSON();

    expect(json.code).toBe("EXECUTION_FAILED");
    expect(json.details).toBeUndefined();
    expect(Object.keys(json).sort()).toEqual(
      ["code", "details", "message", "name", "stack"].sort()
    );
  });
});
