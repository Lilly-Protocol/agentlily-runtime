import { describe, expect, it } from "vitest";
import { ActionExecutor } from "../../src/actions/action-executor.js";
import { ToolRegistry } from "../../src/tools/tool-registry.js";
import type { RuntimeContext } from "../../src/runtime/context.js";

describe("ActionExecutor tool-call budget consumption (Issue #256)", () => {
  const createMockContext = (taskId: string): RuntimeContext => ({
    runtimeId: "test-runtime",
    taskId,
    agent: { agentId: "test-agent", id: "test-agent" } as any,
    memory: {} as any,
    modelProvider: {} as any,
    state: {} as any,
    now: new Date().toISOString()
  });

  it("does not increment toolCallCount when tool is not registered", async () => {
    const registry = new ToolRegistry();
    const executor = new ActionExecutor(registry);
    const ctx = createMockContext("task-not-found");

    expect(executor.getToolCallCount("task-not-found")).toBe(0);

    await expect(
      executor.execute("unknownTool", {}, ctx)
    ).rejects.toMatchObject({
      name: "RuntimeError",
      code: "TOOL_NOT_FOUND"
    });

    expect(executor.getToolCallCount("task-not-found")).toBe(0);
  });

  it("allows a subsequent valid tool call when maxToolCallsPerTask is 1 and previous call failed with TOOL_NOT_FOUND", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "validTool",
      description: "A valid tool",
      execute: () => ({ success: true })
    });

    const executor = new ActionExecutor(registry, 1);
    const ctx = createMockContext("task-quota-test");

    // Attempting an unknown tool throws TOOL_NOT_FOUND
    await expect(
      executor.execute("missingTool", {}, ctx)
    ).rejects.toMatchObject({
      code: "TOOL_NOT_FOUND"
    });

    // Tool call count remains 0
    expect(executor.getToolCallCount("task-quota-test")).toBe(0);

    // Now call the valid tool with maxToolCallsPerTask = 1
    const result = await executor.execute("validTool", {}, ctx);
    expect(result).toEqual({ success: true });
    expect(executor.getToolCallCount("task-quota-test")).toBe(1);

    // Another call should fail with MAX_TOOL_CALLS_EXCEEDED
    await expect(
      executor.execute("validTool", {}, ctx)
    ).rejects.toMatchObject({
      code: "MAX_TOOL_CALLS_EXCEEDED"
    });
  });
});
