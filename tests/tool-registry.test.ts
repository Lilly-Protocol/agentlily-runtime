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

  it("unregisters a tool, updates has() and size(), and causes get() to throw TOOL_NOT_FOUND", () => {
    const registry = new ToolRegistry();
    const tool = {
      name: "echo",
      description: "Echo tool",
      execute: () => "ok"
    };

    registry.register(tool);
    expect(registry.has("echo")).toBe(true);
    expect(registry.size()).toBe(1);

    const removed = registry.unregister("echo");
    expect(removed).toBe(true);
    expect(registry.has("echo")).toBe(false);
    expect(registry.size()).toBe(0);

    expect(() => registry.get("echo")).toThrowError(RuntimeError);
    try {
      registry.get("echo");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err).toBeInstanceOf(RuntimeError);
      expect(err.code).toBe("TOOL_NOT_FOUND");
      expect(err.details?.toolName).toBe("echo");
    }
  });

  it("returns false when unregistering an unknown tool name without throwing", () => {
    const registry = new ToolRegistry();
    expect(registry.unregister("non_existent")).toBe(false);
    expect(registry.size()).toBe(0);
  });

  it("clears all registered tools and resets size and list", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "tool1",
      description: "Tool 1",
      execute: () => "1"
    });
    registry.register({
      name: "tool2",
      description: "Tool 2",
      execute: () => "2"
    });
    expect(registry.size()).toBe(2);
    expect(registry.list()).toHaveLength(2);

    registry.clear();
    expect(registry.size()).toBe(0);
    expect(registry.list()).toEqual([]);
    expect(registry.has("tool1")).toBe(false);
    expect(registry.has("tool2")).toBe(false);
  });

  it("accurately tracks size through register and unregister cycles", () => {
    const registry = new ToolRegistry();
    expect(registry.size()).toBe(0);

    registry.register({ name: "toolA", description: "A", execute: () => "a" });
    expect(registry.size()).toBe(1);

    registry.register({ name: "toolB", description: "B", execute: () => "b" });
    expect(registry.size()).toBe(2);

    registry.unregister("toolA");
    expect(registry.size()).toBe(1);

    registry.unregister("unknown");
    expect(registry.size()).toBe(1);

    registry.unregister("toolB");
    expect(registry.size()).toBe(0);
  });
});
