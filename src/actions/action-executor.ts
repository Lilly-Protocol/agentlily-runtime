import type { RuntimeContext } from "../runtime/context.js";
import type { RuntimeLogger } from "../logger/runtime-logger.js";
import type { RuntimeEventBus } from "../events/runtime-events.js";
import { ToolRegistry } from "../tools/tool-registry.js";

export class ActionExecutor {
  public constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly logger?: RuntimeLogger,
    private readonly eventBus?: RuntimeEventBus
  ) {}

  public async execute<TPayload, TResult>(
    toolName: string,
    payload: TPayload,
    context: RuntimeContext
  ): Promise<TResult> {
    this.eventBus?.emit({
      name: "runtime.tool.invoked",
      payload: {
        runtimeId: context.runtimeId,
        taskId: context.taskId ?? "unknown",
        agentId: context.agent?.id ?? "unknown",
        toolName,
        invokedAt: new Date().toISOString()
      }
    });

    const tool = this.toolRegistry.get(toolName);
    const startedAt = Date.now();
    const result = (await tool.execute({ payload, context })) as TResult;
    const durationMs = Math.max(0, Date.now() - startedAt);

    this.logger?.info("Tool invocation completed.", {
      toolName,
      durationMs
    });

    return result;
  }
}
