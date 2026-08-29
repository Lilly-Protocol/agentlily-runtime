import type { RuntimeContext } from "../runtime/context.js";
import { ToolRegistry } from "../tools/tool-registry.js";

export class ActionExecutor {
  private readonly toolRegistry: ToolRegistry;

  public constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  public async execute<TPayload, TResult>(
    toolName: string,
    payload: TPayload,
    context: RuntimeContext
  ): Promise<TResult> {
    const tool = this.toolRegistry.get(toolName);
    return (await tool.execute({ payload, context })) as TResult;
  }
}
