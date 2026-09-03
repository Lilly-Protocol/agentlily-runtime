import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonFileMemoryStore } from "../src/index.js";

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
  });

  it("satisfies MemoryStore contract with clear(), size(), and countByAgent()", async () => {
    const store = new JsonFileMemoryStore(tempFilePath);

    await store.append({
      agentId: "agent-a",
      taskId: "task-1",
      input: "in 1",
      output: "out 1",
      recordedAt: new Date().toISOString()
    });

    await store.append({
      agentId: "agent-a",
      taskId: "task-2",
      input: "in 2",
      output: "out 2",
      recordedAt: new Date().toISOString()
    });

    await store.append({
      agentId: "agent-b",
      taskId: "task-3",
      input: "in 3",
      output: "out 3",
      recordedAt: new Date().toISOString()
    });

    expect(await store.size()).toBe(3);
    expect(await store.countByAgent("agent-a")).toBe(2);
    expect(await store.countByAgent("agent-b")).toBe(1);

    await store.clear();

    expect(await store.size()).toBe(0);
    expect(await store.listByAgent("agent-a")).toEqual([]);
    expect(await store.countByAgent("agent-a")).toBe(0);
  });

  it("honors offset and limit in listByAgent matching InMemoryMemoryStore semantics", async () => {
    const store = new JsonFileMemoryStore(tempFilePath);

    for (let i = 1; i <= 5; i++) {
      await store.append({
        agentId: "agent-page",
        taskId: `task-${i}`,
        input: `in ${i}`,
        output: `out ${i}`,
        recordedAt: new Date().toISOString()
      });
    }

    const page1 = await store.listByAgent("agent-page", { offset: 0, limit: 2 });
    expect(page1).toHaveLength(2);
    expect(page1[0]?.taskId).toBe("task-1");
    expect(page1[1]?.taskId).toBe("task-2");

    const page2 = await store.listByAgent("agent-page", { offset: 2, limit: 2 });
    expect(page2).toHaveLength(2);
    expect(page2[0]?.taskId).toBe("task-3");
    expect(page2[1]?.taskId).toBe("task-4");

    const page3 = await store.listByAgent("agent-page", { offset: 4, limit: 2 });
    expect(page3).toHaveLength(1);
    expect(page3[0]?.taskId).toBe("task-5");
  });

  it("enforces maxEntries capacity FIFO eviction", async () => {
    const store = new JsonFileMemoryStore(tempFilePath, { maxEntries: 2 });
    expect(store.capacity).toBe(2);

    await store.append({
      agentId: "agent-c",
      taskId: "task-1",
      input: "1",
      output: "1",
      recordedAt: new Date().toISOString()
    });
    await store.append({
      agentId: "agent-c",
      taskId: "task-2",
      input: "2",
      output: "2",
      recordedAt: new Date().toISOString()
    });
    await store.append({
      agentId: "agent-c",
      taskId: "task-3",
      input: "3",
      output: "3",
      recordedAt: new Date().toISOString()
    });

    expect(await store.size()).toBe(2);
    const list = await store.listByAgent("agent-c");
    expect(list.map((e) => e.taskId)).toEqual(["task-2", "task-3"]);
  });
});
