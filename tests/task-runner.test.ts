import { describe, expect, it } from "vitest";
import {
  ActionExecutor,
  AgentInstanceManager,
  InMemoryMemoryStore,
  InMemoryRuntimeStateStore,
  RuntimeError,
  TaskRunner,
  ToolRegistry,
  UnconfiguredModelProvider
} from "../src/index.js";

function createContext(taskId: string) {
  const agent = new AgentInstanceManager().getOrCreate("agent-1");
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

describe("TaskRunner tool error propagation", () => {
  it("propagates plain tool errors unchanged", async () => {
    const toolRegistry = new ToolRegistry();
    const expected = new Error("boom");

    toolRegistry.register({
      name: "explode",
      description: "Throws unexpectedly",
      execute() {
        throw expected;
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(toolRegistry),
      new InMemoryMemoryStore()
    );

    const promise = runner.run(
      {
        taskId: "task-5",
        agentId: "agent-1",
        toolName: "explode",
        input: "Trigger failure",
        payload: {}
      },
      createContext("task-5")
    );

    await expect(promise).rejects.toBe(expected);
  });

  it("preserves typed RuntimeError codes from tools", async () => {
    const toolRegistry = new ToolRegistry();
    const expected = new RuntimeError("TOOL_NOT_FOUND", "Tool missing");

    toolRegistry.register({
      name: "missing",
      description: "Throws a typed runtime error",
      execute() {
        throw expected;
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(toolRegistry),
      new InMemoryMemoryStore()
    );

    await expect(
      runner.run(
        {
          taskId: "task-6",
          agentId: "agent-1",
          toolName: "missing",
          input: "Trigger typed failure",
          payload: {}
        },
        createContext("task-6")
      )
    ).rejects.toMatchObject({
      code: "TOOL_NOT_FOUND"
    });
  });
});
