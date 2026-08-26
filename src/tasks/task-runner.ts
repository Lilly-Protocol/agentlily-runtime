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

    const startedAt = new Date();

    try {
      const output = await this.actionExecutor.execute<TPayload, TResult>(
        task.toolName,
        task.payload,
        context
      );

      const completedAt = new Date();
      const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());

      await this.memoryStore.append({
        agentId: task.agentId,
        taskId: task.taskId,
        input: task.input,
        output,
        recordedAt: completedAt.toISOString()
      });

      return {
        taskId: task.taskId,
        agentId: task.agentId,
        toolName: task.toolName,
        output,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
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
