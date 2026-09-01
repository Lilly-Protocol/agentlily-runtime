import { describe, it, expect, vi } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import type { RuntimeOptions } from "../../src/runtime/types.js";

describe("RuntimeContext fields per task (Issue #149)", () => {
  it("passes taskId, agent.agentId, runtimeId, and ISO now to tool context", async () => {
    let capturedContext: any = null;

    const recordingTool = {
      name: "recorder",
      description: "records invocation context",
      parameters: {},
      execute: async (_params: unknown, ctx: any) => {
        capturedContext = ctx;
        return { output: "ok" };
      },
    };

    const options: RuntimeOptions = {
      runtimeId: "ctx-test-runtime",
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      tools: [recordingTool as any],
      memory: { append: vi.fn(), listByAgent: vi.fn().mockResolvedValue([]) } as any,
      modelProvider: {
        name: "stub",
        generate: async () => ({ outputText: "use recorder", metadata: {} }),
      } as any,
      state: { get: vi.fn(), set: vi.fn() } as any,
    };

    const runtime = new AgentRuntime(options);
    await runtime.start();

    await runtime.executeTask({
      taskId: "task-149-abc",
      agentId: "agent-149",
      input: "run recorder",
      instructions: "call the recorder tool",
    });

    expect(capturedContext).toBeDefined();
    expect(capturedContext.taskId).toBe("task-149-abc");
    expect(capturedContext.agent?.agentId).toBe("agent-149");
    expect(capturedContext.runtimeId).toBe("ctx-test-runtime");
    expect(typeof capturedContext.now).toBe("string");
    expect(new Date(capturedContext.now).toISOString()).toBe(capturedContext.now);
  });
});
