import { describe, expect, it } from "vitest";
import { AgentRuntime } from "../../src/index.js";

import { RuntimeEventBus } from "../../src/events/runtime-events.js";

describe("AgentRuntime.executeTask task field validation (Issue #263)", () => {
  function makeRuntime() {
    const eventBus = new RuntimeEventBus();
    const events: string[] = [];
    eventBus.on("runtime.task.received", () => events.push("received"));
    eventBus.on("runtime.task.completed", () => events.push("completed"));
    eventBus.on("runtime.task.failed", () => events.push("failed"));

    const runtime = new AgentRuntime({
      runtimeId: "test-validation",
      eventBus
    });

    runtime.registerTool({
      name: "ok",
      description: "Always ok",
      execute() {
        return { ok: true };
      }
    });

    return { runtime, events };
  }

  it("rejects empty taskId before emitting any events", async () => {
    const { runtime, events } = makeRuntime();
    await runtime.start();

    await expect(
      runtime.executeTask({
        taskId: "",
        agentId: "a1",
        toolName: "ok",
        input: "go",
        payload: {}
      })
    ).rejects.toMatchObject({ code: "INVALID_TASK" });

    expect(events).toEqual([]);
  });

  it("rejects whitespace-only agentId before emitting any events", async () => {
    const { runtime, events } = makeRuntime();
    await runtime.start();

    await expect(
      runtime.executeTask({
        taskId: "t1",
        agentId: "   ",
        toolName: "ok",
        input: "go",
        payload: {}
      })
    ).rejects.toMatchObject({ code: "INVALID_TASK" });

    expect(events).toEqual([]);
  });

  it("rejects empty toolName before emitting any events", async () => {
    const { runtime, events } = makeRuntime();
    await runtime.start();

    await expect(
      runtime.executeTask({
        taskId: "t1",
        agentId: "a1",
        toolName: "",
        input: "go",
        payload: {}
      })
    ).rejects.toMatchObject({ code: "INVALID_TASK" });

    expect(events).toEqual([]);
  });

  it("rejects blank input before emitting any events", async () => {
    const { runtime, events } = makeRuntime();
    await runtime.start();

    await expect(
      runtime.executeTask({
        taskId: "t1",
        agentId: "a1",
        toolName: "ok",
        input: "  \n\t  ",
        payload: {}
      })
    ).rejects.toMatchObject({ code: "INVALID_TASK" });

    expect(events).toEqual([]);
  });

  it("still emits events for valid tasks", async () => {
    const { runtime, events } = makeRuntime();
    await runtime.start();

    await runtime.executeTask({
      taskId: "t-valid",
      agentId: "a1",
      toolName: "ok",
      input: "go",
      payload: {}
    });

    expect(events).toEqual(["received", "completed"]);
  });
});
