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

  it("registers and executes payment prep action through runtime", async () => {
    const runtime = new AgentRuntime({ runtimeId: "runtime-payment-test" });
    runtime.registerTool(createPaymentPrepTool());
    await runtime.start();

    const result = await runtime.executeTask<
      PaymentPrepPayload,
      PaymentPrepResult
    >({
      taskId: "task-pay-exec",
      agentId: "agent-pay",
      toolName: PAYMENT_PREP_TOOL_NAME,
      input: "Prepare payment transaction",
      payload: {
        walletId: "GWALLET999",
        amount: "50.00",
        recipientId: "GRECEIVER111"
      }
    });

    expect(result.output.status).toBe("prepared");
    expect(result.output.amount).toBe("50.00");
    expect(result.output.walletId).toBe("GWALLET999");
    expect(result.output.recipientId).toBe("GRECEIVER111");
    expect(result.output.assetCode).toBe("XLM");

    const memory = await runtime
      .getDependencies()
      .memoryStore.listByAgent("agent-pay");
    expect(memory).toHaveLength(1);
    expect(memory[0]?.taskId).toBe("task-pay-exec");
  });
});
