import { describe, it, expect, vi } from "vitest";
import { ActionExecutor } from "../../src/actions/action-executor.js";
import { ToolRegistry } from "../../src/tools/tool-registry.js";
import { createRuntimeDependencies } from "../../src/runtime/bootstrap.js";
import type { RuntimeLogger } from "../../src/logger/runtime-logger.js";
import type { RuntimeContext } from "../../src/runtime/context.js";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";
import { InMemoryMemoryStore } from "../../src/memory/memory-store.js";
import { InMemoryRuntimeStateStore } from "../../src/state/runtime-state.js";
import { UnconfiguredModelProvider } from "../../src/providers/model-provider.js";

describe("ActionExecutor logger injection (Issue #238)", () => {
  it("injects logger into ActionExecutor in createRuntimeDependencies and logs on execution", async () => {
    const infoSpy = vi.fn();
    const mockLogger: RuntimeLogger = {
      info: infoSpy,
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn()
    };

    const deps = createRuntimeDependencies({
      runtimeId: "rt-test-logger",
      logger: mockLogger,
      tools: [
        {
          name: "test-tool",
          description: "A test tool",
          execute: vi.fn(async () => ({ success: true }))
        }
      ]
    });

    const context: RuntimeContext = {
      runtimeId: "rt-1",
      taskId: "task-1",
      agent: { agentId: "agent-1", createdAt: new Date().toISOString() },
      memory: new InMemoryMemoryStore(),
      modelProvider: new UnconfiguredModelProvider(),
      state: new InMemoryRuntimeStateStore(),
      now: new Date().toISOString()
    };

    const result = await deps.actionExecutor.execute("test-tool", {}, context);
    expect(result).toEqual({ success: true });

    expect(infoSpy).toHaveBeenCalled();
    const matchingCall = infoSpy.mock.calls.find(([msg]) =>
      msg.includes("Tool invocation completed")
    );
    expect(matchingCall).toBeDefined();
    expect(matchingCall![1]).toMatchObject({
      toolName: "test-tool"
    });
    expect(matchingCall![1].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("constructs ActionExecutor with (registry, maxToolCalls, eventBus, logger)", async () => {
    const infoSpy = vi.fn();
    const mockLogger: RuntimeLogger = {
      info: infoSpy,
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn()
    };
    const eventBus = new RuntimeEventBus();
    const registry = new ToolRegistry();
    registry.register({
      name: "tool-a",
      description: "tool a",
      execute: vi.fn(async () => "done")
    });

    const executor = new ActionExecutor(registry, 10, eventBus, mockLogger);
    const context: RuntimeContext = {
      runtimeId: "rt-2",
      taskId: "task-2",
      agent: { agentId: "agent-2", createdAt: new Date().toISOString() },
      memory: new InMemoryMemoryStore(),
      modelProvider: new UnconfiguredModelProvider(),
      state: new InMemoryRuntimeStateStore(),
      now: new Date().toISOString()
    };

    const result = await executor.execute("tool-a", {}, context);
    expect(result).toBe("done");
    expect(infoSpy).toHaveBeenCalledWith("Tool invocation completed.", {
      toolName: "tool-a",
      durationMs: expect.any(Number)
    });
  });

  it("constructs ActionExecutor without logger without throwing", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "tool-b",
      description: "tool b",
      execute: vi.fn(async () => "ok")
    });

    const executor = new ActionExecutor(registry);
    const context: RuntimeContext = {
      runtimeId: "rt-3",
      taskId: "task-3",
      agent: { agentId: "agent-3", createdAt: new Date().toISOString() },
      memory: new InMemoryMemoryStore(),
      modelProvider: new UnconfiguredModelProvider(),
      state: new InMemoryRuntimeStateStore(),
      now: new Date().toISOString()
    };

    await expect(executor.execute("tool-b", {}, context)).resolves.toBe("ok");
  });
});
