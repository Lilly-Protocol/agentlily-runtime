import { describe, expect, it } from "vitest";
import { AgentRuntime, RuntimeEventBus } from "../../src/index.js";

describe("runtime.task.completed duration", () => {
  it("matches the completed event duration to the task result", async () => {
    const eventBus = new RuntimeEventBus();
    let eventDurationMs: number | undefined;

    eventBus.on("runtime.task.completed", (event) => {
      eventDurationMs = event.payload.durationMs;
    });

    const runtime = new AgentRuntime({
      runtimeId: "runtime-completion-duration",
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
    const result = await runtime.executeTask({
      taskId: "task-completion-duration",
      agentId: "agent-completion-duration",
      toolName: "noop",
      input: "Run noop",
      payload: {}
    });

    expect(eventDurationMs).toBe(result.durationMs);
    expect(Number.isInteger(eventDurationMs)).toBe(true);
    expect(eventDurationMs).toBeGreaterThanOrEqual(0);
  });
});
