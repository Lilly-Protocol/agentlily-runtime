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

  it("bounds the internal counter map size under high volume of distinct tasks", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echo tool",
      execute({ payload }) {
        return payload;
      }
    });

    const maxTrackedTasks = 5;
    const executor = new ActionExecutor(registry, {
      maxTrackedTasks,
      maxToolCallsPerTask: 10
    });

    // Execute 20 distinct task IDs
    for (let i = 0; i < 20; i++) {
      const ctx = createMockContext(`task-unique-${i}`);
      await executor.execute("echo", { i }, ctx);
    }

    // Size must not exceed maxTrackedTasks cap
    expect(executor.getTrackedTaskCount()).toBe(maxTrackedTasks);
    // Old tasks evicted
    expect(executor.getToolCallCount("task-unique-0")).toBe(0);
    // Recent tasks preserved
    expect(executor.getToolCallCount("task-unique-19")).toBe(1);
  });

  it("resets task tool call counters and restores quota", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "ping",
      description: "Ping tool",
      execute() {
        return "pong";
      }
    });

    const executor = new ActionExecutor(registry, 1);
    const ctx = createMockContext("task-reset-test");

    // Call 1: Consumes quota
    await expect(executor.execute("ping", {}, ctx)).resolves.toBe("pong");
    expect(executor.getToolCallCount("task-reset-test")).toBe(1);

    // Call 2: Blocked by maxToolCallsPerTask: 1
    await expect(executor.execute("ping", {}, ctx)).rejects.toMatchObject({
      code: "MAX_TOOL_CALLS_EXCEEDED"
    });

    // Reset task counter
    executor.reset("task-reset-test");
    expect(executor.getToolCallCount("task-reset-test")).toBe(0);

    // Call 3: Fresh quota granted, succeeds!
    await expect(executor.execute("ping", {}, ctx)).resolves.toBe("pong");
    expect(executor.getToolCallCount("task-reset-test")).toBe(1);

    // Reset all
    executor.resetAll();
    expect(executor.getTrackedTaskCount()).toBe(0);
  });
});
