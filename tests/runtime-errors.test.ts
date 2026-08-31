import { describe, expect, it } from "vitest";
import { RuntimeError } from "../src/errors/runtime-errors";

describe("RuntimeError", () => {
  it("serializes losslessly via toJSON and JSON.stringify", () => {
    const error = new RuntimeError("TOOL_NOT_FOUND", "Tool not registered", {
      toolName: "missing-tool",
      attempt: 3,
    });

    const json = error.toJSON();
    expect(json.name).toBe("RuntimeError");
    expect(json.code).toBe("TOOL_NOT_FOUND");
    expect(json.message).toBe("Tool not registered");
    expect(json.details).toEqual({ toolName: "missing-tool", attempt: 3 });
    expect(json.stack).toBeDefined();

    const stringified = JSON.stringify(error);
    const parsed = JSON.parse(stringified);

    expect(parsed.name).toBe("RuntimeError");
    expect(parsed.code).toBe("TOOL_NOT_FOUND");
    expect(parsed.message).toBe("Tool not registered");
    expect(parsed.details).toEqual({ toolName: "missing-tool", attempt: 3 });
    expect(parsed.stack).toBeDefined();
  });
});
