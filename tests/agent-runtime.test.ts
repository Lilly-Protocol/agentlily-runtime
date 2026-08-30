import { describe, expect, it } from "vitest";
import {
  AgentRuntime,
  InMemoryRuntimeLogger,
  RuntimeEventBus
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

  it("enforces maxToolCallsPerTask runtime policy guard during task execution", async () => {
    const eventBus = new RuntimeEventBus();
    let failureReason = "";
    eventBus.on("runtime.task.failed", (event) => {
      failureReason = String((event.payload as { reason?: string }).reason);
    });

    const runtime = new AgentRuntime({
      runtimeId: "runtime-max-tool-guard",
      maxToolCallsPerTask: 1,
      eventBus
    });

    runtime.registerTool({
      name: "tool-a",
      description: "First tool",
      async execute({ context }) {
        // Attempt a nested second tool call during the same task
        const actionExecutor = runtime.getDependencies().actionExecutor;
        await actionExecutor.execute("tool-b", {}, context);
        return { ok: true };
      }
    });

    runtime.registerTool({
      name: "tool-b",
      description: "Second tool",
      execute() {
        return { ok: true };
      }
    });

    await runtime.start();

    await expect(
      runtime.executeTask({
        taskId: "task-limit-test",
        agentId: "agent-test",
        toolName: "tool-a",
        input: "Run nested tools",
        payload: {}
      })
    ).rejects.toMatchObject({
      code: "MAX_TOOL_CALLS_EXCEEDED",
      details: {
        currentToolCalls: 1,
        maxToolCalls: 1
      }
    });

    expect(failureReason).toContain(
      "Task exceeded maximum allowed tool calls limit of 1."
    );
  });
});
