import { describe, it, expect } from "vitest";
import { ActionExecutor } from "../../src/actions/action-executor.js";
import { ToolRegistry } from "../../src/tools/tool-registry.js";
import { AgentInstanceManager } from "../../src/agents/agent-instance-manager.js";
import { InMemoryMemoryStore } from "../../src/memory/memory-store.js";
import { InMemoryRuntimeStateStore } from "../../src/state/runtime-state.js";
import { UnconfiguredModelProvider } from "../../src/providers/model-provider.js";
import type { RuntimeContext } from "../../src/index.js";

describe("ActionExecutor tool dispatch and payload passthrough (Issue #115)", () => {
  const createMockContext = (taskId: string): RuntimeContext => ({
    runtimeId: "test-runtime",
    taskId,
    agent: new AgentInstanceManager().getOrCreate("test-agent"),
    memory: new InMemoryMemoryStore(),
    modelProvider: new UnconfiguredModelProvider(),
    state: new InMemoryRuntimeStateStore(),
    now: new Date().toISOString()
  });

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
    const ctx = createMockContext("task-math");

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
    await executor.execute("capture", complexPayload, createMockContext("task-payload"));

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
    const mockContext = createMockContext("t1");
    await executor.execute("ctxCapture", {}, mockContext);

    expect(receivedContext).toBe(mockContext);
  });

  it("throws TOOL_NOT_FOUND for unregistered tool names", async () => {
    const registry = new ToolRegistry();
    const executor = new ActionExecutor(registry);

    await expect(
      executor.execute("nonexistent", {}, createMockContext("task-err"))
    ).rejects.toThrow(/not registered/);
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
    const result = await executor.execute("asyncTool", { x: 5 }, createMockContext("task-async"));
    expect(result).toEqual({ value: 50 });
  });

  it("executes tools and tracks call counts per task", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "test-tool",
      description: "Test tool",
      execute({ payload }) {
        return { handled: payload };
      }
    });

    const executor = new ActionExecutor(registry);
    const ctx = createMockContext("task-1");

    expect(executor.getToolCallCount("task-1")).toBe(0);

    const result1 = await executor.execute("test-tool", { count: 1 }, ctx);
    expect(result1).toEqual({ handled: { count: 1 } });
    expect(executor.getToolCallCount("task-1")).toBe(1);

    const result2 = await executor.execute("test-tool", { count: 2 }, ctx);
    expect(result2).toEqual({ handled: { count: 2 } });
    expect(executor.getToolCallCount("task-1")).toBe(2);
  });

  it("enforces maxToolCallsPerTask policy limit", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "ping",
      description: "Ping tool",
      execute() {
        return "pong";
      }
    });

    const executor = new ActionExecutor(registry, 2);
    const ctx = createMockContext("task-limited");

    // Call 1: Allowed (count 0 -> 1)
    await expect(executor.execute("ping", {}, ctx)).resolves.toBe("pong");
    // Call 2: Allowed (count 1 -> 2)
    await expect(executor.execute("ping", {}, ctx)).resolves.toBe("pong");

    // Call 3: Exceeds limit (count 2 >= 2)
    await expect(executor.execute("ping", {}, ctx)).rejects.toMatchObject({
      name: "RuntimeError",
      code: "MAX_TOOL_CALLS_EXCEEDED",
      details: {
        currentToolCalls: 2,
        maxToolCalls: 2
      }
    });
  });

  it("isolates call limits per task ID", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "ping",
      description: "Ping tool",
      execute() {
        return "pong";
      }
    });

    const executor = new ActionExecutor(registry, 1);
    const ctxA = createMockContext("task-A");
    const ctxB = createMockContext("task-B");

    // task-A first call succeeds
    await expect(executor.execute("ping", {}, ctxA)).resolves.toBe("pong");
    // task-A second call fails
    await expect(executor.execute("ping", {}, ctxA)).rejects.toMatchObject({
      code: "MAX_TOOL_CALLS_EXCEEDED"
    });

    // task-B has its own quota and succeeds
    await expect(executor.execute("ping", {}, ctxB)).resolves.toBe("pong");
  });
});
