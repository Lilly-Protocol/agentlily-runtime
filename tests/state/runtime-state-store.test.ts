import { describe, it, expect } from "vitest";
import { InMemoryRuntimeStateStore } from "../../src/state/runtime-state.js";

describe("InMemoryRuntimeStateStore put/get round trips", () => {
  it("stores and retrieves a string value", async () => {
    const store = new InMemoryRuntimeStateStore();
    await store.put("key1", "value1");
    const result = await store.get<string>("key1");
    expect(result).toBe("value1");
  });

  it("stores and retrieves an object value", async () => {
    const store = new InMemoryRuntimeStateStore();
    const obj = { taskId: "t1", status: "running" };
    await store.put("taskState", obj);
    const result = await store.get<typeof obj>("taskState");
    expect(result).toEqual(obj);
  });

  it("returns undefined for non-existent keys", async () => {
    const store = new InMemoryRuntimeStateStore();
    const result = await store.get("missing");
    expect(result).toBeUndefined();
  });

  it("overwrites existing values on subsequent puts", async () => {
    const store = new InMemoryRuntimeStateStore();
    await store.put("counter", 1);
    await store.put("counter", 2);
    const result = await store.get<number>("counter");
    expect(result).toBe(2);
  });

  it("handles null and zero as valid stored values", async () => {
    const store = new InMemoryRuntimeStateStore();
    await store.put("nullVal", null);
    await store.put("zeroVal", 0);
    expect(await store.get("nullVal")).toBeNull();
    expect(await store.get("zeroVal")).toBe(0);
  });

  it("isolates keys across multiple put operations", async () => {
    const store = new InMemoryRuntimeStateStore();
    await store.put("a", "alpha");
    await store.put("b", "beta");
    await store.put("c", "gamma");
    expect(await store.get<string>("a")).toBe("alpha");
    expect(await store.get<string>("b")).toBe("beta");
    expect(await store.get<string>("c")).toBe("gamma");
  });

  it("supports has, delete, clear, size, and keys methods", async () => {
    const store = new InMemoryRuntimeStateStore({ maxEntries: 2 });
    expect(await store.has("k1")).toBe(false);
    expect(await store.size()).toBe(0);
    expect(await store.keys()).toEqual([]);

    await store.put("k1", "v1");
    expect(await store.has("k1")).toBe(true);
    expect(await store.size()).toBe(1);
    expect(await store.keys()).toEqual(["k1"]);

    await store.put("k2", "v2");
    expect(await store.size()).toBe(2);
    expect(await store.keys()).toEqual(["k1", "k2"]);

    // Eviction on exceeding maxEntries
    await store.put("k3", "v3");
    expect(await store.size()).toBe(2);
    expect(await store.has("k1")).toBe(false);
    expect(await store.has("k2")).toBe(true);
    expect(await store.has("k3")).toBe(true);
    expect(await store.keys()).toEqual(["k2", "k3"]);

    expect(await store.delete("k2")).toBe(true);
    expect(await store.delete("k2")).toBe(false);
    expect(await store.size()).toBe(1);

    await store.clear();
    expect(await store.size()).toBe(0);
    expect(await store.keys()).toEqual([]);
  });
});
