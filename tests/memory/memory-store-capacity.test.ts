import { describe, expect, it } from "vitest";
import {
  InMemoryMemoryStore,
  DEFAULT_MAX_MEMORY_ENTRIES
} from "../../src/memory/memory-store.js";

describe("InMemoryMemoryStore Capacity & Eviction Invariants", () => {
  it("initializes with default maximum capacity of 10,000", () => {
    const store = new InMemoryMemoryStore();
    expect(store.maxEntries).toBe(DEFAULT_MAX_MEMORY_ENTRIES);
    expect(store.size).toBe(0);
  });

  it("supports explicit numeric and object capacity configuration", () => {
    const storeObj = new InMemoryMemoryStore({ maxEntries: 25 });
    expect(storeObj.maxEntries).toBe(25);

    const storeNum = new InMemoryMemoryStore(50);
    expect(storeNum.maxEntries).toBe(50);
  });

  it("throws RangeError on non-positive or invalid capacity", () => {
    expect(() => new InMemoryMemoryStore(0)).toThrow(RangeError);
    expect(() => new InMemoryMemoryStore(-10)).toThrow(RangeError);
    expect(() => new InMemoryMemoryStore(NaN)).toThrow(RangeError);
  });

  it("evicts oldest entries in FIFO order when maxEntries is exceeded", async () => {
    const store = new InMemoryMemoryStore({ maxEntries: 3 });

    for (let i = 1; i <= 5; i++) {
      await store.append({
        agentId: "agent-1",
        taskId: `task-${i}`,
        input: `input-${i}`,
        output: { step: i },
        recordedAt: new Date().toISOString()
      });
    }

    expect(store.size).toBe(3);
    const records = await store.listByAgent("agent-1");
    expect(records.map((r) => r.taskId)).toEqual(["task-3", "task-4", "task-5"]);
  });

  it("maintains agent isolation across eviction cycles", async () => {
    const store = new InMemoryMemoryStore({ maxEntries: 3 });

    await store.append({ agentId: "agent-A", taskId: "t1", input: "i1", output: 1, recordedAt: "" });
    await store.append({ agentId: "agent-B", taskId: "t2", input: "i2", output: 2, recordedAt: "" });
    await store.append({ agentId: "agent-A", taskId: "t3", input: "i3", output: 3, recordedAt: "" });
    // Capacity reached (3). Appending 4th evicts t1
    await store.append({ agentId: "agent-B", taskId: "t4", input: "i4", output: 4, recordedAt: "" });

    const aEntries = await store.listByAgent("agent-A");
    const bEntries = await store.listByAgent("agent-B");

    expect(aEntries.map((e) => e.taskId)).toEqual(["t3"]);
    expect(bEntries.map((e) => e.taskId)).toEqual(["t2", "t4"]);
  });

  it("clears all stored memory entries", async () => {
    const store = new InMemoryMemoryStore({ maxEntries: 10 });
    await store.append({ agentId: "agent-1", taskId: "t1", input: "i1", output: 1, recordedAt: "" });
    expect(store.size).toBe(1);
    await store.clear();
    expect(store.size).toBe(0);
    expect(await store.listByAgent("agent-1")).toEqual([]);
  });
});
