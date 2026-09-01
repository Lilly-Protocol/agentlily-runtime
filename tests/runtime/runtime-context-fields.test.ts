import { describe, it, expect } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import type { ToolInvocation } from "../../src/tools/types.js";

describe("RuntimeContext fields populated per task", () => {
  it("provides taskId, agent.agentId, runtimeId and ISO now to tool context", async () => {
    let capturedContext: ToolInvocation["context"] | null = null;

    const runtime = new AgentRuntime({
      runtimeId: "test-runtime-ctx-154",
      modelProvider: { name: "stub", generate: async () => "" },
    });

    runtime.registerTool({
      name: "captureContext",
      description: "Captures invocation context for assertion",
      execute: async (invocation: ToolInvocation) => {
        capturedContext = invocation.context;
        return { ok: true };
      },
    });

    await runtime.start();

    await runtime.executeTask({
      agentId: "agent-alpha",
      taskId: "task-beta",
      toolName: "captureContext",
      input: "test-input-for-context",
      payload: {},
    });

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!.taskId).toBe("task-beta");
    expect(capturedContext!.agent.agentId).toBe("agent-alpha");
    expect(capturedContext!.runtimeId).toBe("test-runtime-ctx-154");
    expect(capturedContext!.now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
