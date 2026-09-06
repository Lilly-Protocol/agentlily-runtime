import { describe, expect, it } from "vitest";
import {
  ActionExecutor,
  AgentInstanceManager,
  InMemoryMemoryStore,
  InMemoryRuntimeStateStore,
  ToolRegistry,
  UnconfiguredModelProvider
} from "../../src/index.js";
import type { RuntimeContext } from "../../src/index.js";

const context = (taskId: string): RuntimeContext => ({
  runtimeId: "retention-runtime",
  taskId,
  agent: new AgentInstanceManager().getOrCreate("agent"),
  memory: new InMemoryMemoryStore(),
  modelProvider: new UnconfiguredModelProvider(),
  state: new InMemoryRuntimeStateStore(),
  now: new Date().toISOString()
});

const registryWithPing = (): ToolRegistry => {
  const registry = new ToolRegistry();
  registry.register({
    name: "ping",
    description: "ping",
    execute: () => "pong"
  });
  return registry;
};

describe("ActionExecutor retained task counters", () => {
  it("evicts the oldest task counter once the configured retention cap is reached", async () => {
    const executor = new ActionExecutor(
      registryWithPing(),
      undefined,
      undefined,
      2
    );

    await executor.execute("ping", {}, context("task-a"));
    await executor.execute("ping", {}, context("task-b"));
    expect(executor.getToolCallCount("task-a")).toBe(1);

    await executor.execute("ping", {}, context("task-c"));

    expect(executor.getToolCallCount("task-a")).toBe(0);
    expect(executor.getToolCallCount("task-b")).toBe(1);
    expect(executor.getToolCallCount("task-c")).toBe(1);
  });

  it("reset gives a task a fresh call budget", async () => {
    const executor = new ActionExecutor(registryWithPing(), 1);
    const task = context("limited-task");

    await expect(executor.execute("ping", {}, task)).resolves.toBe("pong");
    await expect(executor.execute("ping", {}, task)).rejects.toMatchObject({
      code: "MAX_TOOL_CALLS_EXCEEDED"
    });

    executor.reset("limited-task");
    expect(executor.getToolCallCount("limited-task")).toBe(0);
    await expect(executor.execute("ping", {}, task)).resolves.toBe("pong");
  });

  it("resetAll clears every retained task counter", async () => {
    const executor = new ActionExecutor(registryWithPing());
    await executor.execute("ping", {}, context("task-a"));
    await executor.execute("ping", {}, context("task-b"));

    executor.resetAll();

    expect(executor.getToolCallCount("task-a")).toBe(0);
    expect(executor.getToolCallCount("task-b")).toBe(0);
  });
});
