import { RuntimeError } from "../errors/runtime-errors.js";
import type { ToolDefinition } from "./types.js";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  public register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new RuntimeError(
        "DUPLICATE_TOOL",
        `Tool "${tool.name}" is already registered.`,
        { toolName: tool.name }
      );
    }

    this.tools.set(tool.name, tool);
  }

  public get(toolName: string): ToolDefinition {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new RuntimeError(
        "TOOL_NOT_FOUND",
        `Tool "${toolName}" is not registered.`,
        { toolName }
      );
    }

    return tool;
  }

  public has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  public unregister(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  public clear(): void {
    this.tools.clear();
  }

  public size(): number {
    return this.tools.size;
  }

  public list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}
