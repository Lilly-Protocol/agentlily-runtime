export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface ConsoleRuntimeLoggerOptions {
  /** Minimum log level to output. Messages below this level are suppressed. Default: "info". */
  level?: LogLevel;
}

export interface RuntimeLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export class ConsoleRuntimeLogger implements RuntimeLogger {
  private readonly minLevel: number;

  public constructor(options?: ConsoleRuntimeLoggerOptions) {
    const level: LogLevel = options?.level ?? "info";
    this.minLevel = LOG_LEVEL_PRIORITY[level];
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    if (this.minLevel > LOG_LEVEL_PRIORITY.info) return;
    console.info(message, metadata ?? {});
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    if (this.minLevel > LOG_LEVEL_PRIORITY.error) return;
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
