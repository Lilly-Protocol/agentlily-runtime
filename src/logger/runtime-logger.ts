export interface RuntimeLogger {
 info(message: string, metadata?: Record<string, unknown>): void;
 error(message: string, metadata?: Record<string, unknown>): void;
}

export type LogLevel = "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
};

export interface ConsoleRuntimeLoggerOptions {
  level?: LogLevel;
}

export class ConsoleRuntimeLogger implements RuntimeLogger {
  private readonly minLevel: LogLevel;

  constructor(options?: ConsoleRuntimeLoggerOptions) {
    this.minLevel = options?.level ?? "info";
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("info")) return;
    console.info(message, metadata ?? {});
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("warn")) return;
    console.warn(message, metadata ?? {});
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("error")) return;
    console.error(message, metadata ?? {});
  }
}

export class InMemoryRuntimeLogger implements RuntimeLogger {
  public readonly entries: Array<{
    level: "info" | "error";
    message: string;
    metadata: Record<string, unknown> | undefined;
  }> = [];

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.entries.push({ level: "info", message, metadata });
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    this.entries.push({ level: "error", message, metadata });
  }
}
