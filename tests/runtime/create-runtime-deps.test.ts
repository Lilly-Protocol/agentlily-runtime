import { describe, it, expect, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRuntimeDependencies } from "../../src/runtime/bootstrap.js";
import {
  InMemoryMemoryStore,
  JsonFileMemoryStore
} from "../../src/memory/memory-store.js";
import { UnconfiguredModelProvider } from "../../src/providers/model-provider.js";
import { ConsoleRuntimeLogger } from "../../src/logger/runtime-logger.js";
import { InMemoryRuntimeStateStore } from "../../src/state/runtime-state.js";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import type { ToolDefinition } from "../../src/tools/types.js";

describe("createRuntimeDependencies default wiring (Issue #114)", () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    for (const dir of createdDirs) {
      if (existsSync(dir)) {
        await rm(dir, { recursive: true, force: true });
      }
    }
    createdDirs.length = 0;
  });

  it("provides all required dependency keys with non-null instances", () => {
    const deps = createRuntimeDependencies({ runtimeId: "default-wiring" });
    expect(deps.actionExecutor).toBeDefined();
    expect(deps.agentManager).toBeDefined();
    expect(deps.eventBus).toBeDefined();
    expect(deps.logger).toBeDefined();
    expect(deps.memoryStore).toBeDefined();
    expect(deps.modelProvider).toBeDefined();
    expect(deps.stateStore).toBeDefined();
    expect(deps.taskRunner).toBeDefined();
    expect(deps.toolRegistry).toBeDefined();
  });

  it("uses InMemoryMemoryStore when no memoryStore option provided", () => {
    const deps = createRuntimeDependencies({ runtimeId: "default-mem" });
    expect(deps.memoryStore).toBeInstanceOf(InMemoryMemoryStore);
  });

  it("uses UnconfiguredModelProvider when no modelProvider option provided", () => {
    const deps = createRuntimeDependencies({ runtimeId: "default-model" });
    expect(deps.modelProvider).toBeInstanceOf(UnconfiguredModelProvider);
  });

  it("uses ConsoleRuntimeLogger when no logger option provided", () => {
    const deps = createRuntimeDependencies({ runtimeId: "default-logger" });
    expect(deps.logger).toBeInstanceOf(ConsoleRuntimeLogger);
  });

  it("uses InMemoryRuntimeStateStore when no stateStore option provided", () => {
    const deps = createRuntimeDependencies({ runtimeId: "default-state" });
    expect(deps.stateStore).toBeInstanceOf(InMemoryRuntimeStateStore);
  });

  it("uses RuntimeEventBus when no eventBus option provided", () => {
    const deps = createRuntimeDependencies({ runtimeId: "default-events" });
    expect(deps.eventBus).toBeInstanceOf(RuntimeEventBus);
  });

  it("respects injected memoryStore over default", () => {
    const customStore = new InMemoryMemoryStore();
    const deps = createRuntimeDependencies({
      runtimeId: "custom-mem",
      memoryStore: customStore
    });
    expect(deps.memoryStore).toBe(customStore);
  });

  it("respects injected eventBus over default", () => {
    const customBus = new RuntimeEventBus();
    const deps = createRuntimeDependencies({
      runtimeId: "custom-events",
      eventBus: customBus
    });
    expect(deps.eventBus).toBe(customBus);
  });

  it("selects JsonFileMemoryStore with matching filePath when memoryStoragePath is provided (Issue #245)", () => {
    const dir = join(
      tmpdir(),
      `agentlily-deps-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    createdDirs.push(dir);
    const storagePath = join(dir, "memory.json");

    const deps = createRuntimeDependencies({
      runtimeId: "durable-mem-deps",
      memoryStoragePath: storagePath
    });

    expect(deps.memoryStore).toBeInstanceOf(JsonFileMemoryStore);
    const fileStore = deps.memoryStore as JsonFileMemoryStore;
    expect(fileStore.getFilePath()).toBe(storagePath);
  });

  it("persists task execution results to memoryStoragePath across runtime instances (Issue #245)", async () => {
    const dir = join(
      tmpdir(),
      `agentlily-deps-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    createdDirs.push(dir);
    const storagePath = join(dir, "task-history.json");

    const echoTool: ToolDefinition<{ text: string }, { echoed: string }> = {
      name: "echo",
      description: "Echoes input text",
      execute: async ({ payload }) => ({ echoed: payload.text })
    };

    const runtime1 = new AgentRuntime({
      runtimeId: "rt-persist-1",
      memoryStoragePath: storagePath,
      tools: [echoTool]
    });

    await runtime1.start();
    const result = await runtime1.executeTask({
      taskId: "task-persist-1",
      agentId: "agent-durable",
      toolName: "echo",
      input: JSON.stringify({ text: "hello durable world" }),
      payload: { text: "hello durable world" }
    });

    expect(result.output).toEqual({ echoed: "hello durable world" });
    expect(result.taskId).toBe("task-persist-1");
    expect(result.agentId).toBe("agent-durable");
    expect(result.toolName).toBe("echo");
    await runtime1.stop();

    // Verify file exists on disk
    expect(existsSync(storagePath)).toBe(true);

    // Create a second runtime pointing to the same storage path and check persistence
    const runtime2 = new AgentRuntime({
      runtimeId: "rt-persist-2",
      memoryStoragePath: storagePath
    });

    const secondStore = runtime2.getDependencies().memoryStore;
    const history = await secondStore.listByAgent("agent-durable");
    expect(history).toHaveLength(1);
    expect(history[0]?.taskId).toBe("task-persist-1");
    expect(history[0]?.agentId).toBe("agent-durable");
    expect(history[0]?.input).toBe(JSON.stringify({ text: "hello durable world" }));
    expect(history[0]?.output).toEqual({ echoed: "hello durable world" });
  });
});
