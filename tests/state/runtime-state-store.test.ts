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
  it("evicts oldest-inserted keys in FIFO order when maxEntries capacity is exceeded", async () => {
    const store = new InMemoryRuntimeStateStore({ maxEntries: 3 });

    await store.put("key1", "val1");
    await store.put("key2", "val2");
    await store.put("key3", "val3");

    expect(await store.size()).toBe(3);
    expect(await store.keys()).toEqual(["key1", "key2", "key3"]);

    // Overflowing with a 4th key evicts the oldest key (key1)
    await store.put("key4", "val4");

    expect(await store.size()).toBe(3);
    expect(await store.has("key1")).toBe(false);
    expect(await store.get("key1")).toBeUndefined();
    expect(await store.has("key2")).toBe(true);
    expect(await store.has("key3")).toBe(true);
    expect(await store.has("key4")).toBe(true);
    expect(await store.keys()).toEqual(["key2", "key3", "key4"]);

    // Overwriting an existing key at capacity does not trigger eviction
    await store.put("key2", "val2-updated");
    expect(await store.size()).toBe(3);
    expect(await store.get("key2")).toBe("val2-updated");
    expect(await store.has("key3")).toBe(true);
    expect(await store.has("key4")).toBe(true);

    // Overflowing with a 5th key evicts key2 (since Map.set on existing key preserves insertion order)
    await store.put("key5", "val5");
    expect(await store.size()).toBe(3);
    expect(await store.has("key2")).toBe(false);
    expect(await store.get("key2")).toBeUndefined();
    expect(await store.has("key3")).toBe(true);
    expect(await store.has("key4")).toBe(true);
    expect(await store.has("key5")).toBe(true);
    expect(await store.keys()).toEqual(["key3", "key4", "key5"]);
  });

  it("returns true when deleting existing keys and false when deleting missing keys", async () => {
    const store = new InMemoryRuntimeStateStore();
    await store.put("existingKey", "data");

    expect(await store.has("existingKey")).toBe(true);
    const deleteSuccess = await store.delete("existingKey");
    expect(deleteSuccess).toBe(true);
    expect(await store.has("existingKey")).toBe(false);
    expect(await store.get("existingKey")).toBeUndefined();
    expect(await store.size()).toBe(0);

    // Deleting already deleted or missing key returns false
    const deleteMissing = await store.delete("existingKey");
    expect(deleteMissing).toBe(false);

    const deleteNeverExisted = await store.delete("nonExistentKey");
    expect(deleteNeverExisted).toBe(false);
  });

  it("returns consistent results for has(), keys(), size(), and clear() across state transitions", async () => {
    const store = new InMemoryRuntimeStateStore();

    expect(await store.size()).toBe(0);
    expect(await store.keys()).toEqual([]);
    expect(await store.has("alpha")).toBe(false);

    await store.put("alpha", 100);
    await store.put("beta", 200);

    expect(await store.size()).toBe(2);
    expect(await store.has("alpha")).toBe(true);
    expect(await store.has("beta")).toBe(true);
    expect(await store.has("gamma")).toBe(false);
    expect(await store.keys()).toEqual(["alpha", "beta"]);

    // Delete one item
    await store.delete("alpha");
    expect(await store.size()).toBe(1);
    expect(await store.has("alpha")).toBe(false);
    expect(await store.has("beta")).toBe(true);
    expect(await store.keys()).toEqual(["beta"]);

    // Clear all
    await store.clear();
    expect(await store.size()).toBe(0);
    expect(await store.keys()).toEqual([]);
    expect(await store.has("beta")).toBe(false);
    expect(await store.get("beta")).toBeUndefined();
  });
});
