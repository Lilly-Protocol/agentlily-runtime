import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonFileMemoryStore, RuntimeError } from "../../src/index.js";

describe("Reproduce Issue #262: Surface corrupt JsonFileMemoryStore files", () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = join(
      tmpdir(),
      `agentlily-corrupt-repro-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      "corrupted-store.json"
    );
  });

  afterEach(async () => {
    const parentDir = dirname(tempFilePath);
    if (existsSync(parentDir)) {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("rejects store.append(), store.listByAgent(), and store.size() with RuntimeError(STORAGE_CORRUPTED)", async () => {
    await mkdir(dirname(tempFilePath), { recursive: true });
    const corruptPayload = "corrupt-data{{{";
    await writeFile(tempFilePath, corruptPayload, "utf-8");

    const store = new JsonFileMemoryStore(tempFilePath);

    await expect(store.size()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RuntimeError);
      expect((err as RuntimeError).code).toBe("STORAGE_CORRUPTED");
      return true;
    });

    await expect(store.listByAgent("agent-1")).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RuntimeError);
      expect((err as RuntimeError).code).toBe("STORAGE_CORRUPTED");
      return true;
    });

    await expect(
      store.append({
        agentId: "agent-1",
        taskId: "task-1",
        input: "input",
        output: "output",
        recordedAt: new Date().toISOString()
      })
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RuntimeError);
      expect((err as RuntimeError).code).toBe("STORAGE_CORRUPTED");
      return true;
    });

    // Assert that the corrupt file on disk is NOT overwritten with []
    const diskContent = await readFile(tempFilePath, "utf-8");
    expect(diskContent).toBe(corruptPayload);
  });

  it("allows empty or whitespace files as []", async () => {
    await mkdir(dirname(tempFilePath), { recursive: true });
    await writeFile(tempFilePath, "   \n\t  \r\n", "utf-8");

    const store = new JsonFileMemoryStore(tempFilePath);
    expect(await store.size()).toBe(0);
    expect(await store.listByAgent("agent-1")).toEqual([]);
  });
});
