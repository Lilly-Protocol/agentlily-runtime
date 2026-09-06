import { describe, expect, it } from "vitest";
import {
  ActionExecutor,
  AgentInstanceManager,
  InMemoryMemoryStore,
  RuntimeError,
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
    const expected = new Error("boom");

    toolRegistry.register({
      name: "explode",
      description: "Throws a plain Error",
      execute() {
        throw failure;
      }
    });

    await expect(
      runner.run(
        {
          taskId: "task-6",
          agentId: "agent-1",
          toolName: "missing",
          input: "Trigger typed failure",
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
