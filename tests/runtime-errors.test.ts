import { describe, expect, it } from "vitest";
import { RuntimeError } from "../src/index.js";

describe("RuntimeError", () => {
  it("serializes name, code, message, details, and stack via toJSON", () => {
    const details = { toolName: "echo", attempt: 3 };
    const err = new RuntimeError("EXECUTION_FAILED", "Execution failed", details);

    const json = err.toJSON();

    expect(json.name).toBe("RuntimeError");
    expect(json.code).toBe("EXECUTION_FAILED");
    expect(json.message).toBe("Execution failed");
    expect(json.details).toEqual(details);
    expect(typeof json.stack).toBe("string");
  });

  it("survives JSON.stringify losslessly", () => {
    const details = { toolName: "echo" };
    const err = new RuntimeError("TOOL_NOT_FOUND", "Tool not found", details);

    const parsed = JSON.parse(JSON.stringify(err)) as {
      name: string;
      code: string;
      message: string;
      details: Record<string, unknown>;
      stack: string | undefined;
    };

    expect(parsed.name).toBe("RuntimeError");
    expect(parsed.code).toBe("TOOL_NOT_FOUND");
    expect(parsed.message).toBe("Tool not found");
    expect(parsed.details).toEqual(details);
    expect(typeof parsed.stack).toBe("string");
  });

  it("includes details when undefined", () => {
    const err = new RuntimeError("RUNTIME_NOT_STARTED", "Runtime not started");

    expect(err.toJSON().details).toBeUndefined();
    expect(JSON.parse(JSON.stringify(err)).details).toBeUndefined();
  });
});
