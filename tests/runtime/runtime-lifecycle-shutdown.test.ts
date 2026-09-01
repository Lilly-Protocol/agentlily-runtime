import { describe, expect, it } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

describe("AgentRuntime Shutdown Lifecycle & Duration Tracking", () => {
  it("emits runtime.stopped upon graceful stop()", async () => {
    const eventBus = new RuntimeEventBus();
    const emitted: string[] = [];

    eventBus.on("runtime.started", (e) => emitted.push(e.name));
    eventBus.on("runtime.stopped", (e) => emitted.push(e.name));

    const runtime = new AgentRuntime({
      runtimeId: "rt-shutdown",
      eventBus
    });

    await runtime.start();
    await runtime.stop();

    expect(emitted).toEqual(["runtime.started", "runtime.stopped"]);
  });

  it("rejects executeTask with RUNTIME_NOT_STARTED after shutdown", async () => {
    const runtime = new AgentRuntime({ runtimeId: "rt-test" });
    runtime.registerTool({
      name: "ping",
      description: "Ping tool",
      execute: () => ({ ok: true })
    });

    await runtime.start();
    await runtime.stop();

    await expect(
      runtime.executeTask({
        taskId: "task-after-stop",
        agentId: "agent-1",
        toolName: "ping",
        input: "ping",
        payload: {}
      })
    ).rejects.toMatchObject({
      code: "RUNTIME_NOT_STARTED"
    });
  });

  it("populates startedAt, completedAt, and durationMs on TaskExecutionResult", async () => {
    const runtime = new AgentRuntime({ runtimeId: "rt-metrics" });
    runtime.registerTool({
      name: "delay",
      description: "Delayed work",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 20));
        return { done: true };
      }
    });

    await runtime.start();
    const result = await runtime.executeTask({
      taskId: "task-perf",
      agentId: "agent-1",
      toolName: "delay",
      input: "measure timing",
      payload: {}
    });

    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(15);
  });
});
