import { describe, expect, it, vi } from "vitest";
import { ActionExecutor } from "../../src/actions/action-executor.js";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";
import type { RuntimeContext } from "../../src/runtime/context.js";
import { ToolRegistry } from "../../src/tools/tool-registry.js";
import type { ToolDefinition } from "../../src/tools/types.js";

// These tools do not access the context's memory, provider, or state ports.
const context = (taskId: string): RuntimeContext =>
  ({
    runtimeId: "merge-regression",
    taskId,
    agent: { agentId: "agent", createdAt: "2026-01-01T00:00:00.000Z" }
  }) as RuntimeContext;

const registryWithPing = (): ToolRegistry => {
  const registry = new ToolRegistry();
  registry.register({
    name: "ping",
    description: "ping",
    execute: () => "pong"
  });
  return registry;
};

describe("ActionExecutor merge regression", () => {
  it.each(["second", "third", "fourth"] as const)(
    "preserves the %s logger argument and the tool/event contracts",
    async (position) => {
      const registry = new ToolRegistry();
      const execute = vi.fn<ToolDefinition["execute"]>(async () => "result");
      registry.register({ name: "echo", description: "echo", execute });
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      const eventBus = new RuntimeEventBus();
      const invoked = vi.fn();
      eventBus.on("runtime.tool.invoked", invoked);
      const executor =
        position === "second"
          ? new ActionExecutor(registry, logger, eventBus)
          : position === "third"
            ? new ActionExecutor(registry, 1, logger)
            : new ActionExecutor(registry, 1, eventBus, logger);
      const payload = { value: 7 };
      const task = context("contract");

      await expect(executor.execute("echo", payload, task)).resolves.toBe(
        "result"
      );
      expect(execute).toHaveBeenCalledExactlyOnceWith({
        payload,
        context: task
      });
      expect(execute.mock.calls[0]?.[0].context).toBe(task);
      expect(logger.info).toHaveBeenCalledExactlyOnceWith(
        "Tool invocation completed.",
        {
          toolName: "echo",
          durationMs: expect.any(Number)
        }
      );
      if (position !== "third") {
        expect(invoked).toHaveBeenCalledExactlyOnceWith({
          name: "runtime.tool.invoked",
          payload: {
            runtimeId: task.runtimeId,
            taskId: task.taskId,
            agentId: "agent",
            toolName: "echo",
            invokedAt: expect.any(String)
          }
        });
        expect(
          Number.isNaN(Date.parse(invoked.mock.calls[0]?.[0].payload.invokedAt))
        ).toBe(false);
      }
    }
  );

  it("does not charge, emit, or evict an existing task on a failed lookup", async () => {
    const eventBus = new RuntimeEventBus();
    const invoked = vi.fn();
    eventBus.on("runtime.tool.invoked", invoked);
    const executor = new ActionExecutor(registryWithPing(), 1, eventBus, 1);
    await executor.execute("ping", {}, context("existing"));

    await expect(
      executor.execute("missing", {}, context("new"))
    ).rejects.toMatchObject({
      code: "TOOL_NOT_FOUND",
      details: { toolName: "missing" }
    });
    expect(executor.getToolCallCount("new")).toBe(0);
    expect(executor.getToolCallCount("existing")).toBe(1);
    expect(invoked).toHaveBeenCalledTimes(1);
    await expect(executor.execute("ping", {}, context("new"))).resolves.toBe(
      "pong"
    );
  });

  it.each([false, true])(
    "charges a registered tool failure (async=%s)",
    async (isAsync) => {
      const registry = new ToolRegistry();
      const failure = new Error("tool failed");
      registry.register({
        name: "fail",
        description: "fail",
        execute: () => {
          if (isAsync) return Promise.reject(failure);
          throw failure;
        }
      });
      const executor = new ActionExecutor(registry, 1);
      const task = context("failure");
      await expect(executor.execute("fail", {}, task)).rejects.toBe(failure);
      expect(executor.getToolCallCount(task.taskId)).toBe(1);
      await expect(executor.execute("fail", {}, task)).rejects.toMatchObject({
        code: "MAX_TOOL_CALLS_EXCEEDED"
      });
    }
  );

  it.each([false, true])(
    "reserves an in-flight call even when it rejects=%s",
    async (rejects) => {
      let resolve!: (value: string) => void;
      let reject!: (reason: Error) => void;
      const deferred = new Promise<string>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      const registry = new ToolRegistry();
      const execute = vi.fn(() => deferred);
      registry.register({ name: "wait", description: "wait", execute });
      const executor = new ActionExecutor(registry, 1);
      const task = context("pending");
      const pending = executor.execute("wait", {}, task);
      expect(executor.getToolCallCount(task.taskId)).toBe(1);
      await expect(executor.execute("wait", {}, task)).rejects.toMatchObject({
        code: "MAX_TOOL_CALLS_EXCEEDED"
      });
      expect(execute).toHaveBeenCalledTimes(1);
      if (rejects) {
        const failure = new Error("deferred failure");
        const assertion = expect(pending).rejects.toBe(failure);
        reject(failure);
        await assertion;
      } else {
        resolve("done");
        await expect(pending).resolves.toBe("done");
      }
      expect(executor.getToolCallCount(task.taskId)).toBe(1);
    }
  );

  it("retains guard precedence for a zero budget and an exhausted budget", async () => {
    const registry = registryWithPing();
    const lookup = vi.spyOn(registry, "get");
    const disabled = new ActionExecutor(registry, 0);
    await expect(
      disabled.execute("missing", {}, context("zero"))
    ).rejects.toMatchObject({
      code: "MAX_TOOL_CALLS_EXCEEDED"
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(disabled.getToolCallCount("zero")).toBe(0);
    const limited = new ActionExecutor(registry, 1);
    await limited.execute("ping", {}, context("full"));
    await expect(
      limited.execute("missing", {}, context("full"))
    ).rejects.toMatchObject({
      code: "MAX_TOOL_CALLS_EXCEEDED"
    });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("retains the numeric fourth argument, FIFO eviction, and reset APIs", async () => {
    const executor = new ActionExecutor(registryWithPing(), 1, undefined, 2);
    await executor.execute("ping", {}, context("a"));
    await executor.execute("ping", {}, context("b"));
    await executor.execute("ping", {}, context("c"));
    expect(executor.getToolCallCount("a")).toBe(0);
    expect(executor.getToolCallCount("b")).toBe(1);
    expect(executor.getToolCallCount("c")).toBe(1);
    executor.reset("b");
    await expect(executor.execute("ping", {}, context("b"))).resolves.toBe(
      "pong"
    );
    executor.resetAll();
    expect(executor.getToolCallCount("b")).toBe(0);
    expect(executor.getToolCallCount("c")).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid retention cap %s",
    (cap) => {
      expect(
        () => new ActionExecutor(registryWithPing(), undefined, undefined, cap)
      ).toThrow("maxTrackedTasks must be a positive integer.");
    }
  );
});
