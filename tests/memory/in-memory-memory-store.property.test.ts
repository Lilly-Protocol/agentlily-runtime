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
  // Generate ISO 8601-representable timestamps directly as strings. This
  // avoids Date.prototype.toISOString() throwing RangeError on dates outside
  // 0-9999 (which fc.date() can produce).
  const isoDateStringArb = fc
    .integer({ min: 0, max: 253402300799000 })
    .map((ms) => new Date(ms).toISOString());

  const entryArb: fc.Arbitrary<MemoryEntry> = fc.record({
    agentId: agentIdArb,
    taskId: taskIdArb,
    input: inputArb,
    output: outputArb,
    recordedAt: isoDateStringArb
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
});
