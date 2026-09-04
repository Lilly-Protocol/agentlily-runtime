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
    expect(instance.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it("lists all created instances without duplicates", () => {
    const manager = new AgentInstanceManager();
    manager.getOrCreate("x");
    manager.getOrCreate("y");
    manager.getOrCreate("x"); // duplicate call
    const list = manager.list();
    expect(list).toHaveLength(2);
    const ids = list.map((i) => i.agentId).sort();
    expect(ids).toEqual(["x", "y"]);
  });

  it("rejects empty agentId with INVALID_TASK error", () => {
    const manager = new AgentInstanceManager();
    expect(() => manager.getOrCreate("")).toThrow(
      /agentId must be a non-empty string/
    );
  });
});

describe("AgentInstanceManager FIFO eviction at maxInstances (Issue #241)", () => {
  it("defaults to 5,000 maxInstances when option is omitted", () => {
    const manager = new AgentInstanceManager();
    expect((manager as unknown as { maxInstances: number }).maxInstances).toBe(5_000);
  });

  it("evicts the oldest instance when maxInstances capacity is exceeded", () => {
    const manager = new AgentInstanceManager({ maxInstances: 2 });
    manager.getOrCreate("agent-1");
    manager.getOrCreate("agent-2");
    expect(manager.size()).toBe(2);

    // Adding 3rd exceeds capacity 2, evicts oldest ("agent-1")
    manager.getOrCreate("agent-3");
    expect(manager.size()).toBe(2);
    expect(manager.has("agent-1")).toBe(false);
    expect(manager.has("agent-2")).toBe(true);
    expect(manager.has("agent-3")).toBe(true);
    expect(manager.list().map((i) => i.agentId)).toEqual(["agent-2", "agent-3"]);
  });

  it("preserves FIFO order across multiple consecutive evictions", () => {
    const manager = new AgentInstanceManager({ maxInstances: 3 });
    manager.getOrCreate("a");
    manager.getOrCreate("b");
    manager.getOrCreate("c");
    expect(manager.list().map((i) => i.agentId)).toEqual(["a", "b", "c"]);

    manager.getOrCreate("d");
    expect(manager.list().map((i) => i.agentId)).toEqual(["b", "c", "d"]);

    manager.getOrCreate("e");
    expect(manager.list().map((i) => i.agentId)).toEqual(["c", "d", "e"]);

    manager.getOrCreate("f");
    expect(manager.list().map((i) => i.agentId)).toEqual(["d", "e", "f"]);
  });

  it("does not evict when getting an already-existing instance", () => {
    const manager = new AgentInstanceManager({ maxInstances: 2 });
    manager.getOrCreate("a");
    manager.getOrCreate("b");
    expect(manager.size()).toBe(2);

    // Accessing existing instance does not exceed capacity or evict
    manager.getOrCreate("a");
    expect(manager.size()).toBe(2);
    expect(manager.has("a")).toBe(true);
    expect(manager.has("b")).toBe(true);
  });

  it("handles maxInstances = 1 as an immediate sliding window", () => {
    const manager = new AgentInstanceManager({ maxInstances: 1 });
    manager.getOrCreate("first");
    expect(manager.size()).toBe(1);
    expect(manager.has("first")).toBe(true);

    manager.getOrCreate("second");
    expect(manager.size()).toBe(1);
    expect(manager.has("first")).toBe(false);
    expect(manager.has("second")).toBe(true);
    expect(manager.list().map((i) => i.agentId)).toEqual(["second"]);
  });

  it("allows deleted instances to free capacity without triggering FIFO eviction", () => {
    const manager = new AgentInstanceManager({ maxInstances: 2 });
    manager.getOrCreate("a");
    manager.getOrCreate("b");
    expect(manager.size()).toBe(2);

    expect(manager.delete("a")).toBe(true);
    expect(manager.size()).toBe(1);

    // Now inserting "c" stays within capacity 2, so "b" is not evicted
    manager.getOrCreate("c");
    expect(manager.size()).toBe(2);
    expect(manager.has("b")).toBe(true);
    expect(manager.has("c")).toBe(true);
  });

  it("clearing instances resets capacity and allows subsequent additions", () => {
    const manager = new AgentInstanceManager({ maxInstances: 2 });
    manager.getOrCreate("a");
    manager.getOrCreate("b");
    manager.clear();
    expect(manager.size()).toBe(0);

    manager.getOrCreate("x");
    manager.getOrCreate("y");
    expect(manager.size()).toBe(2);
    expect(manager.has("x")).toBe(true);
    expect(manager.has("y")).toBe(true);
  });

  it("creates a fresh instance if a previously evicted agentId is re-added", () => {
    const manager = new AgentInstanceManager({ maxInstances: 1 });
    const original = manager.getOrCreate("transient");
    manager.getOrCreate("displacer");
    expect(manager.has("transient")).toBe(false);

    const recreated = manager.getOrCreate("transient");
    expect(recreated).not.toBe(original);
    expect(recreated.agentId).toBe("transient");
    expect(manager.has("transient")).toBe(true);
    expect(manager.has("displacer")).toBe(false);
  });

  it("retains all instances when maxInstances is not reached", () => {
    const manager = new AgentInstanceManager({ maxInstances: 10 });
    for (let i = 1; i <= 5; i++) {
      manager.getOrCreate(`agent-${i}`);
    }
    expect(manager.size()).toBe(5);
    expect(manager.list()).toHaveLength(5);
  });
});

