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
