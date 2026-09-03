import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

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
      output: entry.output,
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

  public async clear(): Promise<void> {
    this.entries.length = 0;
  }
}

// Global write serialization queues keyed by normalized canonical file path
const fileWriteQueues = new Map<string, Promise<unknown>>();

const serializeFileOperation = <T>(
  filePath: string,
  operation: () => Promise<T>
): Promise<T> => {
  const canonicalPath = resolve(filePath);
  const currentQueue = fileWriteQueues.get(canonicalPath) ?? Promise.resolve();

  const nextPromise = currentQueue
    .catch(() => {})
    .then(async () => {
      return await operation();
    });

  fileWriteQueues.set(canonicalPath, nextPromise);

  nextPromise.finally(() => {
    if (fileWriteQueues.get(canonicalPath) === nextPromise) {
      fileWriteQueues.delete(canonicalPath);
    }
  });

  return nextPromise;
};

export class JsonFileMemoryStore implements MemoryStore {
  private readonly filePath: string;
  private memoryCache: MemoryEntry[] | null = null;

  public constructor(filePath: string) {
    this.filePath = filePath;
  }

  public getFilePath(): string {
    return this.filePath;
  }

  private async readEntriesFromDisk(): Promise<MemoryEntry[]> {
    if (!existsSync(this.filePath)) {
      return [];
    }

    try {
      const raw = await readFile(this.filePath, "utf-8");
      if (raw.trim().length === 0) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as MemoryEntry[];
      }
      return [];
    } catch {
      return [];
    }
  }

  private async loadEntries(): Promise<MemoryEntry[]> {
    if (this.memoryCache !== null) {
      return this.memoryCache;
    }

    const loaded = await this.readEntriesFromDisk();
    this.memoryCache = loaded;
    return this.memoryCache;
  }

  private async flushAtomic(entries: MemoryEntry[]): Promise<void> {
    const dir = dirname(this.filePath);
    if (dir && dir !== "." && !existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const data = JSON.stringify(entries, null, 2);
    const tempPath = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tempPath, data, "utf-8");
    await rename(tempPath, this.filePath);
  }

  public async append(entry: MemoryEntry): Promise<void> {
    await serializeFileOperation(this.filePath, async () => {
      // Always re-read from disk to capture any concurrent updates from other instances or processes
      const entries = await this.readEntriesFromDisk();
      entries.push({
        agentId: entry.agentId,
        taskId: entry.taskId,
        input: entry.input,
        output: entry.output,
        recordedAt: entry.recordedAt
      });
      await this.flushAtomic(entries);
      this.memoryCache = entries;
    });
  }

  public async listByAgent(
    agentId: string,
    options?: ListMemoryOptions
  ): Promise<MemoryEntry[]> {
    return await serializeFileOperation(this.filePath, async () => {
      const entries = await this.readEntriesFromDisk();
      this.memoryCache = entries;
      const matching = entries.filter((item) => item.agentId === agentId);
      const offset = options?.offset ?? 0;
      const limit = options?.limit ?? matching.length;
      return matching.slice(offset, offset + limit).map((e) => ({ ...e }));
    });
  }

  public async countByAgent(agentId: string): Promise<number> {
    return await serializeFileOperation(this.filePath, async () => {
      const entries = await this.readEntriesFromDisk();
      this.memoryCache = entries;
      return entries.filter((item) => item.agentId === agentId).length;
    });
  }

  public async clear(): Promise<void> {
    await serializeFileOperation(this.filePath, async () => {
      this.memoryCache = [];
      await this.flushAtomic([]);
    });
  }
}
