export interface RuntimeLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export type RuntimeLogLevel = "info" | "warn" | "error";

export interface ConsoleRuntimeLoggerOptions {
  level?: RuntimeLogLevel;
}

const levelPriority: Record<RuntimeLogLevel, number> = {
  info: 0,
  warn: 1,
  error: 2
};

export class ConsoleRuntimeLogger implements RuntimeLogger {
  private readonly minimumLevel: RuntimeLogLevel;

  public constructor(options: ConsoleRuntimeLoggerOptions = {}) {
    this.minimumLevel = options.level ?? "info";
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      console.info(message, metadata ?? {});
    }
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      console.error(message, metadata ?? {});
    }
  }

  private shouldLog(level: "info" | "error"): boolean {
    return levelPriority[level] >= levelPriority[this.minimumLevel];
  }
}

export interface InMemoryRuntimeLoggerOptions {
  maxEntries?: number;
}

export class InMemoryRuntimeLogger implements RuntimeLogger {
  public readonly entries: Array<{
    level: "info" | "error";
    message: string;
    metadata: Record<string, unknown> | undefined;
  }> = [];
  private readonly maxEntries: number;

  public constructor(options: InMemoryRuntimeLoggerOptions = {}) {
    this.maxEntries = options.maxEntries ?? 5_000;
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.appendEntry("info", message, metadata);
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    this.appendEntry("error", message, metadata);
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public size(): number {
    return this.entries.length;
  }

  private appendEntry(
    level: "info" | "error",
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    if (this.maxEntries > 0 && this.entries.length >= this.maxEntries) {
      this.entries.shift();
    }
    this.entries.push({ level, message, metadata });
  }
}
