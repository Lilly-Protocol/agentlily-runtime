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
});

describe("InMemoryRuntimeStateStore maxEntries FIFO eviction and optional methods", () => {
  it("evicts oldest keys in FIFO order when maxEntries capacity is exceeded", async () => {
    const store = new InMemoryRuntimeStateStore({ maxEntries: 3 });

    await store.put("k1", "v1");
    await store.put("k2", "v2");
    await store.put("k3", "v3");

    expect(await store.size()).toBe(3);
    expect(await store.keys()).toEqual(["k1", "k2", "k3"]);

    // Adding 4th key should evict oldest (k1)
    await store.put("k4", "v4");

    expect(await store.size()).toBe(3);
    expect(await store.get("k1")).toBeUndefined();
    expect(await store.has("k1")).toBe(false);
    expect(await store.get("k2")).toBe("v2");
    expect(await store.get("k3")).toBe("v3");
    expect(await store.get("k4")).toBe("v4");
    expect(await store.keys()).toEqual(["k2", "k3", "k4"]);

    // Adding 5th key should evict k2
    await store.put("k5", "v5");
    expect(await store.size()).toBe(3);
    expect(await store.get("k2")).toBeUndefined();
    expect(await store.has("k2")).toBe(false);
    expect(await store.keys()).toEqual(["k3", "k4", "k5"]);
  });

  it("updating an existing key does not evict other keys even if store is at capacity", async () => {
    const store = new InMemoryRuntimeStateStore({ maxEntries: 2 });

    await store.put("k1", "v1");
    await store.put("k2", "v2");
    expect(await store.size()).toBe(2);

    // Update existing k1
    await store.put("k1", "v1-updated");
    expect(await store.size()).toBe(2);
    expect(await store.get("k1")).toBe("v1-updated");
    expect(await store.get("k2")).toBe("v2");
    expect(await store.has("k1")).toBe(true);
    expect(await store.has("k2")).toBe(true);
  });

  it("delete returns true for existing keys and false for missing keys", async () => {
    const store = new InMemoryRuntimeStateStore();

    await store.put("keyA", 123);
    expect(await store.has("keyA")).toBe(true);

    const deleted = await store.delete("keyA");
    expect(deleted).toBe(true);
    expect(await store.has("keyA")).toBe(false);
    expect(await store.get("keyA")).toBeUndefined();
    expect(await store.size()).toBe(0);

    const deletedMissing = await store.delete("keyA");
    expect(deletedMissing).toBe(false);

    const deletedNeverExisted = await store.delete("never-existed");
    expect(deletedNeverExisted).toBe(false);
  });

  it("has, keys, size, and clear reflect state transitions correctly", async () => {
    const store = new InMemoryRuntimeStateStore();

    expect(await store.size()).toBe(0);
    expect(await store.keys()).toEqual([]);
    expect(await store.has("x")).toBe(false);

    await store.put("x", 1);
    await store.put("y", 2);

    expect(await store.size()).toBe(2);
    expect(await store.has("x")).toBe(true);
    expect(await store.has("y")).toBe(true);
    expect(await store.has("z")).toBe(false);
    expect(await store.keys()).toEqual(["x", "y"]);

    await store.clear();

    expect(await store.size()).toBe(0);
    expect(await store.keys()).toEqual([]);
    expect(await store.has("x")).toBe(false);
    expect(await store.has("y")).toBe(false);
    expect(await store.get("x")).toBeUndefined();
    expect(await store.get("y")).toBeUndefined();
  });
});
