import { describe, expect, it } from "vitest";
import {
  ActionExecutor,
  AgentInstanceManager,
  InMemoryMemoryStore,
  TaskRunner,
  ToolRegistry,
  UnconfiguredModelProvider,
  InMemoryRuntimeStateStore,
  RuntimeError,
  type RuntimeErrorCode
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

  it("preserves tool-thrown RuntimeError code, message, and details without wrapping", async () => {
    const customDetails = {
      reason: "validation_constraint",
      field: "amount",
      value: -50
    };
    const customMessage =
      "Payment authorization rejected due to invalid parameters";
    const customCode: RuntimeErrorCode = "MAX_TOOL_CALLS_EXCEEDED";

    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "pay",
      description: "Throws typed RuntimeError",
      execute() {
        throw new RuntimeError(customCode, customMessage, customDetails);
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
          taskId: "task-typed-err",
          agentId: "agent-1",
          toolName: "pay",
          input: "Send payment",
          payload: {}
        },
        {
          runtimeId: "runtime-1",
          taskId: "task-typed-err",
          agent,
          memory: new InMemoryMemoryStore(),
          modelProvider: new UnconfiguredModelProvider(),
          state: new InMemoryRuntimeStateStore(),
          now: new Date().toISOString()
        }
      );
      expect.unreachable("should have thrown RuntimeError");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeError);
      const err = error as RuntimeError;
      expect(err.code).toBe(customCode);
      expect(err.code).not.toBe("EXECUTION_FAILED");
      expect(err.message).toBe(customMessage);
      expect(err.details).toEqual(customDetails);
    }
  });

  it("propagates standard RuntimeError instances directly", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "duplicate_tool",
      description: "Throws DUPLICATE_TOOL",
      execute() {
        throw new RuntimeError("DUPLICATE_TOOL", "Tool already registered", {
          toolName: "duplicate_tool"
        });
      }
    });

    const runner = new TaskRunner(
      new ActionExecutor(toolRegistry),
      new InMemoryMemoryStore()
    );
    const agent = new AgentInstanceManager().getOrCreate("agent-2");

    await expect(
      runner.run(
        {
          taskId: "task-dup",
          agentId: "agent-2",
          toolName: "duplicate_tool",
          input: "Trigger duplicate tool error",
          payload: {}
        },
        {
          runtimeId: "runtime-1",
          taskId: "task-dup",
          agent,
          memory: new InMemoryMemoryStore(),
          modelProvider: new UnconfiguredModelProvider(),
          state: new InMemoryRuntimeStateStore(),
          now: new Date().toISOString()
        }
      )
    ).rejects.toMatchObject({
      code: "DUPLICATE_TOOL",
      message: "Tool already registered",
      details: { toolName: "duplicate_tool" }
    });
  });
});
