import { describe, it, expect, vi } from "vitest";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

describe("RuntimeEventBus.once async rejection handling", () => {
  it("should forward rejected async once-listener promises to onListenerError", async () => {
    let capturedError: unknown = null;
    const bus = new RuntimeEventBus({
      onListenerError: (err) => {
        capturedError = err;
      }
    });

    const rejectionError = new Error("Async once-listener failure");

    bus.once("runtime.started", async () => {
      throw rejectionError;
    });

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "r-1", occurredAt: new Date().toISOString() }
    });

    // Allow promise microtasks to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(capturedError).toBe(rejectionError);
  });
});
