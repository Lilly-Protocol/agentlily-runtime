import { describe, it, expect } from "vitest";
import { ToolRegistry } from "../../src/tools/tool-registry.js";

describe("ToolRegistry list ordering and isolation (Issue #129)", () => {
  it("returns empty array for a fresh registry", () => {
    const registry = new ToolRegistry();
    expect(registry.list()).toEqual([]);
  });

  it("preserves registration order in list output", () => {
    const registry = new ToolRegistry();
    const toolA = { name: "alpha", description: "A", execute: () => "a" };
    const toolB = { name: "beta", description: "B", execute: () => "b" };
    const toolC = { name: "gamma", description: "C", execute: () => "c" };

    registry.register(toolA);
    registry.register(toolB);
    registry.register(toolC);

    const listed = registry.list();
    expect(listed.map(t => t.name)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("returns the same object references that were registered", () => {
    const registry = new ToolRegistry();
    const toolX = { name: "x", description: "X", execute: () => "x" };
    const toolY = { name: "y", description: "Y", execute: () => "y" };

    registry.register(toolX);
    registry.register(toolY);

    const listed = registry.list();
    expect(listed[0]).toBe(toolX);
    expect(listed[1]).toBe(toolY);
  });

  it("does not expose internal mutation through list result", () => {
    const registry = new ToolRegistry();
    registry.register({ name: "safe", description: "S", execute: () => "s" });

    const listed = registry.list();
    listed.push({ name: "injected", description: "I", execute: () => "i" } as any);

    // Internal registry should not be affected by external array mutation
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].name).toBe("safe");
  });
});
