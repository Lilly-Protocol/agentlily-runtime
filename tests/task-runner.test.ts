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
import type { RuntimeContext } from "../src/index.js";
import type { ToolDefinition } from "../src/index.js";

function createRunner(tool: ToolDefinition) {
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(tool);

  return new TaskRunner(
    new ActionExecutor(toolRegistry),
    new InMemoryMemoryStore()
  );
}

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

describe("TaskRunner", () => {
  it("propagates a plain tool Error unchanged", async () => {
    const original = new Error("boom");
    const runner = createRunner({
      name: "explode",
      description: "Throws unexpectedly",
      execute() {
        throw original;
      }
    });

    try {
      await runner.run(
        {
          taskId: "task-5",
          agentId: "agent-1",
          toolName: "explode",
          input: "Trigger failure",
          payload: {}
        },
        createContext("task-5")
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBe(original);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(RuntimeError);
      expect((error as Error).message).toBe("boom");
    }
  });

  it("propagates a tool RuntimeError with its original code", async () => {
    const original = new RuntimeError("TOOL_NOT_FOUND", "Tool missing");
    const runner = createRunner({
      name: "typed-fail",
      description: "Throws a typed runtime error",
      execute() {
        throw original;
      }
    });

    try {
      await runner.run(
        {
          taskId: "task-6",
          agentId: "agent-1",
          toolName: "typed-fail",
          input: "Trigger typed failure",
          payload: {}
        },
        createContext("task-6")
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBe(original);
      expect(error).toBeInstanceOf(RuntimeError);
      expect((error as RuntimeError).code).toBe("TOOL_NOT_FOUND");
    }
  });
});
