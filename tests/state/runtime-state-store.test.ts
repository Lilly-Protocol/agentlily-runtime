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

  it("lists keys in insertion order and removes deleted keys", async () => {
    const store = new InMemoryRuntimeStateStore();
    await store.put("first", 1);
    await store.put("second", 2);

    expect(await store.keys()).toEqual(["first", "second"]);
    expect(await store.has("first")).toBe(true);
    expect(await store.delete("first")).toBe(true);
    expect(await store.keys()).toEqual(["second"]);
  });

  it("evicts the oldest key at capacity but not when replacing a key", async () => {
    const store = new InMemoryRuntimeStateStore({ maxEntries: 2 });
    await store.put("first", 1);
    await store.put("second", 2);
    await store.put("first", 10);

    expect(await store.keys()).toEqual(["first", "second"]);

    await store.put("third", 3);
    expect(await store.keys()).toEqual(["second", "third"]);
    expect(await store.get("first")).toBeUndefined();
  });

  it("supports an explicitly unbounded store and clear", async () => {
    const store = new InMemoryRuntimeStateStore({ maxEntries: 0 });
    await store.put("first", 1);
    await store.put("second", 2);

    expect(await store.size()).toBe(2);
    await store.clear();
    expect(await store.keys()).toEqual([]);
  });
});
