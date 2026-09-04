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
  function makeContext(
    agent: ReturnType<AgentInstanceManager["getOrCreate"]>,
    taskId: string
  ) {
    return {
      runtimeId: "runtime-1",
      taskId,
      agent,
      memory: new InMemoryMemoryStore(),
      modelProvider: new UnconfiguredModelProvider(),
      state: new InMemoryRuntimeStateStore(),
      now: new Date().toISOString()
    };
  }

  it("propagates a plain tool Error unchanged", async () => {
    const toolError = new Error("boom");
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "explode",
      description: "Throws unexpectedly",
      execute() {
        throw toolError;
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(toolRegistry),
      new InMemoryMemoryStore()
    );
    const agent = new AgentInstanceManager().getOrCreate("agent-1");

    try {
      await runner.run(
        {
          taskId: "task-5",
          agentId: "agent-1",
          toolName: "explode",
          input: "Trigger failure",
          payload: {}
        },
        makeContext(agent, "task-5")
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBe(toolError);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(RuntimeError);
      expect((error as Error).message).toBe("boom");
    }
  });

  it("preserves the original code of a tool-thrown RuntimeError", async () => {
    const toolError = new RuntimeError("TOOL_NOT_FOUND", "Tool missing");
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "typed-fail",
      description: "Throws a typed runtime error",
      execute() {
        throw toolError;
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(toolRegistry),
      new InMemoryMemoryStore()
    );
    const agent = new AgentInstanceManager().getOrCreate("agent-1");

    try {
      await runner.run(
        {
          taskId: "task-6",
          agentId: "agent-1",
          toolName: "typed-fail",
          input: "Trigger typed failure",
          payload: {}
        },
        makeContext(agent, "task-6")
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBe(toolError);
      expect(error).toBeInstanceOf(RuntimeError);
      expect((error as RuntimeError).code).toBe("TOOL_NOT_FOUND");
      expect((error as RuntimeError).message).toBe("Tool missing");
    }
  });
});
