import { describe, it, expect, vi } from "vitest";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

describe("RuntimeEventBus runtime.internal.error", () => {
  it("emits runtime.internal.error when a listener throws", () => {
    const bus = new RuntimeEventBus();
    const errorSpy = vi.fn();

    bus.on("runtime.started", () => {
      throw new Error("listener boom");
    });
    bus.on("runtime.internal.error", errorSpy);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "r1", occurredAt: "2026-08-25T00:00:00Z" }
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]![0]!.payload.eventName).toBe(
      "runtime.started"
    );
    expect(errorSpy.mock.calls[0]![0]!.payload.errorMessage).toBe(
      "listener boom"
    );
  });

  it("does not propagate errors from error listeners", () => {
    const bus = new RuntimeEventBus();

    bus.on("runtime.started", () => {
      throw new Error("original");
    });
    bus.on("runtime.internal.error", () => {
      throw new Error("error-handler boom");
    });

    expect(() => {
      bus.emit({
        name: "runtime.started",
        payload: { runtimeId: "r1", occurredAt: "2026-08-25T00:00:00Z" }
      });
    }).not.toThrow();
  });

  it("stringifies non-Error throws in errorMessage", () => {
    const bus = new RuntimeEventBus();
    const errorSpy = vi.fn();

    bus.on("runtime.started", () => {
      throw "string error";
    });
    bus.on("runtime.internal.error", errorSpy);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "r1", occurredAt: "2026-08-25T00:00:00Z" }
    });

    expect(errorSpy.mock.calls[0]![0]!.payload.errorMessage).toBe(
      "string error"
    );
  });
});
