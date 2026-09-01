import { describe, expect, it } from "vitest";
import { AgentRuntime, RuntimeEventBus } from "../src/index.js";

describe("Event emission order (Issue #128)", () => {
  it("emits runtime.task.received before runtime.task.completed on success", async () => {
    const eventBus = new RuntimeEventBus();
    const events: string[] = [];

    eventBus.on("runtime.task.received", (e) => events.push(e.name));
    eventBus.on("runtime.task.completed", (e) => events.push(e.name));
    eventBus.on("runtime.task.failed", (e) => events.push(e.name));

    const runtime = new AgentRuntime({
      runtimeId: "order-success",
      eventBus,
    });

    runtime.registerTool({
      name: "ok",
      description: "Always succeeds",
      execute() {
        return { ok: true };
      },
    });

    await runtime.start();
    await runtime.executeTask({
      taskId: "t-ok",
      agentId: "a1",
      toolName: "ok",
      input: "go",
      payload: {},
    });

    const receivedIdx = events.indexOf("runtime.task.received");
    const completedIdx = events.indexOf("runtime.task.completed");
    const failedIdx = events.indexOf("runtime.task.failed");

    expect(receivedIdx).toBeGreaterThanOrEqual(0);
    expect(completedIdx).toBeGreaterThan(receivedIdx);
    expect(failedIdx).toBe(-1);
  });

  it("emits runtime.task.received before runtime.task.failed on error", async () => {
    const eventBus = new RuntimeEventBus();
    const events: string[] = [];

    eventBus.on("runtime.task.received", (e) => events.push(e.name));
    eventBus.on("runtime.task.completed", (e) => events.push(e.name));
    eventBus.on("runtime.task.failed", (e) => events.push(e.name));

    const runtime = new AgentRuntime({
      runtimeId: "order-fail",
      eventBus,
    });

    runtime.registerTool({
      name: "boom",
      description: "Always throws",
      execute() {
        throw new Error("intentional failure for ordering test");
      },
    });

    await runtime.start();

    try {
      await runtime.executeTask({
        taskId: "t-fail",
        agentId: "a2",
        toolName: "boom",
        input: "fail",
        payload: {},
      });
    } catch {
      // expected
    }

    const receivedIdx = events.indexOf("runtime.task.received");
    const failedIdx = events.indexOf("runtime.task.failed");
    const completedIdx = events.indexOf("runtime.task.completed");

    expect(receivedIdx).toBeGreaterThanOrEqual(0);
    expect(failedIdx).toBeGreaterThan(receivedIdx);
    expect(completedIdx).toBe(-1);
  });
});
