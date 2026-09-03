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

describe("TaskRunner", () => {
  it("propagates plain Error thrown by tool untouched without EXECUTION_FAILED wrapper", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "explode",
      description: "Throws unexpectedly",
      execute() {
        throw new Error("boom");
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(toolRegistry),
      new InMemoryMemoryStore()
    );
    const agent = new AgentInstanceManager().getOrCreate("agent-1");

    let caught: unknown;
    try {
      await runner.run(
        {
          taskId: "task-5",
          agentId: "agent-1",
          toolName: "explode",
          input: "Trigger failure",
          payload: {}
        },
        {
          runtimeId: "runtime-1",
          taskId: "task-5",
          agent,
          memory: new InMemoryMemoryStore(),
          modelProvider: new UnconfiguredModelProvider(),
          state: new InMemoryRuntimeStateStore(),
          now: new Date().toISOString()
        }
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RuntimeError);
    expect((caught as Error).message).toBe("boom");
  });

  it("propagates RuntimeError thrown by tool preserving original code", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "typedExplode",
      description: "Throws typed error",
      execute() {
        throw new RuntimeError("TOOL_NOT_FOUND", "Missing dependency");
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(toolRegistry),
      new InMemoryMemoryStore()
    );
    const agent = new AgentInstanceManager().getOrCreate("agent-1");

    let caught: unknown;
    try {
      await runner.run(
        {
          taskId: "task-6",
          agentId: "agent-1",
          toolName: "typedExplode",
          input: "Trigger failure",
          payload: {}
        },
        {
          runtimeId: "runtime-1",
          taskId: "task-6",
          agent,
          memory: new InMemoryMemoryStore(),
          modelProvider: new UnconfiguredModelProvider(),
          state: new InMemoryRuntimeStateStore(),
          now: new Date().toISOString()
        }
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RuntimeError);
    expect((caught as RuntimeError).code).toBe("TOOL_NOT_FOUND");
    expect((caught as RuntimeError).message).toBe("Missing dependency");
  });
});
