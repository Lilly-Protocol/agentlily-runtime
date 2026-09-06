import { RuntimeError } from "../errors/runtime-errors.js";
import { assertNonEmptyValue } from "../guards/runtime-guards.js";
import type { ToolDefinition, ToolInvocation } from "../tools/types.js";

export interface PaymentPrepPayload {
  walletId: string;
  amount: string | number;
  recipientId?: string | undefined;
  assetCode?: string | undefined;
  memo?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface PaymentPrepResult {
  status: "prepared";
  walletId: string;
  amount: string;
  recipientId?: string | undefined;
  assetCode: string;
  memo?: string | undefined;
  preparedAt: string;
  transactionStubId: string;
  isSimulated: true;
  metadata?: Record<string, unknown> | undefined;
}

export const PAYMENT_PREP_TOOL_NAME = "wallet.prepare_payment";

export function createPaymentPrepTool(): ToolDefinition<
  PaymentPrepPayload,
  PaymentPrepResult
> {
  return {
    name: PAYMENT_PREP_TOOL_NAME,
    description:
      "Prepares and validates payment context and transaction stub for AgentLily wallet tasks without performing live Stellar network calls.",
    execute({
      payload,
      context
    }: ToolInvocation<PaymentPrepPayload>): PaymentPrepResult {
      assertNonEmptyValue(payload.walletId, "walletId");

      if (
        payload.amount === undefined ||
        payload.amount === null ||
        String(payload.amount).trim().length === 0
      ) {
        throw new RuntimeError("INVALID_TASK", "amount must be specified.", {
          fieldName: "amount"
        });
      }

      const amountStr = String(payload.amount);
      const parsedAmount = Number(amountStr);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new RuntimeError(
          "INVALID_TASK",
          "amount must be a positive finite number.",
          { amount: payload.amount }
        );
      }

      const preparedAt = context.now || new Date().toISOString();
      const transactionStubId = `stellar-stub-${context.taskId}-${payload.walletId}`;

      return {
        status: "prepared",
        walletId: payload.walletId,
        amount: amountStr,
        recipientId: payload.recipientId,
        assetCode: payload.assetCode ?? "XLM",
        memo: payload.memo,
        preparedAt,
        transactionStubId,
        isSimulated: true,
        metadata: payload.metadata
      };
    }
  };
}
