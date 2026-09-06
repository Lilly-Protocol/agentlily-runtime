import { describe, it, expect } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import { RuntimeError } from "../../src/errors/runtime-errors.js";

describe("AgentRuntime double-start rejection", () => {
  it("throws RUNTIME_ALREADY_STARTED on second start call", async () => {
    const runtime = new AgentRuntime({ runtimeId: "double-start-test" });
    await runtime.start();

    try {
      await runtime.start();
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("RUNTIME_ALREADY_STARTED");
      expect(err.message).toContain("already been started");
    }
  });

  it("throws RUNTIME_ALREADY_STOPPED when restarted after stop", async () => {
    const runtime = new AgentRuntime({ runtimeId: "restart-after-stop-test" });
    await runtime.start();
    await runtime.stop();

    try {
      await runtime.start();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RuntimeError);
      const err = e as RuntimeError;
      expect(err.code).toBe("RUNTIME_ALREADY_STOPPED");
      expect(err.message).toContain(
        "already been stopped and cannot be restarted"
      );
    }
  });

  it("does not emit runtime.started event twice", async () => {
    const { RuntimeEventBus } =
      await import("../../src/events/runtime-events.js");
    const eventBus = new RuntimeEventBus();
    const startedEvents: string[] = [];
    eventBus.on("runtime.started", (e) =>
      startedEvents.push(e.payload.runtimeId)
    );

    const runtime = new AgentRuntime({
      runtimeId: "double-start-events",
      eventBus
    });
    await runtime.start();

    try {
      await runtime.start();
    } catch {
      // expected
    }

    expect(startedEvents).toHaveLength(1);
    expect(startedEvents[0]).toBe("double-start-events");
  });
});
