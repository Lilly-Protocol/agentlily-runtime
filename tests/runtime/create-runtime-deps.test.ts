import { describe, it, expect } from "vitest";
import { createRuntimeDependencies } from "../../src/runtime/bootstrap.js";
import { InMemoryMemoryStore } from "../../src/memory/memory-store.js";
import { UnconfiguredModelProvider } from "../../src/providers/model-provider.js";
import { ConsoleRuntimeLogger } from "../../src/logger/runtime-logger.js";
import { InMemoryRuntimeStateStore } from "../../src/state/runtime-state.js";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

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
    const deps = createRuntimeDependencies({ runtimeId: "custom-mem", memoryStore: customStore });
    expect(deps.memoryStore).toBe(customStore);
  });

  it("respects injected eventBus over default", () => {
    const customBus = new RuntimeEventBus();
    const deps = createRuntimeDependencies({ runtimeId: "custom-events", eventBus: customBus });
    expect(deps.eventBus).toBe(customBus);
  });
});
