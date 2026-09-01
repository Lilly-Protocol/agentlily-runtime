import { RuntimeError } from "../errors/runtime-errors.js";

export function assertRuntimeStarted(isStarted: boolean): void {
  if (!isStarted) {
    throw new RuntimeError(
      "RUNTIME_NOT_STARTED",
      "AgentRuntime must be started before executing tasks."
    );
  }
}

export function assertNonEmptyValue(
  value: string,
  fieldName: string,
  code: "INVALID_TASK" | "EXECUTION_FAILED" = "INVALID_TASK"
): void {
  if (value.trim().length === 0) {
    throw new RuntimeError(code, `${fieldName} must be a non-empty string.`, {
      fieldName
    });
  }
}

export function assertMaxToolCalls(
  currentToolCalls: number,
  maxToolCalls: number
): void {
  if (maxToolCalls >= 0 && currentToolCalls >= maxToolCalls) {
    throw new RuntimeError(
      "MAX_TOOL_CALLS_EXCEEDED",
      `Task exceeded maximum allowed tool calls limit of ${maxToolCalls}.`,
      { currentToolCalls, maxToolCalls }
    );
  }
}
