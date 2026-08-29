export interface MemoryEntry {
  agentId: string;
  taskId: string;
  input: string;
  output: unknown;
  recordedAt: string;
}

export interface ListMemoryOptions {
  limit?: number;
  offset?: number;
}

export interface InMemoryMemoryStoreOptions {
  /**
   * Maximum total entries retained across all agents.
   * Default: 10,000. Set to 0 for unbounded (not recommended in production).
   */
  maxEntries?: number;
  /**
   * Maximum entries retained per individual agent.
   * Default: 1,000. Set to 0 for unbounded.
   */
  maxEntriesPerAgent?: number;
}

export interface MemoryStore {
  append(entry: MemoryEntry): Promise<void>;
  listByAgent(
    agentId: string,
    options?: ListMemoryOptions
  ): Promise<MemoryEntry[]>;
  countByAgent?(agentId: string): Promise<number>;
  clear?(): Promise<void>;
  size?(): Promise<number>;
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly entries: MemoryEntry[] = [];
  private readonly maxEntries: number;
  private readonly maxEntriesPerAgent: number;

  public constructor(options: InMemoryMemoryStoreOptions = {}) {
    this.maxEntries = options.maxEntries ?? 10_000;
    this.maxEntriesPerAgent = options.maxEntriesPerAgent ?? 1_000;
  }

  public async append(entry: MemoryEntry): Promise<void> {
    // Clone entry defensively
    const entryCopy: MemoryEntry = {
      agentId: entry.agentId,
      taskId: entry.taskId,
      input: entry.input,
      output: entry.output,
      recordedAt: entry.recordedAt
    };

    // Check per-agent limit
    if (this.maxEntriesPerAgent > 0) {
      let agentCount = 0;
      let oldestAgentIndex = -1;

      for (let i = 0; i < this.entries.length; i++) {
        if (this.entries[i]?.agentId === entryCopy.agentId) {
          if (oldestAgentIndex === -1) {
            oldestAgentIndex = i;
          }
          agentCount++;
        }
      }

      if (agentCount >= this.maxEntriesPerAgent && oldestAgentIndex !== -1) {
        this.entries.splice(oldestAgentIndex, 1);
      }
    }

    // Check global capacity limit
    if (this.maxEntries > 0 && this.entries.length >= this.maxEntries) {
      // Evict oldest entry (FIFO)
      this.entries.shift();
    }

    this.entries.push(entryCopy);
  }

  public async listByAgent(
    agentId: string,
    options?: ListMemoryOptions
  ): Promise<MemoryEntry[]> {
    const matching = this.entries.filter((entry) => entry.agentId === agentId);
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? matching.length;

    const slice = matching.slice(offset, offset + limit);
    return slice.map((entry) => ({ ...entry }));
  }

  public async countByAgent(agentId: string): Promise<number> {
    let count = 0;
    for (const entry of this.entries) {
      if (entry.agentId === agentId) {
        count++;
      }
    }
    return count;
  }

  public async size(): Promise<number> {
    return this.entries.length;
  }

  public async clear(): Promise<void> {
    this.entries.length = 0;
  }
}
