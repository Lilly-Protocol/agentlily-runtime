import { describe, expect, it } from "vitest";
import { InMemoryMemoryStore, type MemoryEntry } from "../../src/memory/memory-store.js";

describe("InMemoryMemoryStore snapshot outputs (#260)", () => {
  it("snapshots output on append so mutating the original object does not corrupt stored history", async () => {
    const store = new InMemoryMemoryStore();
    const outputData: { nested: { count: number; items: string[] } } = {
      nested: {
        count: 1,
        items: ["alpha"],
      },
    };

    const entry: MemoryEntry = {
      agentId: "agent-1",
      taskId: "task-1",
      input: "do work",
      output: outputData,
      recordedAt: new Date().toISOString(),
    };

    await store.append(entry);

    // Mutate the original output object
    outputData.nested.count = 999;
    outputData.nested.items.push("beta", "gamma");

    const history = await store.listByAgent("agent-1");
    expect(history).toHaveLength(1);
    expect(history[0]?.output).toEqual({
      nested: {
        count: 1,
        items: ["alpha"],
      },
    });
  });

  it("returns independent copies from listByAgent so caller mutations do not affect subsequent reads", async () => {
    const store = new InMemoryMemoryStore();
    const outputData = { results: ["foo", "bar"], meta: { score: 10 } };

    await store.append({
      agentId: "agent-1",
      taskId: "task-2",
      input: "test",
      output: outputData,
      recordedAt: new Date().toISOString(),
    });

    const firstRead = await store.listByAgent("agent-1");
    expect(firstRead).toHaveLength(1);

    // Mutate the returned entry and output
    (firstRead[0]?.output as { results: string[] }).results.push("corrupted");
    (firstRead[0]?.output as { meta: { score: number } }).meta.score = 0;

    const secondRead = await store.listByAgent("agent-1");
    expect(secondRead).toHaveLength(1);
    expect(secondRead[0]?.output).toEqual({
      results: ["foo", "bar"],
      meta: { score: 10 },
    });
  });

  it("handles primitive, null, and non-plain outputs gracefully", async () => {
    const store = new InMemoryMemoryStore();

    await store.append({
      agentId: "agent-1",
      taskId: "task-primitive",
      input: "p",
      output: "string-output",
      recordedAt: new Date().toISOString(),
    });

    await store.append({
      agentId: "agent-1",
      taskId: "task-null",
      input: "n",
      output: null,
      recordedAt: new Date().toISOString(),
    });

    const results = await store.listByAgent("agent-1");
    expect(results).toHaveLength(2);
    expect(results[0]?.output).toBe("string-output");
    expect(results[1]?.output).toBeNull();
  });
});
