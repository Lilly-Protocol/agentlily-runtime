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

export interface MemoryStore {
  append(entry: MemoryEntry): Promise<void>;
  listByAgent(agentId: string): Promise<MemoryEntry[]>;
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly entries: MemoryEntry[] = [];

  public async append(entry: MemoryEntry): Promise<void> {
    this.entries.push(entry);
  }

  public async listByAgent(agentId: string): Promise<MemoryEntry[]> {
    return this.entries.filter((entry) => entry.agentId === agentId);
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
}
