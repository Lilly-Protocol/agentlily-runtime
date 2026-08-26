import { describe, expect, it } from "vitest";
import {
  AgentRuntime,
  InMemoryRuntimeLogger,
  RuntimeEventBus,
  InMemoryMemoryStore,
  InMemoryRuntimeStateStore
} from "../src/index.js";

describe("AgentRuntime", () => {
  it("executes a happy-path task and records memory", async () => {
    const logger = new InMemoryRuntimeLogger();
    const runtime = new AgentRuntime({
      runtimeId: "runtime-test",
      logger
    });

    runtime.registerTool({
      name: "echo",
      description: "Echoes a provided message.",
      execute({ payload, context }) {
        return {
          echoed: String((payload as { message: string }).message),
          agentId: context.agent.agentId
        };
      }
    });

    await runtime.start();

    const result = await runtime.executeTask<
      { message: string },
      { echoed: string; agentId: string }
    >({
      taskId: "task-1",
      agentId: "agent-1",
      toolName: "echo",
      input: "Echo this payload",
      payload: { message: "hello" }
    });

    const memory = await runtime
      .getDependencies()
      .memoryStore.listByAgent("agent-1");

    expect(result.output).toEqual({ echoed: "hello", agentId: "agent-1" });
    expect(memory).toHaveLength(1);
    expect(memory[0]?.taskId).toBe("task-1");
    expect(
      logger.entries.some((entry) => entry.message === "Runtime started.")
    ).toBe(true);
  });

  it("emits lifecycle events for startup and task completion", async () => {
    const eventBus = new RuntimeEventBus();
    const events: string[] = [];
    eventBus.on("runtime.started", (event) => {
      events.push(event.name);
    });
    eventBus.on("runtime.task.received", (event) => {
      events.push(event.name);
    });
    eventBus.on("runtime.task.completed", (event) => {
      events.push(event.name);
    });

    const runtime = new AgentRuntime({
      runtimeId: "runtime-events",
      eventBus
    });

    runtime.registerTool({
      name: "noop",
      description: "Returns a static result.",
      execute() {
        return { ok: true };
      }
    });

    await runtime.start();
    await runtime.executeTask({
      taskId: "task-2",
      agentId: "agent-2",
      toolName: "noop",
      input: "Run noop",
      payload: {}
    });

    expect(events).toEqual([
      "runtime.started",
      "runtime.task.received",
      "runtime.task.completed"
    ]);
  });

  it("rejects execution before startup", async () => {
    const runtime = new AgentRuntime({ runtimeId: "runtime-not-started" });

    await expect(
      runtime.executeTask({
        taskId: "task-3",
        agentId: "agent-3",
        toolName: "missing",
        input: "Should fail",
        payload: {}
      })
    ).rejects.toMatchObject({
      code: "RUNTIME_NOT_STARTED"
    });
  });

  it("surfaces tool lookup failures as typed runtime errors", async () => {
    const runtime = new AgentRuntime({ runtimeId: "runtime-missing-tool" });
    await runtime.start();

    await expect(
      runtime.executeTask({
        taskId: "task-4",
        agentId: "agent-4",
        toolName: "missing",
        input: "Invoke a missing tool",
        payload: {}
      })
    ).rejects.toMatchObject({
      code: "TOOL_NOT_FOUND"
    });
  });

  it("emits runtime.task.received before runtime.task.completed in happy path", async () => {
    const eventBus = new RuntimeEventBus();
    const events: string[] = [];
    eventBus.on("runtime.task.received", (e) => events.push(e.name));
    eventBus.on("runtime.task.completed", (e) => events.push(e.name));
    eventBus.on("runtime.task.failed", (e) => events.push(e.name));

    const runtime = new AgentRuntime({ runtimeId: "order-happy", eventBus });
    runtime.registerTool({ name: "ok", description: "succeeds", execute: () => ({ ok: true }) });
    await runtime.start();
    await runtime.executeTask({ taskId: "t1", agentId: "a1", toolName: "ok", input: "go", payload: {} });

    const receivedIdx = events.indexOf("runtime.task.received");
    const completedIdx = events.indexOf("runtime.task.completed");
    expect(receivedIdx).toBeGreaterThanOrEqual(0);
    expect(completedIdx).toBeGreaterThan(receivedIdx);
  });

  it("emits runtime.task.received before runtime.task.failed in failure path", async () => {
    const eventBus = new RuntimeEventBus();
    const events: string[] = [];
    eventBus.on("runtime.task.received", (e) => events.push(e.name));
    eventBus.on("runtime.task.completed", (e) => events.push(e.name));
    eventBus.on("runtime.task.failed", (e) => events.push(e.name));

    const runtime = new AgentRuntime({ runtimeId: "order-fail", eventBus });
    runtime.registerTool({ name: "boom", description: "throws", execute: () => { throw new Error("fail"); } });
    await runtime.start();
    await expect(runtime.executeTask({ taskId: "t2", agentId: "a2", toolName: "boom", input: "go", payload: {} })).rejects.toThrow();

    const receivedIdx = events.indexOf("runtime.task.received");
    const failedIdx = events.indexOf("runtime.task.failed");
    const completedIdx = events.indexOf("runtime.task.completed");
    expect(receivedIdx).toBeGreaterThanOrEqual(0);
    expect(failedIdx).toBeGreaterThan(receivedIdx);
    expect(completedIdx).toBe(-1);
  });

  it("uses all five injected dependencies during task execution (Issue #119)", async () => {
    const memoryStore = new InMemoryMemoryStore();
    const modelProvider = { name: "test-provider", generate: async () => ({ outputText: "generated" }) };
    const logger = new InMemoryRuntimeLogger();
    const stateStore = new InMemoryRuntimeStateStore();
    const eventBus = new RuntimeEventBus();

    const events: string[] = [];
    eventBus.on("runtime.started", (e) => events.push(e.name));
    eventBus.on("runtime.task.received", (e) => events.push(e.name));
    eventBus.on("runtime.task.completed", (e) => events.push(e.name));

    const runtime = new AgentRuntime({
      runtimeId: "injected-deps-test",
      memoryStore,
      modelProvider,
      logger,
      stateStore,
      eventBus,
    });

    let contextReceived: any = null;
    runtime.registerTool({
      name: "inspectContext",
      description: "Captures context to verify injected deps",
      execute: async ({ context }) => {
        contextReceived = context;
        await context.state.put("testKey", "testValue");
        return { ok: true };
      },
    });

    await runtime.start();
    await runtime.executeTask({
      taskId: "task-inject",
      agentId: "agent-inject",
      toolName: "inspectContext",
      input: "verify injection",
      payload: {},
    });

    // Verify memoryStore was used
    const memoryEntries = await memoryStore.listByAgent("agent-inject");
    expect(memoryEntries).toHaveLength(1);
    expect(memoryEntries[0].taskId).toBe("task-inject");

    // Verify logger was used
    expect(logger.entries.some((e) => e.message === "Runtime started.")).toBe(true);
    expect(logger.entries.some((e) => e.message === "Executing runtime task.")).toBe(true);

    // Verify eventBus was used
    expect(events).toContain("runtime.started");
    expect(events).toContain("runtime.task.received");
    expect(events).toContain("runtime.task.completed");

    // Verify stateStore was used
    const stateVal = await stateStore.get<string>("testKey");
    expect(stateVal).toBe("testValue");

    // Verify modelProvider was injected into context
    expect(contextReceived).not.toBeNull();
    expect(contextReceived.modelProvider.name).toBe("test-provider");
  });
});
