import { describe, expect, it } from "vitest";
import {
  ActionExecutor,
  AgentInstanceManager,
  InMemoryMemoryStore,
  RuntimeError,
  TaskRunner,
  ToolRegistry,
  UnconfiguredModelProvider,
  InMemoryRuntimeStateStore
} from "../src/index.js";
import type {
  MemoryStore,
  RuntimeContext,
  ToolDefinition
} from "../src/index.js";

function createContext(taskId: string): RuntimeContext {
  return {
    runtimeId: "runtime-1",
    taskId,
    agent: new AgentInstanceManager().getOrCreate("agent-1"),
    memory: new InMemoryMemoryStore(),
    modelProvider: new UnconfiguredModelProvider(),
    state: new InMemoryRuntimeStateStore(),
    now: new Date().toISOString()
  };
}

function createRunner(
  tool: ToolDefinition,
  memoryStore: MemoryStore = new InMemoryMemoryStore()
): TaskRunner {
  const registry = new ToolRegistry();
  registry.register(tool);
  return new TaskRunner(new ActionExecutor(registry), memoryStore);
}

describe("TaskRunner", () => {
  it("propagates a plain tool Error unchanged", async () => {
    const failure = new Error("boom");
    const runner = createRunner({
      name: "explode",
      description: "Throws unexpectedly",
      execute() {
        throw failure;
      }
    });

    await expect(
      runner.run(
        {
          taskId: "task-5",
          agentId: "agent-1",
          toolName: "explode",
          input: "Trigger failure",
          payload: {}
        },
        createContext("task-5")
      )
    ).rejects.toBe(failure);
  });

  it("preserves a tool RuntimeError and its original code", async () => {
    const failure = new RuntimeError("TOOL_NOT_FOUND", "tool rejected task");
    const runner = createRunner({
      name: "reject",
      description: "Throws a typed RuntimeError",
      execute() {
        throw failure;
      }
    });

    try {
      await runner.run(
        {
          taskId: "task-6",
          agentId: "agent-1",
          toolName: "reject",
          input: "Trigger typed failure",
          payload: {}
        },
        createContext("task-6")
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBe(failure);
      expect(error).toBeInstanceOf(RuntimeError);
      expect((error as RuntimeError).code).toBe("TOOL_NOT_FOUND");
    }
  });

  it("wraps plain memory append failures in EXECUTION_FAILED", async () => {
    const memoryStore: MemoryStore = {
      append: async () => {
        throw new Error("disk unavailable");
      },
      listByAgent: async () => []
    };
    const runner = createRunner(
      {
        name: "ok",
        description: "Returns normally",
        execute: async () => ({ ok: true })
      },
      memoryStore
    );

    await expect(
      runner.run(
        {
          taskId: "task-7",
          agentId: "agent-1",
          toolName: "ok",
          input: "Persist output",
          payload: {}
        },
        createContext("task-7")
      )
    ).rejects.toMatchObject({
      code: "EXECUTION_FAILED",
      message: "disk unavailable",
      details: { cause: "disk unavailable" }
    });
  });

  it("wraps typed RuntimeErrors from memory append in EXECUTION_FAILED", async () => {
    const memoryStore: MemoryStore = {
      append: async () => {
        throw new RuntimeError("TOOL_NOT_FOUND", "store rejected append");
      },
      listByAgent: async () => []
    };
    const runner = createRunner(
      {
        name: "ok",
        description: "Returns normally",
        execute: async () => ({ ok: true })
      },
      memoryStore
    );

    await expect(
      runner.run(
        {
          taskId: "task-8",
          agentId: "agent-1",
          toolName: "ok",
          input: "Persist typed failure",
          payload: {}
        },
        createContext("task-8")
      )
    ).rejects.toMatchObject({
      code: "EXECUTION_FAILED",
      message: "store rejected append",
      details: { cause: "store rejected append" }
    });
  });
});
