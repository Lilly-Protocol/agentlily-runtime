import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AgentRuntime,
  createPaymentPrepTool,
  InMemoryRuntimeLogger,
  PAYMENT_PREP_TOOL_NAME,
  RuntimeEventBus
} from "../src/index.js";
import type { PaymentPrepPayload, PaymentPrepResult } from "../src/index.js";

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
    expect(events.indexOf("runtime.task.received")).toBeLessThan(
      events.indexOf("runtime.task.completed")
    );
  });

  it("emits task received before task failed", async () => {
    const eventBus = new RuntimeEventBus();
    const events: string[] = [];
    eventBus.on("runtime.task.received", (event) => {
      events.push(event.name);
    });
    eventBus.on("runtime.task.failed", (event) => {
      events.push(event.name);
    });

    const runtime = new AgentRuntime({
      runtimeId: "runtime-failed-events",
      eventBus
    });

    runtime.registerTool({
      name: "fail",
      description: "Throws an error.",
      execute() {
        throw new Error("Tool execution failed.");
      }
    });

    await runtime.start();
    await expect(
      runtime.executeTask({
        taskId: "task-failed-events",
        agentId: "agent-failed-events",
        toolName: "fail",
        input: "Fail this task",
        payload: {}
      })
    ).rejects.toThrow("Tool execution failed.");

    expect(events).toEqual(["runtime.task.received", "runtime.task.failed"]);
    expect(events.indexOf("runtime.task.received")).toBeLessThan(
      events.indexOf("runtime.task.failed")
    );
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


  it("stops the runtime, emits runtime.stopped event, and rejects subsequent tasks", async () => {
    const eventBus = new RuntimeEventBus();
    const stoppedEvents: { runtimeId: string; occurredAt: string }[] = [];
    eventBus.on("runtime.stopped", (event) => {
      stoppedEvents.push(event.payload);
    });

    const runtime = new AgentRuntime({
      runtimeId: "runtime-stop-test",
      eventBus
    });

    await runtime.start();
    await runtime.stop();

    expect(stoppedEvents).toHaveLength(1);
    expect(stoppedEvents[0]?.runtimeId).toBe("runtime-stop-test");
    expect(stoppedEvents[0]?.occurredAt).toBeDefined();

    // Subsequent task execution rejects
    await expect(
      runtime.executeTask({
        taskId: "task-post-stop",
        agentId: "agent-stop",
        toolName: "echo",
        input: "Run after stop",
        payload: {}
      })
    ).rejects.toMatchObject({
      code: "RUNTIME_NOT_STARTED"
    });

    // Calling stop again is idempotent
    await runtime.stop();
    expect(stoppedEvents).toHaveLength(1);
  });
});

