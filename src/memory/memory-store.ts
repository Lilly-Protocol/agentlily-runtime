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

export interface InMemoryMemoryStoreOptions {
  /** Maximum number of entries to retain in memory before FIFO eviction. Defaults to 10_000. */
  maxEntries?: number;
}

export const DEFAULT_MAX_MEMORY_ENTRIES = 10_000;

export class InMemoryMemoryStore implements MemoryStore {
  private readonly entries: MemoryEntry[] = [];
  public readonly maxEntries: number;

  public constructor(options?: InMemoryMemoryStoreOptions | number) {
    if (typeof options === "number") {
      this.maxEntries = options;
    } else {
      this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_MEMORY_ENTRIES;
    }

    if (this.maxEntries <= 0 || !Number.isFinite(this.maxEntries)) {
      throw new RangeError("maxEntries must be a positive finite integer");
    }
  }

  public get size(): number {
    return this.entries.length;
  }

  public async append(entry: MemoryEntry): Promise<void> {
    if (this.entries.length >= this.maxEntries) {
      this.entries.shift();
    }
    this.entries.push(entry);
  }

  public async listByAgent(agentId: string): Promise<MemoryEntry[]> {
    return this.entries.filter((entry) => entry.agentId === agentId);
  }

  public async clear(): Promise<void> {
    this.entries.length = 0;
  }
}
