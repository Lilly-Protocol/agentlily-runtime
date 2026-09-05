import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  InMemoryMemoryStore,
  type MemoryEntry
} from "../../src/memory/memory-store.js";

describe("InMemoryMemoryStore property-based tests", () => {
  const agentIdArb = fc.string({ minLength: 1, maxLength: 20 });
  const taskIdArb = fc.string({ minLength: 1, maxLength: 20 });
  const inputArb = fc.string();
  const outputArb = fc.anything();
  const recordedAtArb = fc
    .date({ noInvalidDate: true })
    .filter((d) => !Number.isNaN(d.getTime()))
    .map((d) => d.toISOString());

  const entryArb: fc.Arbitrary<MemoryEntry> = fc.record({
    agentId: agentIdArb,
    taskId: taskIdArb,
    input: inputArb,
    output: outputArb,
    recordedAt: recordedAtArb
  });

  it("listByAgent returns exactly entries for that agent in append order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(entryArb, { minLength: 0, maxLength: 100 }),
        async (entries) => {
          const store = new InMemoryMemoryStore();
          for (const entry of entries) {
            await store.append(entry);
          }

          const uniqueAgents = [
            ...new Set(entries.map((entry: MemoryEntry) => entry.agentId))
          ];
          for (const agentId of uniqueAgents) {
            const expected = entries.filter((e) => e.agentId === agentId);
            const actual = await store.listByAgent(agentId);
            expect(actual).toEqual(expected);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it("append preserves insertion order across mixed agents", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(entryArb, { minLength: 1, maxLength: 100 }),
        async (entries) => {
          const store = new InMemoryMemoryStore();
          for (const entry of entries) {
            await store.append(entry);
          }

          const uniqueAgents = [
            ...new Set(entries.map((entry: MemoryEntry) => entry.agentId))
          ];
          for (const agentId of uniqueAgents) {
            const filtered = entries.filter((e) => e.agentId === agentId);
            const listed = await store.listByAgent(agentId);
            expect(listed.map((e) => e.taskId)).toEqual(
              filtered.map((e) => e.taskId)
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it("listByAgent returns empty array for unknown agent after arbitrary appends", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(entryArb, { maxLength: 50 }),
        agentIdArb,
        async (entries, unknownAgent) => {
          const store = new InMemoryMemoryStore();
          for (const entry of entries) {
            await store.append(entry);
          }

          const wasUsed = entries.some((e) => e.agentId === unknownAgent);
          if (!wasUsed) {
            const result = await store.listByAgent(unknownAgent);
            expect(result).toEqual([]);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it("later appends extend earlier snapshots without reordering them", async () => {
    const AGENT_IDS = [
      "agent-alpha",
      "agent-beta",
      "agent-gamma",
      "agent-delta"
    ] as const;
    const boundedEntryArb: fc.Arbitrary<MemoryEntry> = fc.record({
      agentId: fc.constantFrom(...AGENT_IDS),
      taskId: fc.string({ maxLength: 32 }),
      input: fc.string({ maxLength: 64 }),
      output: fc.oneof(
        fc.string({ maxLength: 64 }),
        fc.integer(),
        fc.boolean()
      ),
      recordedAt: recordedAtArb
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(boundedEntryArb, { maxLength: 120 }),
        fc.constantFrom(...AGENT_IDS),
        async (entries, probeAgent) => {
          const store = new InMemoryMemoryStore();
          const splitAt = Math.floor(entries.length / 2);

          for (const entry of entries.slice(0, splitAt)) {
            await store.append(entry);
          }
          const snapshot = await store.listByAgent(probeAgent);
          expect(snapshot).toEqual(
            entries
              .slice(0, splitAt)
              .filter((entry) => entry.agentId === probeAgent)
          );

          for (const entry of entries.slice(splitAt)) {
            await store.append(entry);
          }
          const later = await store.listByAgent(probeAgent);
          expect(later.slice(0, snapshot.length)).toEqual(snapshot);
          expect(later).toEqual(
            entries.filter((entry) => entry.agentId === probeAgent)
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});
