import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { InMemoryMemoryStore, type MemoryEntry } from "../src/index.js";

const AGENT_IDS = [
  "agent-alpha",
  "agent-beta",
  "agent-gamma",
  "agent-delta"
] as const;

const entryArb: fc.Arbitrary<MemoryEntry> = fc.record({
  agentId: fc.constantFrom(...AGENT_IDS),
  taskId: fc.string({ maxLength: 32 }),
  input: fc.string({ maxLength: 64 }),
  output: fc.oneof(fc.string({ maxLength: 64 }), fc.integer(), fc.boolean()),
  recordedAt: fc
    .date()
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => date.toISOString())
});

describe("InMemoryMemoryStore property-based invariants", () => {
  it("listByAgent returns exactly the appended entries for the agent, in append order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(entryArb, { maxLength: 150 }),
        fc.constantFrom(...AGENT_IDS),
        async (entries, probeAgent) => {
          const store = new InMemoryMemoryStore();
          for (const entry of entries) {
            await store.append(entry);
          }

          const actual = await store.listByAgent(probeAgent);
          const expected = entries.filter(
            (entry) => entry.agentId === probeAgent
          );

          // Per-agent filter correctness: entries from other agents never leak in.
          expect(actual.every((entry) => entry.agentId === probeAgent)).toBe(
            true
          );
          // Append-order invariant: results keep the relative append sequence.
          expect(actual).toEqual(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("later appends extend earlier snapshots without reordering them", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(entryArb, { maxLength: 120 }),
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
          // Previously observed entries stay in front, in the same relative order.
          expect(later.slice(0, snapshot.length)).toEqual(snapshot);
          expect(later).toEqual(
            entries.filter((entry) => entry.agentId === probeAgent)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns an empty list for agents with no entries, even after appends", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(entryArb, { maxLength: 80 }),
        async (entries) => {
          const store = new InMemoryMemoryStore();
          for (const entry of entries) {
            await store.append(entry);
          }
          const used = new Set(entries.map((entry) => entry.agentId));
          const unused = AGENT_IDS.find((id) => !used.has(id));
          if (unused !== undefined) {
            expect(await store.listByAgent(unused)).toEqual([]);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
