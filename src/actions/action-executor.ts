import { assertMaxToolCalls } from "../guards/runtime-guards.js";
import type { RuntimeContext } from "../runtime/context.js";
import { ToolRegistry } from "../tools/tool-registry.js";

export class ActionExecutor {
  private readonly toolCallCounts = new Map<string, number>();

  public constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly maxToolCallsPerTask?: number
  ) {}

  public getToolCallCount(taskId: string): number {
    return this.toolCallCounts.get(taskId) ?? 0;
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

    this.toolCallCounts.set(context.taskId, currentCount + 1);
    const tool = this.toolRegistry.get(toolName);
    return (await tool.execute({ payload, context })) as TResult;
  }
}
