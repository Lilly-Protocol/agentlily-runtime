import { describe, expect, it } from "vitest";
import {
  ActionExecutor,
  AgentInstanceManager,
  InMemoryMemoryStore,
  InMemoryRuntimeStateStore,
  ToolRegistry,
  UnconfiguredModelProvider
} from "../src/index.js";
import type { RuntimeContext } from "../src/index.js";

describe("ActionExecutor", () => {
  const createMockContext = (taskId: string): RuntimeContext => ({
    runtimeId: "test-runtime",
    taskId,
    agent: new AgentInstanceManager().getOrCreate("test-agent"),
    memory: new InMemoryMemoryStore(),
    modelProvider: new UnconfiguredModelProvider(),
    state: new InMemoryRuntimeStateStore(),
    now: new Date().toISOString()
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
    const ctx = createMockContext("task-2");

    expect(executor.getToolCallCount("task-2")).toBe(0);

    const result1 = await executor.execute("ping", {}, ctx);
    expect(result1).toBe("pong");
    expect(executor.getToolCallCount("task-2")).toBe(1);

    const result2 = await executor.execute("ping", {}, ctx);
    expect(result2).toBe("pong");
    expect(executor.getToolCallCount("task-2")).toBe(2);

    await expect(
      executor.execute("ping", {}, ctx)
    ).rejects.toThrow("Max tool calls per task exceeded");
    expect(executor.getToolCallCount("task-2")).toBe(2);
  });

  // NEW TESTS FOR THE FIX
  it("does not increment tool call count for unknown tool", async () => {
    const registry = new ToolRegistry();
    // No tools registered
    const executor = new ActionExecutor(registry);
    const ctx = createMockContext("task-3");

    const initialCount = executor.getToolCallCount("task-3");
    expect(initialCount).toBe(0);

    await expect(
      executor.execute("unknown-tool", {}, ctx)
    ).rejects.toThrow(/TOOL_NOT_FOUND/);

    // Count should remain unchanged
    expect(executor.getToolCallCount("task-3")).toBe(initialCount);
  });

  it("allows valid tool call after TOOL_NOT_FOUND when maxToolCallsPerTask is set", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "valid-tool",
      description: "Valid tool",
      execute({ payload }) {
        return { result: payload };
      }
    });

    const executor = new ActionExecutor(registry, 2); // max 2 calls
    const ctx = createMockContext("task-4");

    // First call: unknown tool -> should NOT consume budget
    await expect(
      executor.execute("unknown-tool", {}, ctx)
    ).rejects.toThrow(/TOOL_NOT_FOUND/);
    expect(executor.getToolCallCount("task-4")).toBe(0);

    // Second call: valid tool -> should succeed and increment to 1
    const result1 = await executor.execute("valid-tool", { data: "test" }, ctx);
    expect(result1).toEqual({ result: "test" });
    expect(executor.getToolCallCount("task-4")).toBe(1);

    // Third call: valid tool -> should succeed and increment to 2
    const result2 = await executor.execute("valid-tool", { data: "test2" }, ctx);
    expect(result2).toEqual({ result: "test2" });
    expect(executor.getToolCallCount("task-4")).toBe(2);

    // Fourth call: should be blocked by limit
    await expect(
      executor.execute("valid-tool", {}, ctx)
    ).rejects.toThrow(/Max tool calls per task exceeded/);
    expect(executor.getToolCallCount("task-4")).toBe(2);
  });
});