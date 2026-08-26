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
});

  it("handles parallel executeTask calls with correct per-task results and memory entries (Issue #123)", async () => {
    const runtime = new AgentRuntime({ runtimeId: "concurrency-test" });
    runtime.registerTool({
      name: "double",
      description: "Doubles the input number",
      execute: ({ payload }) => ({ result: (payload as any).n * 2 }),
    });
    await runtime.start();

    const taskCount = 20;
    const promises = Array.from({ length: taskCount }, (_, i) =>
      runtime.executeTask({
        taskId: `task-${i}`,
        agentId: "agent-concurrent",
        toolName: "double",
        input: `compute ${i}`,
        payload: { n: i },
      })
    );

    const results = await Promise.all(promises);

    // Verify each result is correct
    for (let i = 0; i < taskCount; i++) {
      expect(results[i].output).toEqual({ result: i * 2 });
      expect(results[i].taskId).toBe(`task-${i}`);
    }

    // Verify all memory entries recorded
    const memory = await runtime.getDependencies().memoryStore.listByAgent("agent-concurrent");
    expect(memory).toHaveLength(taskCount);

    const taskIds = new Set(memory.map((m) => m.taskId));
    for (let i = 0; i < taskCount; i++) {
      expect(taskIds.has(`task-${i}`)).toBe(true);
    }
  });
