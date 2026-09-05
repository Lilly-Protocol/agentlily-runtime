import { describe, it, expect } from "vitest";
import { ActionExecutor } from "../../src/actions/action-executor.js";
import { ToolRegistry } from "../../src/tools/tool-registry.js";

describe("ActionExecutor tool dispatch and payload passthrough (Issue #115)", () => {
  it("dispatches to the correct registered tool by name", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "add",
      description: "Adds two numbers",
      execute: ({ payload }) => ({
        sum: (payload as any).a + (payload as any).b
      })
    });
    registry.register({
      name: "multiply",
      description: "Multiplies two numbers",
      execute: ({ payload }) => ({
        product: (payload as any).a * (payload as any).b
      })
    });

    const executor = new ActionExecutor(registry);
    const ctx = {} as any;

    const addResult = await executor.execute("add", { a: 3, b: 4 }, ctx);
    expect(addResult).toEqual({ sum: 7 });

    const mulResult = await executor.execute("multiply", { a: 3, b: 4 }, ctx);
    expect(mulResult).toEqual({ product: 12 });
  });

  it("passes payload through to tool execute without modification", async () => {
    const registry = new ToolRegistry();
    let receivedPayload: unknown = null;
    registry.register({
      name: "capture",
      description: "Captures payload for inspection",
      execute: ({ payload }) => {
        receivedPayload = payload;
        return { ok: true };
      }
    });

    const executor = new ActionExecutor(registry);
    const complexPayload = {
      nested: { arr: [1, 2, 3], flag: true },
      label: "test"
    };
    await executor.execute("capture", complexPayload, {} as any);

    expect(receivedPayload).toBe(complexPayload);
  });

  it("passes context through to tool execute", async () => {
    const registry = new ToolRegistry();
    let receivedContext: any = null;
    registry.register({
      name: "ctxCapture",
      description: "Captures context for inspection",
      execute: ({ context }) => {
        receivedContext = context;
        return { ok: true };
      }
    });

    const executor = new ActionExecutor(registry);
    const mockContext = { runtimeId: "r1", taskId: "t1" } as any;
    await executor.execute("ctxCapture", {}, mockContext);

    expect(receivedContext).toBe(mockContext);
  });

  it("throws TOOL_NOT_FOUND for unregistered tool names", async () => {
    const registry = new ToolRegistry();
    const executor = new ActionExecutor(registry);

    await expect(
      executor.execute("nonexistent", {}, {} as any)
    ).rejects.toThrow(/not registered/);
  });

  it("does not increment tool call count when tool is not found (Issue #256)", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "valid-tool",
      description: "A valid tool",
      execute: () => ({ success: true })
    });

    const executor = new ActionExecutor(registry, 1);
    const mockContext = { runtimeId: "r1", taskId: "task-quota-1" } as any;

    expect(executor.getToolCallCount("task-quota-1")).toBe(0);

    // Call unknown tool -> should fail with TOOL_NOT_FOUND and not consume budget
    await expect(
      executor.execute("missing-tool", {}, mockContext)
    ).rejects.toMatchObject({
      name: "RuntimeError",
      code: "TOOL_NOT_FOUND"
    });

    expect(executor.getToolCallCount("task-quota-1")).toBe(0);

    // Subsequent valid call with maxToolCallsPerTask: 1 should still succeed
    const result = await executor.execute("valid-tool", {}, mockContext);
    expect(result).toEqual({ success: true });
    expect(executor.getToolCallCount("task-quota-1")).toBe(1);
  });

  it("returns async tool results correctly", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "asyncTool",
      description: "Returns a promise",
      execute: async ({ payload }) => {
        return { value: (payload as any).x * 10 };
      }
    });

    const executor = new ActionExecutor(registry);
    const result = await executor.execute("asyncTool", { x: 5 }, {} as any);
    expect(result).toEqual({ value: 50 });
  });
});
