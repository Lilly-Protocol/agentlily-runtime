import { describe, expect, it, vi } from "vitest";
import {
  ActionExecutor,
  AgentInstanceManager,
  InMemoryMemoryStore,
  InMemoryRuntimeStateStore,
  RuntimeError,
  RuntimeEventBus,
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

  it.each([undefined, 1])(
    "does not charge or emit for unresolved tools with limit %s",
    async (limit) => {
      const registry = new ToolRegistry();
      const events = new RuntimeEventBus();
      const onInvoked = vi.fn();
      events.on("runtime.tool.invoked", onInvoked);
      const executor = new ActionExecutor(registry, limit, events);
      const ctx = createMockContext("task-lookup");

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const failed = executor.execute("missing", {}, ctx);
        await expect(failed).rejects.toBeInstanceOf(RuntimeError);
        await expect(failed).rejects.toMatchObject({
          code: "TOOL_NOT_FOUND",
          details: { toolName: "missing" }
        });
        expect(executor.getToolCallCount(ctx.taskId)).toBe(0);
      }
      expect(onInvoked).not.toHaveBeenCalled();

      registry.register({
        name: "ping",
        description: "Ping",
        execute: () => "pong"
      });
      await expect(executor.execute("ping", {}, ctx)).resolves.toBe("pong");
      expect(executor.getToolCallCount(ctx.taskId)).toBe(1);
      expect(onInvoked).toHaveBeenCalledOnce();
    }
  );

  it("reserves the last slot before awaiting an in-flight tool", async () => {
    let finish!: (result: string) => void;
    const result = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const execute = vi.fn(() => result);
    const registry = new ToolRegistry();
    registry.register({ name: "slow", description: "Deferred tool", execute });
    const executor = new ActionExecutor(registry, 1);
    const ctx = createMockContext("task-in-flight");

    const first = executor.execute("slow", {}, ctx);
    try {
      expect(executor.getToolCallCount(ctx.taskId)).toBe(1);
      await expect(executor.execute("slow", {}, ctx)).rejects.toMatchObject({
        code: "MAX_TOOL_CALLS_EXCEEDED"
      });
      expect(execute).toHaveBeenCalledOnce();
    } finally {
      finish("done");
      await expect(first).resolves.toBe("done");
    }
  });

  it.each([false, true])(
    "charges resolved tools that fail (async=%s)",
    async (asyncFailure) => {
      const failure = new Error("tool failed");
      const execute = vi.fn(() => {
        if (asyncFailure) return Promise.reject(failure);
        throw failure;
      });
      const registry = new ToolRegistry();
      registry.register({ name: "failing", description: "Fails", execute });
      const executor = new ActionExecutor(registry, 1);
      const ctx = createMockContext("task-failed-tool");

      await expect(executor.execute("failing", {}, ctx)).rejects.toBe(failure);
      expect(executor.getToolCallCount(ctx.taskId)).toBe(1);
      await expect(executor.execute("failing", {}, ctx)).rejects.toMatchObject({
        code: "MAX_TOOL_CALLS_EXCEEDED"
      });
      expect(execute).toHaveBeenCalledOnce();
    }
  );

  it("preserves the exhausted-budget guard before lookup", async () => {
    const registry = new ToolRegistry();
    const get = vi.spyOn(registry, "get");
    const executor = new ActionExecutor(registry, 0);
    await expect(
      executor.execute("missing", {}, createMockContext("task-zero"))
    ).rejects.toMatchObject({
      code: "MAX_TOOL_CALLS_EXCEEDED"
    });
    expect(get).not.toHaveBeenCalled();
    expect(executor.getToolCallCount("task-zero")).toBe(0);
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
