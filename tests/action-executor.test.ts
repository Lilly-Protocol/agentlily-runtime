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
});
