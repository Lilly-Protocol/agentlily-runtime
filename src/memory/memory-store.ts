import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

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
   * Maximum total entries retained across all agents before FIFO eviction.
   * Default: 10,000.
   */
  maxEntries?: number;
  /**
   * Maximum entries retained per individual agent before FIFO eviction.
   * Default: 1,000. Set to 0 for unbounded per-agent growth.
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
}

export const DEFAULT_MAX_MEMORY_ENTRIES = 10_000;
export const DEFAULT_MAX_MEMORY_ENTRIES_PER_AGENT = 1_000;

const cloneOutput = (val: unknown): unknown => {
  if (val === null || typeof val !== "object") {
    return val;
  }
  try {
    return structuredClone(val);
  } catch {
    try {
      return JSON.parse(JSON.stringify(val));
    } catch {
      return val;
    }
  }
};

export class InMemoryMemoryStore implements MemoryStore {
  private readonly entries: MemoryEntry[] = [];

  public readonly maxEntries: number;
  public readonly maxEntriesPerAgent: number;

  public constructor(options: InMemoryMemoryStoreOptions | number = {}) {
    const resolved =
      typeof options === "number" ? { maxEntries: options } : options;
    const maxEntries = resolved.maxEntries ?? DEFAULT_MAX_MEMORY_ENTRIES;

    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError("maxEntries must be a positive integer.");
    }

    this.maxEntries = maxEntries;
    this.maxEntriesPerAgent =
      resolved.maxEntriesPerAgent ?? DEFAULT_MAX_MEMORY_ENTRIES_PER_AGENT;
  }

  public get capacity(): number {
    return this.maxEntries;
  }

  public get size(): number {
    return this.entries.length;
  }

  public async append(entry: MemoryEntry): Promise<void> {
    // Clone entry defensively so external mutation cannot corrupt store state.
    const entryCopy: MemoryEntry = {
      agentId: entry.agentId,
      taskId: entry.taskId,
      input: entry.input,
      output: cloneOutput(entry.output),
      recordedAt: entry.recordedAt
    };

    // Enforce the per-agent limit by evicting that agent's oldest entry.
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

    // Enforce the global capacity limit by evicting the oldest entry (FIFO).
    if (this.entries.length >= this.maxEntries) {
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
    return slice.map((entry) => ({
      ...entry,
      output: cloneOutput(entry.output)
    }));
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

  public async clear(): Promise<void> {
    this.entries.length = 0;
  }
}

export class JsonFileMemoryStore implements MemoryStore {
  private readonly filePath: string;
  private memoryCache: MemoryEntry[] | null = null;

  public constructor(filePath: string) {
    this.filePath = filePath;
  }

  public getFilePath(): string {
    return this.filePath;
  }

  private async loadEntries(): Promise<MemoryEntry[]> {
    if (this.memoryCache !== null) {
      return this.memoryCache;
    }

    if (!existsSync(this.filePath)) {
      this.memoryCache = [];
      return this.memoryCache;
    }

    try {
      const raw = await readFile(this.filePath, "utf-8");
      if (raw.trim().length === 0) {
        this.memoryCache = [];
        return this.memoryCache;
      }
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.memoryCache = parsed as MemoryEntry[];
      } else {
        this.memoryCache = [];
      }
    } catch {
      this.memoryCache = [];
    }

    return this.memoryCache;
  }

  private async flush(): Promise<void> {
    const dir = dirname(this.filePath);
    if (dir && dir !== "." && !existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const data = JSON.stringify(this.memoryCache ?? [], null, 2);
    await writeFile(this.filePath, data, "utf-8");
  }

  public async append(entry: MemoryEntry): Promise<void> {
    const entries = await this.loadEntries();
    entries.push(entry);
    await this.flush();
  }

  public async listByAgent(agentId: string): Promise<MemoryEntry[]> {
    const entries = await this.loadEntries();
    return entries.filter((entry) => entry.agentId === agentId);
  }

  public async clear(): Promise<void> {
    this.memoryCache = [];
    await this.flush();
  }
}
