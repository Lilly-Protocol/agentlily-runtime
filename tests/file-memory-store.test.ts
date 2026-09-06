import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonFileMemoryStore, RuntimeError } from "../src/index.js";

describe("JsonFileMemoryStore", () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = join(
      tmpdir(),
      `agentlily-memory-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      "task-history.json"
    );
  });

  afterEach(async () => {
    const parentDir = join(tempFilePath, "..");
    if (existsSync(parentDir)) {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("appends and persists entries to disk", async () => {
    const store = new JsonFileMemoryStore(tempFilePath);
    expect(store.getFilePath()).toBe(tempFilePath);

    await store.append({
      agentId: "agent-1",
      taskId: "task-1",
      input: "Input 1",
      output: { result: "Success 1" },
      recordedAt: new Date().toISOString()
    });

    await store.append({
      agentId: "agent-1",
      taskId: "task-2",
      input: "Input 2",
      output: { result: "Success 2" },
      recordedAt: new Date().toISOString()
    });

    await store.append({
      agentId: "agent-2",
      taskId: "task-3",
      input: "Input 3",
      output: { result: "Success 3" },
      recordedAt: new Date().toISOString()
    });

    expect(existsSync(tempFilePath)).toBe(true);

    const agent1Entries = await store.listByAgent("agent-1");
    expect(agent1Entries).toHaveLength(2);
    expect(agent1Entries[0]?.taskId).toBe("task-1");
    expect(agent1Entries[1]?.taskId).toBe("task-2");

    const agent2Entries = await store.listByAgent("agent-2");
    expect(agent2Entries).toHaveLength(1);
    expect(agent2Entries[0]?.taskId).toBe("task-3");
  });

  it("retains entries across separate store instances sharing the same file path", async () => {
    const initialStore = new JsonFileMemoryStore(tempFilePath);
    await initialStore.append({
      agentId: "agent-persist",
      taskId: "task-p1",
      input: "Durable Input",
      output: { status: "persisted" },
      recordedAt: "2026-08-30T12:00:00.000Z"
    });

    const secondStoreInstance = new JsonFileMemoryStore(tempFilePath);
    const loadedEntries =
      await secondStoreInstance.listByAgent("agent-persist");

    expect(loadedEntries).toHaveLength(1);
    expect(loadedEntries[0]).toEqual({
      agentId: "agent-persist",
      taskId: "task-p1",
      input: "Durable Input",
      output: { status: "persisted" },
      recordedAt: "2026-08-30T12:00:00.000Z"
    });
  });

  it("returns empty list when file does not exist yet", async () => {
    const store = new JsonFileMemoryStore(tempFilePath);
    const entries = await store.listByAgent("nonexistent-agent");
    expect(entries).toEqual([]);
    expect(await store.size()).toBe(0);
    expect(await store.countByAgent("nonexistent-agent")).toBe(0);
  });

  it("handles empty file safely and rejects malformed or non-array file with STORAGE_CORRUPTED", async () => {
    await mkdir(dirname(tempFilePath), { recursive: true });
    await writeFile(tempFilePath, "   \n  ", "utf-8");

    const emptyStore = new JsonFileMemoryStore(tempFilePath);
    expect(await emptyStore.size()).toBe(0);
    expect(await emptyStore.listByAgent("agent-1")).toEqual([]);

    await writeFile(tempFilePath, "not-valid-json", "utf-8");
    const malformedStore = new JsonFileMemoryStore(tempFilePath);
    await expect(malformedStore.size()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RuntimeError);
      expect((err as RuntimeError).code).toBe("STORAGE_CORRUPTED");
      return true;
    });
    await expect(malformedStore.listByAgent("agent-1")).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RuntimeError);
      expect((err as RuntimeError).code).toBe("STORAGE_CORRUPTED");
      return true;
    });

    await writeFile(tempFilePath, JSON.stringify({ notAnArray: true }), "utf-8");
    const objectStore = new JsonFileMemoryStore(tempFilePath);
    await expect(objectStore.size()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RuntimeError);
      expect((err as RuntimeError).code).toBe("STORAGE_CORRUPTED");
      return true;
    });
    await expect(objectStore.listByAgent("agent-1")).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RuntimeError);
      expect((err as RuntimeError).code).toBe("STORAGE_CORRUPTED");
      return true;
    });
  });

  it("supports pagination in listByAgent", async () => {
    const store = new JsonFileMemoryStore(tempFilePath);
    for (let i = 1; i <= 5; i++) {
      await store.append({
        agentId: "agent-page",
        taskId: `task-${i}`,
        input: `input-${i}`,
        output: null,
        recordedAt: new Date().toISOString()
      });
    }

    const page1 = await store.listByAgent("agent-page", { offset: 0, limit: 2 });
    expect(page1.map((e) => e.taskId)).toEqual(["task-1", "task-2"]);

    const page2 = await store.listByAgent("agent-page", { offset: 2, limit: 2 });
    expect(page2.map((e) => e.taskId)).toEqual(["task-3", "task-4"]);

    const page3 = await store.listByAgent("agent-page", { offset: 4, limit: 2 });
    expect(page3.map((e) => e.taskId)).toEqual(["task-5"]);

    const beyond = await store.listByAgent("agent-page", { offset: 10, limit: 2 });
    expect(beyond).toEqual([]);
  });

  it("counts entries by agent and returns total size", async () => {
    const store = new JsonFileMemoryStore(tempFilePath);
    await store.append({
      agentId: "agent-x",
      taskId: "t1",
      input: "x1",
      output: null,
      recordedAt: new Date().toISOString()
    });
    await store.append({
      agentId: "agent-x",
      taskId: "t2",
      input: "x2",
      output: null,
      recordedAt: new Date().toISOString()
    });
    await store.append({
      agentId: "agent-y",
      taskId: "t3",
      input: "y1",
      output: null,
      recordedAt: new Date().toISOString()
    });

    expect(await store.countByAgent("agent-x")).toBe(2);
    expect(await store.countByAgent("agent-y")).toBe(1);
    expect(await store.countByAgent("agent-z")).toBe(0);
    expect(await store.size()).toBe(3);
  });

  it("clears all entries and flushes empty array to disk", async () => {
    const store = new JsonFileMemoryStore(tempFilePath);
    await store.append({
      agentId: "agent-clear",
      taskId: "t1",
      input: "clear me",
      output: null,
      recordedAt: new Date().toISOString()
    });

    expect(await store.size()).toBe(1);

    await store.clear();

    expect(await store.size()).toBe(0);
    expect(await store.listByAgent("agent-clear")).toEqual([]);

    const reloaded = new JsonFileMemoryStore(tempFilePath);
    expect(await reloaded.size()).toBe(0);
    expect(await reloaded.listByAgent("agent-clear")).toEqual([]);
  });

  it("enforces maxEntries and maxEntriesPerAgent capacity limits", async () => {
    expect(() => new JsonFileMemoryStore(tempFilePath, { maxEntries: -1 })).toThrow(RangeError);
    expect(() => new JsonFileMemoryStore(tempFilePath, { maxEntries: 0 })).toThrow(RangeError);

    const store = new JsonFileMemoryStore(tempFilePath, {
      maxEntries: 3,
      maxEntriesPerAgent: 2
    });
    expect(store.capacity).toBe(3);

    await store.append({
      agentId: "a1",
      taskId: "t1",
      input: "a1-1",
      output: null,
      recordedAt: new Date().toISOString()
    });
    await store.append({
      agentId: "a1",
      taskId: "t2",
      input: "a1-2",
      output: null,
      recordedAt: new Date().toISOString()
    });
    await store.append({
      agentId: "a1",
      taskId: "t3",
      input: "a1-3",
      output: null,
      recordedAt: new Date().toISOString()
    });

    // Per-agent eviction kicked in: maxEntriesPerAgent is 2
    const a1Entries = await store.listByAgent("a1");
    expect(a1Entries.map((e) => e.taskId)).toEqual(["t2", "t3"]);

    // Global eviction check
    await store.append({
      agentId: "a2",
      taskId: "t4",
      input: "a2-1",
      output: null,
      recordedAt: new Date().toISOString()
    });
    await store.append({
      agentId: "a2",
      taskId: "t5",
      input: "a2-2",
      output: null,
      recordedAt: new Date().toISOString()
    });

    expect(await store.size()).toBe(3);
  });

  it("handles concurrent appends across multiple JsonFileMemoryStore instances without lost updates", async () => {
    const store1 = new JsonFileMemoryStore(tempFilePath);
    const store2 = new JsonFileMemoryStore(tempFilePath);

    const count = 20;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < count; i++) {
      promises.push(
        store1.append({
          agentId: "agent-multi",
          taskId: `store1-task-${i}`,
          input: `Input 1-${i}`,
          output: { i },
          recordedAt: new Date().toISOString()
        })
      );
      promises.push(
        store2.append({
          agentId: "agent-multi",
          taskId: `store2-task-${i}`,
          input: `Input 2-${i}`,
          output: { i },
          recordedAt: new Date().toISOString()
        })
      );
    }

    await Promise.all(promises);

    const checkStore = new JsonFileMemoryStore(tempFilePath);
    const entries = await checkStore.listByAgent("agent-multi");
    expect(entries).toHaveLength(count * 2);

    const taskIds = new Set(entries.map((e) => e.taskId));
    for (let i = 0; i < count; i++) {
      expect(taskIds.has(`store1-task-${i}`)).toBe(true);
      expect(taskIds.has(`store2-task-${i}`)).toBe(true);
    }
  });

  it("handles concurrent appends on a single cold cache instance without lost updates", async () => {
    const store = new JsonFileMemoryStore(tempFilePath);
    const count = 30;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < count; i++) {
      promises.push(
        store.append({
          agentId: "agent-single",
          taskId: `task-${i}`,
          input: `Input ${i}`,
          output: { i },
          recordedAt: new Date().toISOString()
        })
      );
    }

    await Promise.all(promises);

    const entries = await store.listByAgent("agent-single");
    expect(entries).toHaveLength(count);
  });

  it("supports countByAgent and clear operations across serialized instances", async () => {
    const store = new JsonFileMemoryStore(tempFilePath);
    await store.append({
      agentId: "agent-count",
      taskId: "task-c1",
      input: "c1",
      output: {},
      recordedAt: new Date().toISOString()
    });
    await store.append({
      agentId: "agent-count",
      taskId: "task-c2",
      input: "c2",
      output: {},
      recordedAt: new Date().toISOString()
    });
    await store.append({
      agentId: "other-agent",
      taskId: "task-o1",
      input: "o1",
      output: {},
      recordedAt: new Date().toISOString()
    });

    const count = await store.countByAgent("agent-count");
    expect(count).toBe(2);

    const otherStore = new JsonFileMemoryStore(tempFilePath);
    await otherStore.clear();

    const emptyCount = await store.countByAgent("agent-count");
    expect(emptyCount).toBe(0);
    const emptyList = await store.listByAgent("agent-count");
    expect(emptyList).toEqual([]);
  });
});
