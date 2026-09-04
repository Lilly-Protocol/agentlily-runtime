import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryMemoryStore,
  JsonFileMemoryStore,
  type MemoryEntry,
  type MemoryStore
} from "../../src/memory/memory-store.js";

describe("Issue #230: JsonFileMemoryStore contract satisfaction", () => {
  let tempFilePath: string;
  let jsonStore: JsonFileMemoryStore;
  let memoryStore: InMemoryMemoryStore;

  const sampleEntries: MemoryEntry[] = [
    {
      agentId: "agent-a",
      taskId: "task-1",
      input: "input 1",
      output: { res: 1 },
      recordedAt: "2026-09-01T10:00:00.000Z"
    },
    {
      agentId: "agent-a",
      taskId: "task-2",
      input: "input 2",
      output: { res: 2 },
      recordedAt: "2026-09-01T10:01:00.000Z"
    },
    {
      agentId: "agent-a",
      taskId: "task-3",
      input: "input 3",
      output: { res: 3 },
      recordedAt: "2026-09-01T10:02:00.000Z"
    },
    {
      agentId: "agent-a",
      taskId: "task-4",
      input: "input 4",
      output: { res: 4 },
      recordedAt: "2026-09-01T10:03:00.000Z"
    },
    {
      agentId: "agent-b",
      taskId: "task-5",
      input: "input 5",
      output: { res: 5 },
      recordedAt: "2026-09-01T10:04:00.000Z"
    }
  ];

  beforeEach(async () => {
    tempFilePath = join(
      tmpdir(),
      `agentlily-repro-230-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      "store.json"
    );
    jsonStore = new JsonFileMemoryStore(tempFilePath);
    memoryStore = new InMemoryMemoryStore();

    for (const entry of sampleEntries) {
      await jsonStore.append(entry);
      await memoryStore.append(entry);
    }
  });

  afterEach(async () => {
    const parentDir = dirname(tempFilePath);
    if (existsSync(parentDir)) {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("typechecks as an implementation of MemoryStore interface", () => {
    const store: MemoryStore = jsonStore;
    expect(store).toBeDefined();
    expect(typeof store.append).toBe("function");
    expect(typeof store.listByAgent).toBe("function");
  });

  it("matches InMemoryMemoryStore slice semantics for listByAgent pagination ({ offset, limit })", async () => {
    const optionsList = [
      { offset: 1, limit: 2 },
      { offset: 0, limit: 2 },
      { offset: 2, limit: 10 },
      { offset: 5, limit: 2 },
      { offset: 0, limit: 0 }
    ];

    for (const opts of optionsList) {
      const memResult = await memoryStore.listByAgent("agent-a", opts);
      const jsonResult = await jsonStore.listByAgent("agent-a", opts);

      expect(jsonResult).toEqual(memResult);
    }
  });

  it("defensively copies returned entries from listByAgent to prevent store mutation", async () => {
    const entries = await jsonStore.listByAgent("agent-a", { offset: 0, limit: 1 });
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry).toBeDefined();

    if (entry) {
      entry.input = "MUTATED_INPUT";
    }

    const freshEntries = await jsonStore.listByAgent("agent-a", { offset: 0, limit: 1 });
    expect(freshEntries[0]?.input).toBe("input 1");
  });

  it("defensively copies entry on append to prevent caller mutation", async () => {
    const payload: MemoryEntry = {
      agentId: "agent-mutate",
      taskId: "task-m",
      input: "original input",
      output: null,
      recordedAt: "2026-09-01T12:00:00.000Z"
    };

    await jsonStore.append(payload);
    payload.input = "EXTERNAL_MUTATION";

    const entries = await jsonStore.listByAgent("agent-mutate");
    expect(entries[0]?.input).toBe("original input");
  });

  it("counts matching entries by agent via countByAgent", async () => {
    expect(typeof jsonStore.countByAgent).toBe("function");
    const countA = await jsonStore.countByAgent("agent-a");
    const countB = await jsonStore.countByAgent("agent-b");
    const countNone = await jsonStore.countByAgent("agent-none");

    expect(countA).toBe(4);
    expect(countB).toBe(1);
    expect(countNone).toBe(0);
  });

  it("returns total entries asynchronously via size()", async () => {
    expect(typeof jsonStore.size).toBe("function");
    const totalSize = await jsonStore.size();
    expect(totalSize).toBe(5);
  });

  it("empties subsequent queries and flushes empty array to disk on clear()", async () => {
    await jsonStore.clear();

    const remainingAgentA = await jsonStore.listByAgent("agent-a");
    expect(remainingAgentA).toEqual([]);

    const remainingTotal = typeof jsonStore.size === "function" ? await jsonStore.size() : null;
    expect(remainingTotal).toBe(0);

    const fileContent = await readFile(tempFilePath, "utf-8");
    const parsed = JSON.parse(fileContent);
    expect(parsed).toEqual([]);
  });
});
