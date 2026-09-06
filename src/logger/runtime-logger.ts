export type RuntimeLogLevel = "debug" | "info" | "warn" | "error";

export interface RuntimeLogger {
  readonly level?: RuntimeLogLevel;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

const LOG_LEVEL_PRIORITY: Record<RuntimeLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

export interface ConsoleRuntimeLoggerOptions {
  level?: RuntimeLogLevel;
  redactKeys?: RegExp;
}

const DEFAULT_REDACT_KEYS = /(secret|token|password|api.?key|authorization)/i;

function redactValue(value: unknown, redactKeys: RegExp): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown): unknown => {
      if (item !== null && typeof item === "object") {
        return redactValue(item, redactKeys);
      }
      return item;
    });
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (redactKeys.test(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactValue(entry, redactKeys);
      }
    }
    return result;
  }

  return value;
}

export class ConsoleRuntimeLogger implements RuntimeLogger {
  public readonly level: RuntimeLogLevel;
  private readonly redactKeys: RegExp;

  public constructor(options: ConsoleRuntimeLoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.redactKeys = options.redactKeys ?? DEFAULT_REDACT_KEYS;
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.emit("info", message, metadata);
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.emit("warn", message, metadata);
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.emit("debug", message, metadata);
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    this.emit("error", message, metadata);
  }

  private emit(
    level: RuntimeLogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const prepared = this.prepareMetadata(metadata);
    switch (level) {
      case "debug":
        console.debug(message, prepared);
        break;
      case "info":
        console.info(message, prepared);
        break;
      case "warn":
        console.warn(message, prepared);
        break;
      case "error":
        console.error(message, prepared);
        break;
    }
  }

  private shouldLog(level: RuntimeLogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private prepareMetadata(
    metadata?: Record<string, unknown>
  ): Record<string, unknown> {
    return redactValue(metadata ?? {}, this.redactKeys) as Record<
      string,
      unknown
    >;
  }
}

export interface InMemoryRuntimeLoggerOptions {
  /** Maximum number of entries to retain. Oldest entries are evicted first. Defaults to 5 000. */
  maxEntries?: number;
  /** Minimum severity level to record. Entries below this level are silently discarded. When omitted, all levels are recorded. */
  level?: RuntimeLogLevel;
  /** Regex matched against metadata keys; matching values are replaced with `"[REDACTED]"`. Defaults to `DEFAULT_REDACT_KEYS`. Pass a regex that matches nothing (e.g. `/$^/`) to disable redaction. */
  redactKeys?: RegExp;
}

export interface InMemoryLogEntry {
  level: RuntimeLogLevel;
  message: string;
  metadata: Record<string, unknown> | undefined;
}

export class InMemoryRuntimeLogger implements RuntimeLogger {
  public readonly entries: InMemoryLogEntry[] = [];
  private readonly maxEntries: number;
  private readonly minimumLevel: RuntimeLogLevel | undefined;
  private readonly redactKeys: RegExp;

  public constructor(options: InMemoryRuntimeLoggerOptions = {}) {
    this.maxEntries = options.maxEntries ?? 5_000;
    this.minimumLevel = options.level;
    this.redactKeys = options.redactKeys ?? DEFAULT_REDACT_KEYS;
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      this.appendEntry("info", message, metadata);
    }
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      this.appendEntry("warn", message, metadata);
    }
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      this.appendEntry("debug", message, metadata);
    }
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      this.appendEntry("error", message, metadata);
    }
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public size(): number {
    return this.entries.length;
  }

  private shouldLog(level: RuntimeLogLevel): boolean {
    if (this.minimumLevel === undefined) {
      return true;
    }
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minimumLevel];
  }

  private appendEntry(
    level: RuntimeLogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }
    if (this.maxEntries > 0 && this.entries.length >= this.maxEntries) {
      this.entries.shift();
    }
    const redactedMetadata = metadata
      ? (redactValue(metadata, this.redactKeys) as
          | Record<string, unknown>
          | undefined)
      : undefined;
    this.entries.push({ level, message, metadata: redactedMetadata });
  }
}
