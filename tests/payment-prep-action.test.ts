import { describe, expect, it } from "vitest";
import {
  AgentInstanceManager,
  createPaymentPrepTool,
  InMemoryMemoryStore,
  InMemoryRuntimeStateStore,
  PAYMENT_PREP_TOOL_NAME,
  RuntimeError,
  UnconfiguredModelProvider
} from "../src/index.js";
import type { PaymentPrepPayload, RuntimeContext } from "../src/index.js";

describe("PaymentPrepAction", () => {
  const createMockContext = (taskId: string): RuntimeContext => ({
    runtimeId: "runtime-test",
    taskId,
    agent: new AgentInstanceManager().getOrCreate("test-agent"),
    memory: new InMemoryMemoryStore(),
    modelProvider: new UnconfiguredModelProvider(),
    state: new InMemoryRuntimeStateStore(),
    now: "2026-08-30T12:00:00.000Z"
  });

  it("creates a tool with correct name and description metadata", () => {
    const tool = createPaymentPrepTool();
    expect(tool.name).toBe(PAYMENT_PREP_TOOL_NAME);
    expect(tool.description).toContain(
      "without performing live Stellar network calls"
    );
  });

  it("prepares valid payment context and transaction stub", async () => {
    const tool = createPaymentPrepTool();
    const context = createMockContext("task-pay-1");

    const payload: PaymentPrepPayload = {
      walletId: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      amount: "150.50",
      recipientId: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      assetCode: "USDC",
      memo: "Invoice #1024",
      metadata: { priority: "high" }
    };

    const result = await tool.execute({ payload, context });

    expect(result).toEqual({
      status: "prepared",
      walletId: payload.walletId,
      amount: "150.50",
      recipientId: payload.recipientId,
      assetCode: "USDC",
      memo: "Invoice #1024",
      preparedAt: "2026-08-30T12:00:00.000Z",
      transactionStubId: `stellar-stub-task-pay-1-${payload.walletId}`,
      isSimulated: true,
      metadata: { priority: "high" }
    });
  });

  it("handles numeric amount and defaults assetCode to XLM", async () => {
    const tool = createPaymentPrepTool();
    const context = createMockContext("task-pay-2");

    const result = await tool.execute({
      payload: {
        walletId: "GWALLET123",
        amount: 25
      },
      context
    });

    expect(result.amount).toBe("25");
    expect(result.assetCode).toBe("XLM");
    expect(result.status).toBe("prepared");
    expect(result.isSimulated).toBe(true);
  });

  it("rejects empty walletId", async () => {
    const tool = createPaymentPrepTool();
    const context = createMockContext("task-pay-3");

    expect(() =>
      tool.execute({
        payload: {
          walletId: "",
          amount: "10"
        },
        context
      })
    ).toThrowError(RuntimeError);
  });

  it("rejects missing or empty amount", async () => {
    const tool = createPaymentPrepTool();
    const context = createMockContext("task-pay-4");

    expect(() =>
      tool.execute({
        payload: {
          walletId: "GWALLET123",
          amount: ""
        },
        context
      })
    ).toThrowError(RuntimeError);
  });

  it("rejects negative or invalid numeric amount", async () => {
    const tool = createPaymentPrepTool();
    const context = createMockContext("task-pay-5");

    expect(() =>
      tool.execute({
        payload: {
          walletId: "GWALLET123",
          amount: -50
        },
        context
      })
    ).toThrowError(RuntimeError);

    expect(() =>
      tool.execute({
        payload: {
          walletId: "GWALLET123",
          amount: "invalid-amount"
        },
        context
      })
    ).toThrowError(RuntimeError);
  });

  it("rejects non-finite amount values such as Infinity, NaN, and 1e309 with INVALID_TASK (issue #239)", async () => {
    const tool = createPaymentPrepTool();
    const context = createMockContext("task-pay-6");

    const nonFiniteValues = [
      "Infinity",
      "-Infinity",
      "NaN",
      "1e309",
      Infinity,
      -Infinity,
      NaN
    ];

    for (const amount of nonFiniteValues) {
      try {
        await tool.execute({
          payload: {
            walletId: "GWALLET123",
            amount: amount as any
          },
          context
        });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(RuntimeError);
        expect((err as RuntimeError).code).toBe("INVALID_TASK");
      }
    }
  });
});
