import { describe, expect, it } from "vitest";
import {
  ActionExecutor,
  AgentInstanceManager,
  InMemoryMemoryStore,
  TaskRunner,
  ToolRegistry,
  UnconfiguredModelProvider,
  InMemoryRuntimeStateStore
} from "../src/index.js";
import { RuntimeError } from "../src/errors/runtime-errors.js";

describe("TaskRunner error propagation", () => {
  it("wraps plain Error in EXECUTION_FAILED", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "explode",
      description: "Throws a plain Error",
      execute() {
        throw new Error("boom");
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(toolRegistry),
      new InMemoryMemoryStore()
    );
    const agent = new AgentInstanceManager().getOrCreate("agent-1");

    await expect(
      runner.run(
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
      )
    ).rejects.toMatchObject({
      code: "EXECUTION_FAILED"
    });
  });

  it("propagates RuntimeError unchanged (preserves original code)", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "runtime-fail",
      description: "Throws a typed RuntimeError",
      execute() {
        throw new RuntimeError("TOOL_TIMEOUT", "Tool timed out");
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(toolRegistry),
      new InMemoryMemoryStore()
    );
    const agent = new AgentInstanceManager().getOrCreate("agent-1");

    await expect(
      runner.run(
        {
          taskId: "task-6",
          agentId: "agent-1",
          toolName: "runtime-fail",
          input: "Trigger runtime error",
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
      )
    ).rejects.toMatchObject({
      code: "TOOL_TIMEOUT"
    });
  });
});
