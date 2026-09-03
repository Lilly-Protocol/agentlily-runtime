import type { RuntimeEventBus } from "../events/runtime-events.js";
import { assertMaxToolCalls } from "../guards/runtime-guards.js";
import type { RuntimeLogger } from "../logger/runtime-logger.js";
import type { RuntimeContext } from "../runtime/context.js";
import { ToolRegistry } from "../tools/tool-registry.js";

function resolveAgentId(
  agent: { agentId?: string; id?: string } | undefined
): string {
  return agent?.agentId ?? agent?.id ?? "";
}

export interface ActionExecutorOptions {
  maxToolCallsPerTask?: number | undefined;
  maxTrackedTasks?: number | undefined;
  logger?: RuntimeLogger | undefined;
  eventBus?: RuntimeEventBus | undefined;
}

export class ActionExecutor {
  private readonly toolCallCounts = new Map<string, number>();
  private readonly logger: RuntimeLogger | undefined;
  private readonly eventBus: RuntimeEventBus | undefined;
  private readonly maxToolCallsPerTask: number | undefined;
  private readonly maxTrackedTasks: number;

  public constructor(
    private readonly toolRegistry: ToolRegistry,
    maxToolCallsPerTaskOrLoggerOrOptions?:
      | number
      | RuntimeLogger
      | ActionExecutorOptions,
    eventBus?: RuntimeEventBus,
    maxTrackedTasks?: number
  ) {
    if (
      typeof maxToolCallsPerTaskOrLoggerOrOptions === "object" &&
      maxToolCallsPerTaskOrLoggerOrOptions !== null &&
      !("info" in maxToolCallsPerTaskOrLoggerOrOptions)
    ) {
      const opts = maxToolCallsPerTaskOrLoggerOrOptions as ActionExecutorOptions;
      this.maxToolCallsPerTask = opts.maxToolCallsPerTask;
      this.logger = opts.logger;
      this.eventBus = opts.eventBus ?? eventBus;
      this.maxTrackedTasks = opts.maxTrackedTasks ?? 1_000;
    } else if (typeof maxToolCallsPerTaskOrLoggerOrOptions === "number") {
      this.maxToolCallsPerTask = maxToolCallsPerTaskOrLoggerOrOptions;
      this.logger = undefined;
      this.eventBus = eventBus;
      this.maxTrackedTasks = maxTrackedTasks ?? 1_000;
    } else {
      this.logger =
        maxToolCallsPerTaskOrLoggerOrOptions as RuntimeLogger | undefined;
      this.eventBus = eventBus;
      this.maxTrackedTasks = maxTrackedTasks ?? 1_000;
    }
  }

  public getTrackedTaskCount(): number {
    return this.toolCallCounts.size;
  }

  public getToolCallCount(taskId: string): number {
    return this.toolCallCounts.get(taskId) ?? 0;
  }

  /**
   * Reset the tool call count for a specific task ID, or clear all tracked task
   * counts if no taskId is provided. Allows reclaiming memory or refreshing quotas.
   */
  public reset(taskId?: string): void {
    if (taskId !== undefined) {
      this.toolCallCounts.delete(taskId);
    } else {
      this.toolCallCounts.clear();
    }
  }

  public resetAll(): void {
    this.toolCallCounts.clear();
  }

  public async execute<TPayload, TResult>(
    toolName: string,
    payload: TPayload,
    context: RuntimeContext
  ): Promise<TResult> {
    const currentCount = this.getToolCallCount(context.taskId);
    if (this.maxToolCallsPerTask !== undefined) {
      assertMaxToolCalls(currentCount, this.maxToolCallsPerTask);
    }

    if (
      !this.toolCallCounts.has(context.taskId) &&
      this.toolCallCounts.size >= this.maxTrackedTasks
    ) {
      const oldestTaskId = this.toolCallCounts.keys().next().value;
      if (oldestTaskId !== undefined) {
        this.toolCallCounts.delete(oldestTaskId);
      }
    }

    this.toolCallCounts.set(context.taskId, currentCount + 1);

    const tool = this.toolRegistry.get(toolName);
    const startedAt = Date.now();

    this.eventBus?.emit({
      name: "runtime.tool.invoked",
      payload: {
        runtimeId: context.runtimeId,
        taskId: context.taskId,
        agentId: resolveAgentId(context.agent),
        toolName,
        invokedAt: new Date().toISOString()
      }
    });

    const result = (await tool.execute({
      payload,
      context
    })) as TResult;

    const durationMs = Math.max(0, Date.now() - startedAt);
    this.logger?.info("Tool invocation completed.", { toolName, durationMs });

    return result;
  }
}
