import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryMemoryStore,
  JsonFileMemoryStore,
  type MemoryEntry,
  type MemoryStore
} from "../../src/memory/memory-store.js";

function entry(agentId: string, taskId: string, suffix = ""): MemoryEntry {
  return {
    agentId,
    taskId,
    input: `input-${taskId}${suffix}`,
    output: { taskId },
    recordedAt: new Date().toISOString()
  };
}

describe("JsonFileMemoryStore MemoryStore contract (Issue #230)", () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = join(
      tmpdir(),
      `agentlily-230-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      "task-history.json"
    );
  });

  afterEach(async () => {
    const parentDir = join(tempFilePath, "..");
    if (existsSync(parentDir)) {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("typechecks as a MemoryStore implementation", async () => {
    const store: MemoryStore = new JsonFileMemoryStore(tempFilePath);
    await store.append(entry("a", "t1"));
    const listed = await store.listByAgent("a");
    expect(listed).toHaveLength(1);
    await store.clear?.();
  });

  it("clear empties listByAgent results and leaves an empty backing file", async () => {
    const store = new JsonFileMemoryStore(tempFilePath);
    await store.append(entry("agent-1", "task-1"));
    await store.append(entry("agent-1", "task-2"));
    expect(await store.listByAgent("agent-1")).toHaveLength(2);

    await store.clear();

    expect(await store.listByAgent("agent-1")).toEqual([]);
    expect(await store.size()).toBe(0);
    expect(existsSync(tempFilePath)).toBe(true);
    expect(JSON.parse(await readFile(tempFilePath, "utf-8"))).toEqual([]);
  });

  it("listByAgent offset/limit matches InMemoryMemoryStore slice semantics", async () => {
    const fileStore = new JsonFileMemoryStore(tempFilePath);
    const memoryStore = new InMemoryMemoryStore({ maxEntries: 100 });

    for (let i = 0; i < 5; i++) {
      const e = entry("agent-x", `task-${i}`);
      await fileStore.append(e);
      await memoryStore.append(e);
    }

    const cases: Array<{ offset?: number; limit?: number }> = [
      {},
      { offset: 0, limit: 2 },
      { offset: 2, limit: 2 },
      { offset: 4, limit: 10 },
      { offset: 5, limit: 1 },
      { limit: 3 },
      { offset: 1 }
    ];

    for (const options of cases) {
      const fromFile = await fileStore.listByAgent("agent-x", options);
      const fromMemory = await memoryStore.listByAgent("agent-x", options);
      expect(fromFile.map((e) => e.taskId)).toEqual(
        fromMemory.map((e) => e.taskId)
      );
    }
  });

  it("enforces capacity with FIFO eviction via maxEntries", async () => {
    const store = new JsonFileMemoryStore(tempFilePath, { maxEntries: 2 });
    expect(store.capacity).toBe(2);
    await store.append(entry("a", "t1"));
    await store.append(entry("a", "t2"));
    await store.append(entry("a", "t3"));
    expect(await store.size()).toBe(2);
    const listed = await store.listByAgent("a");
    expect(listed.map((e) => e.taskId)).toEqual(["t2", "t3"]);
  });
});
