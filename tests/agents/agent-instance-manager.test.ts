import { describe, it, expect } from "vitest";
import { AgentInstanceManager } from "../../src/agents/agent-instance-manager.js";

describe("AgentInstanceManager getOrCreate identity semantics (Issue #113)", () => {
  it("returns the same instance reference for identical agentId", () => {
    const manager = new AgentInstanceManager();
    const first = manager.getOrCreate("agent-1");
    const second = manager.getOrCreate("agent-1");
    expect(first).toBe(second);
  });

  it("preserves original createdAt on subsequent calls", () => {
    const manager = new AgentInstanceManager();
    const first = manager.getOrCreate("agent-persist");
    const second = manager.getOrCreate("agent-persist");
    expect(second.createdAt).toBe(first.createdAt);
  });

  it("creates distinct instances for different agentIds", () => {
    const manager = new AgentInstanceManager();
    const a = manager.getOrCreate("alpha");
    const b = manager.getOrCreate("beta");
    expect(a).not.toBe(b);
    expect(a.agentId).toBe("alpha");
    expect(b.agentId).toBe("beta");
  });

  it("populates agentId and ISO createdAt on creation", () => {
    const manager = new AgentInstanceManager();
    const instance = manager.getOrCreate("new-agent");
    expect(instance.agentId).toBe("new-agent");
    expect(instance.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("lists all created instances without duplicates", () => {
    const manager = new AgentInstanceManager();
    manager.getOrCreate("x");
    manager.getOrCreate("y");
    manager.getOrCreate("x"); // duplicate call
    const list = manager.list();
    expect(list).toHaveLength(2);
    const ids = list.map(i => i.agentId).sort();
    expect(ids).toEqual(["x", "y"]);
  });

  it("rejects empty agentId with INVALID_TASK error", () => {
    const manager = new AgentInstanceManager();
    expect(() => manager.getOrCreate("")).toThrow(/agentId must be a non-empty string/);
  });
});
