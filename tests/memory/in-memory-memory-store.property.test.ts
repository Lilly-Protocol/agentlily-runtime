import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { InMemoryMemoryStore, MemoryEntry } from "../../src/memory/memory-store.js";

describe("InMemoryMemoryStore property-based tests", () => {
  const agentIdArb = fc.string({ minLength: 1, maxLength: 20 });
  const taskIdArb = fc.string({ minLength: 1, maxLength: 20 });
  const inputArb = fc.string();
  const outputArb = fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null));

  const entryArb: fc.Arbitrary<MemoryEntry> = fc.record({
    agentId: agentIdArb,
    taskId: taskIdArb,
    input: inputArb,
    output: outputArb,
    recordedAt: fc.date().map((d) => d.toISOString()),
  });

  it("listByAgent returns exactly entries for that agent in append order", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(entryArb, { minLength: 0, maxLength: 50 }), async (entries) => {
        const store = new InMemoryMemoryStore();
        for (const entry of entries) {
          await store.append(entry);
        }

        const uniqueAgents = [...new Set(entries.map((e) => e.agentId))];
        for (const agentId of uniqueAgents) {
          const result = await store.listByAgent(agentId);
          const expected = entries.filter((e) => e.agentId === agentId);
          expect(result).toEqual(expected);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("append preserves insertion order across mixed agents", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(entryArb, { minLength: 1, maxLength: 30 }), async (entries) => {
        const store = new InMemoryMemoryStore();
        for (const entry of entries) {
          await store.append(entry);
        }

        // For each agent, verify ordering matches original append sequence
        const agentIds = [...new Set(entries.map((e) => e.agentId))];
        for (const agentId of agentIds) {
          const listed = await store.listByAgent(agentId);
          const expectedOrder = entries.filter((e) => e.agentId === agentId);
          expect(listed.map((e) => e.taskId)).toEqual(expectedOrder.map((e) => e.taskId));
        }
      }),
      { numRuns: 100 }
    );
  });

  it("listByAgent returns empty array for unknown agent after arbitrary appends", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(entryArb, { maxLength: 20 }), agentIdArb, async (entries, unknownAgent) => {
        const store = new InMemoryMemoryStore();
        // Ensure unknownAgent is not in entries
        const filteredEntries = entries.filter((e) => e.agentId !== unknownAgent);
        for (const entry of filteredEntries) {
          await store.append(entry);
        }
        const result = await store.listByAgent(unknownAgent);
        expect(result).toEqual([]);
      }),
      { numRuns: 50 }
    );
  });
});
