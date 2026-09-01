import { describe, it, expect } from 'vitest';
import { InMemoryMemoryStore } from '../../src/memory/memory-store.js';

describe('InMemoryMemoryStore capacity limit', () => {
  it('uses default maxEntries of 10000', () => {
    const store = new InMemoryMemoryStore();
    expect(store.capacity).toBe(10_000);
  });

  it('accepts custom maxEntries via constructor', () => {
    const store = new InMemoryMemoryStore({ maxEntries: 50 });
    expect(store.capacity).toBe(50);
  });

  it('evicts oldest entries when capacity is exceeded (FIFO)', async () => {
    const store = new InMemoryMemoryStore({ maxEntries: 3 });

    await store.append({ agentId: 'a1', taskId: 't1', input: 'first', output: null, recordedAt: '2026-01-01T00:00:00Z' });
    await store.append({ agentId: 'a1', taskId: 't2', input: 'second', output: null, recordedAt: '2026-01-01T00:00:01Z' });
    await store.append({ agentId: 'a1', taskId: 't3', input: 'third', output: null, recordedAt: '2026-01-01T00:00:02Z' });
    await store.append({ agentId: 'a1', taskId: 't4', input: 'fourth', output: null, recordedAt: '2026-01-01T00:00:03Z' });

    expect(store.size).toBe(3);

    const entries = await store.listByAgent('a1');
    expect(entries.map(e => e.taskId)).toEqual(['t2', 't3', 't4']);
  });

  it('does not evict when under capacity', async () => {
    const store = new InMemoryMemoryStore({ maxEntries: 100 });

    for (let i = 0; i < 50; i++) {
      await store.append({ agentId: 'a1', taskId: `t${i}`, input: `input-${i}`, output: null, recordedAt: new Date().toISOString() });
    }

    expect(store.size).toBe(50);
  });

  it('size returns current entry count', async () => {
    const store = new InMemoryMemoryStore({ maxEntries: 100 });
    expect(store.size).toBe(0);

    await store.append({ agentId: 'a1', taskId: 't1', input: 'x', output: null, recordedAt: new Date().toISOString() });
    expect(store.size).toBe(1);

    await store.append({ agentId: 'a1', taskId: 't2', input: 'y', output: null, recordedAt: new Date().toISOString() });
    expect(store.size).toBe(2);
  });

  it('listByAgent works correctly after eviction', async () => {
    const store = new InMemoryMemoryStore({ maxEntries: 4 });

    await store.append({ agentId: 'a1', taskId: 't1', input: 'old-a1', output: null, recordedAt: '2026-01-01T00:00:00Z' });
    await store.append({ agentId: 'a2', taskId: 't2', input: 'old-a2', output: null, recordedAt: '2026-01-01T00:00:01Z' });
    await store.append({ agentId: 'a1', taskId: 't3', input: 'mid-a1', output: null, recordedAt: '2026-01-01T00:00:02Z' });
    await store.append({ agentId: 'a2', taskId: 't4', input: 'mid-a2', output: null, recordedAt: '2026-01-01T00:00:03Z' });
    // This evicts t1 (oldest)
    await store.append({ agentId: 'a1', taskId: 't5', input: 'new-a1', output: null, recordedAt: '2026-01-01T00:00:04Z' });

    const a1Entries = await store.listByAgent('a1');
    expect(a1Entries.map(e => e.taskId)).toEqual(['t3', 't5']);

    const a2Entries = await store.listByAgent('a2');
    expect(a2Entries.map(e => e.taskId)).toEqual(['t2', 't4']);
  });
});
