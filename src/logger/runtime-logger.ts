export interface RuntimeLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

const DEFAULT_REDACT_PATTERN = /secret|token|password|apiKey|api_key|authorization/i;

export interface ConsoleRuntimeLoggerOptions {
  /** Regex pattern matching metadata keys to redact. Default matches secret/token/password/apiKey/authorization. */
  redactKeys?: RegExp;
}

function redactMetadata(
  metadata: Record<string, unknown>,
  pattern: RegExp
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (pattern.test(key)) {
      result[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactMetadata(value as Record<string, unknown>, pattern);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class ConsoleRuntimeLogger implements RuntimeLogger {
  private readonly redactPattern: RegExp;

  public constructor(options?: ConsoleRuntimeLoggerOptions) {
    this.redactPattern = options?.redactKeys ?? DEFAULT_REDACT_PATTERN;
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    const safeMeta = metadata ? redactMetadata(metadata, this.redactPattern) : {};
    console.info(message, safeMeta);
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    const safeMeta = metadata ? redactMetadata(metadata, this.redactPattern) : {};
    console.error(message, safeMeta);
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
