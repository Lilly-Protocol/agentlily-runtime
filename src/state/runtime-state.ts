export interface RuntimeStateStore {
  put(key: string, value: unknown): Promise<void>;
  get<TValue>(key: string): Promise<TValue | undefined>;
  delete?(key: string): Promise<boolean>;
  has?(key: string): Promise<boolean>;
  clear?(): Promise<void>;
  size?(): Promise<number>;
  keys?(): Promise<string[]>;
}

export interface InMemoryRuntimeStateStoreOptions {
  maxEntries?: number;
}

export class InMemoryRuntimeStateStore implements RuntimeStateStore {
  private readonly store = new Map<string, unknown>();
  private readonly maxEntries: number;

  public constructor(options: InMemoryRuntimeStateStoreOptions = {}) {
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  public async put(key: string, value: unknown): Promise<void> {
    if (this.maxEntries > 0 && !this.store.has(key) && this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, value);
  }

  public async get<TValue>(key: string): Promise<TValue | undefined> {
    return this.store.get(key) as TValue | undefined;
  }

  public async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  public async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  public async clear(): Promise<void> {
    this.store.clear();
  }

  public async size(): Promise<number> {
    return this.store.size;
  }

  public async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}
