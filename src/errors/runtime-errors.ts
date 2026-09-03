export type RuntimeErrorCode =
  | "RUNTIME_NOT_STARTED"
  | "RUNTIME_ALREADY_STARTED"
  | "RUNTIME_ALREADY_STOPPED"
  | "TOOL_NOT_FOUND"
  | "DUPLICATE_TOOL"
  | "INVALID_TASK"
  | "EXECUTION_FAILED"
  | "MAX_TOOL_CALLS_EXCEEDED"
  | "DUPLICATE_IN_FLIGHT_TASK";

export class RuntimeError extends Error {
  public readonly code: RuntimeErrorCode;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(
    code: RuntimeErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "RuntimeError";
    this.code = code;
    this.details = details;
  }

  public toJSON(): {
    name: string;
    code: RuntimeErrorCode;
    message: string;
    details: Record<string, unknown> | undefined;
    stack: string | undefined;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack
    };
  }
}
