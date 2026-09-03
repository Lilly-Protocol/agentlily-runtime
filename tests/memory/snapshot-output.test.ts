import { describe, it, expect } from "vitest";
import { InMemoryMemoryStore } from "../../src/memory/memory-store.js";

describe("InMemoryMemoryStore point-in-time output snapshots", () => {
  it("isolates stored history from mutations to the original output object", async () => {
    const store = new InMemoryMemoryStore();
    const originalOutput = {
      status: "pending",
      details: {
        items: [1, 2, 3],
        meta: { approved: false }
      }
    };

    await store.append({
      agentId: "agent-1",
      taskId: "task-1",
      input: "execute order",
      output: originalOutput,
      recordedAt: new Date().toISOString()
    });

    // Mutate the original output after append
    originalOutput.status = "mutated";
    originalOutput.details.items.push(999);
    originalOutput.details.meta.approved = true;

    const list = await store.listByAgent("agent-1");
    expect(list.length).toBe(1);

    const storedOutput = list[0]?.output as typeof originalOutput;
    expect(storedOutput.status).toBe("pending");
    expect(storedOutput.details.items).toEqual([1, 2, 3]);
    expect(storedOutput.details.meta.approved).toBe(false);
  });

  it("isolates stored history from mutations to objects returned by listByAgent", async () => {
    const store = new InMemoryMemoryStore();
    await store.append({
      agentId: "agent-2",
      taskId: "task-2",
      input: "read data",
      output: { nested: { count: 10 } },
      recordedAt: new Date().toISOString()
    });

    const firstRead = await store.listByAgent("agent-2");
    const output = firstRead[0]?.output as { nested: { count: number } };
    output.nested.count = 999;

    const secondRead = await store.listByAgent("agent-2");
    const secondOutput = secondRead[0]?.output as { nested: { count: number } };
    expect(secondOutput.nested.count).toBe(10);
  });
});
