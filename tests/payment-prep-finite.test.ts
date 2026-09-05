import { describe, it, expect } from "vitest";
import { createPaymentPrepTool } from "../src/actions/payment-prep-action.js";
import { RuntimeError } from "../src/errors/runtime-errors.js";

describe("PaymentPrepTool non-finite validation", () => {
  const tool = createPaymentPrepTool();

  it("should reject Infinity and -Infinity amount values", () => {
    expect(() =>
      tool.execute({
        payload: { walletId: "w1", amount: Infinity },
        context: { taskId: "t1", now: "2026-01-01" } as any
      })
    ).toThrow(RuntimeError);

    expect(() =>
      tool.execute({
        payload: { walletId: "w1", amount: -Infinity },
        context: { taskId: "t1", now: "2026-01-01" } as any
      })
    ).toThrow(RuntimeError);
  });

  it("should reject NaN amount values", () => {
    expect(() =>
      tool.execute({
        payload: { walletId: "w1", amount: "not-a-number" },
        context: { taskId: "t1", now: "2026-01-01" } as any
      })
    ).toThrow(RuntimeError);
  });
});
