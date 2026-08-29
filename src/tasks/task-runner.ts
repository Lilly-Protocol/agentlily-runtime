import type { ActionExecutor } from "../actions/action-executor.js";
import { RuntimeError } from "../errors/runtime-errors.js";
import { assertNonEmptyValue } from "../guards/runtime-guards.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { RuntimeContext } from "../runtime/context.js";
import type { RuntimeTask, TaskExecutionResult } from "./task-types.js";

export class TaskRunner {
  public constructor(
    private readonly actionExecutor: ActionExecutor,
    private readonly memoryStore: MemoryStore
  ) {}

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
      const output = await this.actionExecutor.execute<TPayload, TResult>(
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
      if (error instanceof RuntimeError) {
        throw error;
      }

      throw new RuntimeError(
        "EXECUTION_FAILED",
        "Task execution failed.",
        error instanceof Error ? { cause: error.message } : undefined
      );
    }
  }
}
