import { describe, expect, it } from "vitest";
import {
  ActionExecutor,
  AgentInstanceManager,
  InMemoryMemoryStore,
  InMemoryRuntimeStateStore,
  RuntimeError,
  TaskRunner,
  ToolRegistry,
  UnconfiguredModelProvider,
  type RuntimeContext
} from "../../src/index.js";

describe("Reproduce Issue #252: Tool execution error propagation contract", () => {
  const createMockContext = (taskId: string): RuntimeContext => ({
    runtimeId: "rt-test-252",
    taskId,
    agent: new AgentInstanceManager().getOrCreate("agent-252"),
    memory: new InMemoryMemoryStore(),
    modelProvider: new UnconfiguredModelProvider(),
    state: new InMemoryRuntimeStateStore(),
    now: new Date().toISOString()
  });

  it("propagates a plain Error thrown by a tool untouched without RuntimeError wrapper", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "plainExplode",
      description: "Throws plain error",
      execute() {
        throw new Error("tool exploded");
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(registry),
      new InMemoryMemoryStore()
    );

    let caught: unknown;
    try {
      await runner.run(
        {
          taskId: "task-1",
          agentId: "agent-252",
          toolName: "plainExplode",
          input: "run",
          payload: {}
        },
        createMockContext("task-1")
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RuntimeError);
    expect((caught as Error).message).toBe("tool exploded");
  });

  it("propagates RuntimeError thrown by tool preserving original code and error", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "runtimeExplode",
      description: "Throws RuntimeError",
      execute() {
        throw new RuntimeError("TOOL_NOT_FOUND", "tool exploded with runtime error");
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(registry),
      new InMemoryMemoryStore()
    );

    let caught: unknown;
    try {
      await runner.run(
        {
          taskId: "task-2",
          agentId: "agent-252",
          toolName: "runtimeExplode",
          input: "run",
          payload: {}
        },
        createMockContext("task-2")
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RuntimeError);
    const runtimeErr = caught as RuntimeError;
    expect(runtimeErr.code).toBe("TOOL_NOT_FOUND");
    expect(runtimeErr.message).toBe("tool exploded with runtime error");
  });

  it("wraps memoryStore.append rejection in RuntimeError(EXECUTION_FAILED, cause)", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "okTool",
      description: "Successful tool",
      execute() {
        return { success: true };
      }
    });

    const failingStore = {
      append: async () => {
        throw new Error("disk full");
      },
      listByAgent: async () => []
    };

    const runner = new TaskRunner(
      new ActionExecutor(registry),
      failingStore as any
    );

    let caught: unknown;
    try {
      await runner.run(
        {
          taskId: "task-3",
          agentId: "agent-252",
          toolName: "okTool",
          input: "run",
          payload: {}
        },
        createMockContext("task-3")
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RuntimeError);
    const runtimeErr = caught as RuntimeError;
    expect(runtimeErr.code).toBe("EXECUTION_FAILED");
    expect(runtimeErr.message).toBe("disk full");
    expect(runtimeErr.details?.cause).toBe("disk full");
  });
});
