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
    expect(registry.size()).toBe(2);
  });

  it("unregisters registered tool, tracks size(), and throws TOOL_NOT_FOUND on subsequent get()", () => {
    const registry = new ToolRegistry();
    const tool = { name: "echo", description: "Echo tool", execute: () => "ok" };

    registry.register(tool);
    expect(registry.size()).toBe(1);
    expect(registry.has("echo")).toBe(true);
    expect(registry.get("echo")).toBe(tool);

    const unregistered = registry.unregister("echo");
    expect(unregistered).toBe(true);
    expect(registry.size()).toBe(0);
    expect(registry.has("echo")).toBe(false);

    expect(() => registry.get("echo")).toThrow(RuntimeError);
    try {
      registry.get("echo");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("TOOL_NOT_FOUND");
      expect(err.details?.toolName).toBe("echo");
    }
  });

  it("returns false without throwing when unregistering an unknown tool", () => {
    const registry = new ToolRegistry();
    expect(registry.unregister("nonexistent")).toBe(false);
  });

  it("clears all tools, resetting size() to 0 and list() to empty array", () => {
    const registry = new ToolRegistry();
    registry.register({ name: "tool-1", description: "1", execute: () => 1 });
    registry.register({ name: "tool-2", description: "2", execute: () => 2 });

    expect(registry.size()).toBe(2);
    expect(registry.list()).toHaveLength(2);

    registry.clear();

    expect(registry.size()).toBe(0);
    expect(registry.list()).toEqual([]);
    expect(registry.has("tool-1")).toBe(false);
    expect(registry.has("tool-2")).toBe(false);
  });
});
