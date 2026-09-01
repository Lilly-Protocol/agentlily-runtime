import { describe, expect, it } from "vitest";
import { RuntimeError, ToolRegistry } from "../src/index.js";

describe("ToolRegistry", () => {
  it("prevents duplicate tool names with correct error code and details", () => {
    const registry = new ToolRegistry();
    const tool = {
      name: "echo",
      description: "Echo tool",
      execute() {
        return "ok";
      }
    };

    registry.register(tool);

    try {
      registry.register(tool);
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err).toBeInstanceOf(RuntimeError);
      expect(err.code).toBe("DUPLICATE_TOOL");
      expect(err.details?.toolName).toBe("echo");
      expect(err.message).toMatch(/already registered/);
    }
  });

  it("allows registering different tools with distinct names", () => {
    const registry = new ToolRegistry();
    registry.register({ name: "a", description: "A", execute: () => "a" });
    registry.register({ name: "b", description: "B", execute: () => "b" });
    expect(registry.list()).toHaveLength(2);
  });
});
