import type { ActionExecutor } from "../actions/action-executor.js";
import { RuntimeError } from "../errors/runtime-errors.js";
import { assertNonEmptyValue } from "../guards/runtime-guards.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { RuntimeContext } from "../runtime/context.js";
import type { RuntimeTask, TaskExecutionResult } from "./task-types.js";

export class TaskRunner {
  private readonly actionExecutor: ActionExecutor;
  private readonly memoryStore: MemoryStore;
  private readonly timeoutMs: number | undefined;

  public constructor(
    actionExecutor: ActionExecutor,
    memoryStore: MemoryStore,
    timeoutMs?: number
  ) {
    this.actionExecutor = actionExecutor;
    this.memoryStore = memoryStore;
    this.timeoutMs = timeoutMs;
  }

  public async run<TPayload, TResult>(
    task: RuntimeTask<TPayload>,
    context: RuntimeContext
  ): Promise<TaskExecutionResult<TResult>> {
    assertNonEmptyValue(task.taskId, "taskId");
    assertNonEmptyValue(task.agentId, "agentId");
    assertNonEmptyValue(task.toolName, "toolName");
    assertNonEmptyValue(task.input, "input");

    const startTime = performance.now();
    const startedAt = new Date().toISOString();

    try {
      const output = await this.executeWithTimeout<TPayload, TResult>(
        task.toolName,
        task.payload,
        context
      );

      const endTime = performance.now();
      const completedAt = new Date().toISOString();
      const durationMs = Math.max(0, Math.round(endTime - startTime));

      await this.memoryStore.append({
        agentId: task.agentId,
        taskId: task.taskId,
        input: task.input,
        output,
        recordedAt: completedAt
      });

      return {
        taskId: task.taskId,
        agentId: task.agentId,
        toolName: task.toolName,
        output,
        startedAt,
        completedAt,
        durationMs
      };
    } catch (error) {
      // Typed runtime errors propagate unchanged; anything else thrown by a
      // tool or the memory store is reported as an unexpected execution
      // failure while preserving the original error message.
      if (error instanceof RuntimeError) {
        throw error;
      }
      throw new RuntimeError(
        "EXECUTION_FAILED",
        error instanceof Error ? error.message : "Task execution failed.",
        error instanceof Error ? { cause: error.message } : undefined
      );
    }
  }

  private async executeWithTimeout<TPayload, TResult>(
    toolName: string,
    payload: TPayload,
    context: RuntimeContext
  ): Promise<TResult> {
    const execution = this.actionExecutor.execute<TPayload, TResult>(
      toolName,
      payload,
      context
    );
    const timeoutMs = this.timeoutMs;

    if (timeoutMs === undefined) {
      return execution;
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new RuntimeError(
            "EXECUTION_FAILED",
            `Task execution timed out after ${timeoutMs}ms.`,
            { timeoutMs }
          )
        );
      }, timeoutMs);
    });

    try {
      return await Promise.race([execution, timeout]);
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
