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
});

describe("createRuntimeDependencies memoryStoragePath wiring (Issue #245)", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirectories) {
      if (existsSync(dir)) {
        await rm(dir, { recursive: true, force: true });
      }
    }
    tempDirectories.length = 0;
  });

  it("selects JsonFileMemoryStore with the expected file path when memoryStoragePath is set", () => {
    const tempDir = join(
      tmpdir(),
      `agentlily-test-deps-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    tempDirectories.push(tempDir);
    const targetFile = join(tempDir, "storage.json");

    const deps = createRuntimeDependencies({
      runtimeId: "test-durable-deps",
      memoryStoragePath: targetFile
    });

    expect(deps.memoryStore).toBeInstanceOf(JsonFileMemoryStore);
    const fileStore = deps.memoryStore as JsonFileMemoryStore;
    expect(fileStore.getFilePath()).toBe(targetFile);
  });

  it("selects InMemoryMemoryStore when memoryStoragePath is omitted", () => {
    const deps = createRuntimeDependencies({
      runtimeId: "test-omitted-storage"
    });

    expect(deps.memoryStore).toBeInstanceOf(InMemoryMemoryStore);
    expect(deps.memoryStore).not.toBeInstanceOf(JsonFileMemoryStore);
  });

  it("persists entries appended by executeTask and allows a re-created store on the same path to read them", async () => {
    const tempDir = join(
      tmpdir(),
      `agentlily-e2e-persistence-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    tempDirectories.push(tempDir);
    const targetFile = join(tempDir, "history.json");

    const echoTool: ToolDefinition<{ message: string }, { echo: string }> = {
      name: "echoTool",
      description: "Echo tool for persistence test",
      execute: async ({ payload }) => ({ echo: payload.message })
    };

    const runtime1 = new AgentRuntime({
      runtimeId: "rt-writer",
      memoryStoragePath: targetFile,
      tools: [echoTool]
    });

    await runtime1.start();

    const executionResult = await runtime1.executeTask({
      taskId: "task-durable-101",
      agentId: "agent-writer",
      toolName: "echoTool",
      input: "input payload text",
      payload: { message: "persisted payload" }
    });

    expect(executionResult.output).toEqual({ echo: "persisted payload" });
    await runtime1.stop();

    // Verify the file was written to disk
    expect(existsSync(targetFile)).toBe(true);

    // Re-create a second store pointing to the exact same file path
    const secondStore = new JsonFileMemoryStore(targetFile);
    const agentHistory = await secondStore.listByAgent("agent-writer");

    expect(agentHistory).toHaveLength(1);
    expect(agentHistory[0]?.taskId).toBe("task-durable-101");
    expect(agentHistory[0]?.agentId).toBe("agent-writer");
    expect(agentHistory[0]?.input).toBe("input payload text");
    expect(agentHistory[0]?.output).toEqual({ echo: "persisted payload" });
    expect(agentHistory[0]?.recordedAt).toBeDefined();

    // Re-create a second runtime on the same path and check reading via its dependencies
    const runtime2 = new AgentRuntime({
      runtimeId: "rt-reader",
      memoryStoragePath: targetFile
    });
    const runtime2History = await runtime2
      .getDependencies()
      .memoryStore.listByAgent("agent-writer");
    expect(runtime2History).toHaveLength(1);
    expect(runtime2History[0]?.taskId).toBe("task-durable-101");
  });
});
