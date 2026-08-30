import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("configures and persists task execution with memoryStoragePath", async () => {
    const storagePath = join(
      tmpdir(),
      `agentlily-runtime-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      "persisted-memory.json"
    );

    try {
      const runtime = new AgentRuntime({
        runtimeId: "runtime-durable-test",
        memoryStoragePath: storagePath
      });

      runtime.registerTool({
        name: "save-action",
        description: "Action to save",
        execute({ payload }) {
          return { saved: payload };
        }
      });

      await runtime.start();

      await runtime.executeTask({
        taskId: "task-durable-1",
        agentId: "agent-durable",
        toolName: "save-action",
        input: "Run durable task",
        payload: { item: "important-state" }
      });

      const entries = await runtime
        .getDependencies()
        .memoryStore.listByAgent("agent-durable");

      expect(entries).toHaveLength(1);
      expect(entries[0]?.taskId).toBe("task-durable-1");
      expect(existsSync(storagePath)).toBe(true);
    } finally {
      const parentDir = join(storagePath, "..");
      if (existsSync(parentDir)) {
        await rm(parentDir, { recursive: true, force: true });
      }
    }
  });
});
