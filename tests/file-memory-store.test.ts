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

  it("handles empty and whitespace-only files gracefully as empty history", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(tempFilePath), { recursive: true });
    await writeFile(tempFilePath, "   \n\t  ", "utf-8");

    const store = new JsonFileMemoryStore(tempFilePath);
    const entries = await store.listByAgent("agent-empty");
    expect(entries).toEqual([]);

    await store.append({
      agentId: "agent-empty",
      taskId: "task-new",
      input: "input",
      output: "ok",
      recordedAt: new Date().toISOString()
    });
    const updated = await store.listByAgent("agent-empty");
    expect(updated).toHaveLength(1);
  });

  it("throws RuntimeError with code STORAGE_CORRUPTION when JSON file is invalid/corrupt", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(tempFilePath), { recursive: true });
    await writeFile(tempFilePath, "{\"truncated\": true, invalid_json...", "utf-8");

    const store = new JsonFileMemoryStore(tempFilePath);

    await expect(store.listByAgent("any-agent")).rejects.toThrowError(
      /Corrupted JsonFileMemoryStore file/
    );

    try {
      await store.append({
        agentId: "agent-1",
        taskId: "task-1",
        input: "in",
        output: "out",
        recordedAt: new Date().toISOString()
      });
      expect.unreachable("append should have failed on corrupted file");
    } catch (err: any) {
      expect(err.name).toBe("RuntimeError");
      expect(err.code).toBe("STORAGE_CORRUPTION");
      expect(err.details?.filePath).toBe(tempFilePath);
    }
  });

  it("throws RuntimeError with code STORAGE_CORRUPTION when JSON root is not an array", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(tempFilePath), { recursive: true });
    await writeFile(tempFilePath, JSON.stringify({ notAnArray: true }), "utf-8");

    const store = new JsonFileMemoryStore(tempFilePath);

    await expect(store.listByAgent("any-agent")).rejects.toMatchObject({
      code: "STORAGE_CORRUPTION"
    });
  });
});
