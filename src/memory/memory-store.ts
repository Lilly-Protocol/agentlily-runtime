export interface MemoryEntry {
  agentId: string;
  taskId: string;
  input: string;
  output: unknown;
  recordedAt: string;
}

export interface MemoryStore {
  append(entry: MemoryEntry): Promise<void>;
  listByAgent(agentId: string): Promise<MemoryEntry[]>;
}

const DEFAULT_MAX_ENTRIES = 10_000;

export interface InMemoryMemoryStoreOptions {
  /** Maximum number of entries to retain. Oldest entries are evicted when exceeded. Default: 10,000. */
  maxEntries?: number;
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly entries: MemoryEntry[] = [];
  private readonly maxEntries: number;

  public constructor(options?: InMemoryMemoryStoreOptions) {
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  public async append(entry: MemoryEntry): Promise<void> {
    this.entries.push(entry);

    // Evict oldest entries when capacity is exceeded (FIFO policy)
    while (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  public async listByAgent(agentId: string): Promise<MemoryEntry[]> {
    return this.entries.filter((entry) => entry.agentId === agentId);
  }

  /** Returns the current number of stored entries. */
  public get size(): number {
    return this.entries.length;
  }

  /** Returns the configured maximum capacity. */
  public get capacity(): number {
    return this.maxEntries;
  }
}
