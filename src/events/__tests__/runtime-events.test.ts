import { describe, it, expect, vi } from "vitest";
import { RuntimeEventBus } from "../runtime-events.js";

describe("RuntimeEventBus max listeners", () => {
  it("warns when exceeding maxListenersPerEvent", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bus = new RuntimeEventBus(2);

    bus.on("runtime.started", () => {});
    bus.on("runtime.started", () => {});
    bus.on("runtime.started", () => {});

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain(
      "max listener count (2) exceeded"
    );
    warnSpy.mockRestore();
  });

  it("exposes listenerCount", () => {
    const bus = new RuntimeEventBus();
    expect(bus.listenerCount("runtime.started")).toBe(0);

    const unsub = bus.on("runtime.started", () => {});
    expect(bus.listenerCount("runtime.started")).toBe(1);

    unsub();
    expect(bus.listenerCount("runtime.started")).toBe(0);
  });

  it("defaults to 100 max listeners", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bus = new RuntimeEventBus();

    for (let i = 0; i < 101; i++) {
      bus.on("runtime.started", () => {});
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("RuntimeEventBus once() async rejection", () => {
  it("catches rejections from async once listeners via onListenerError", async () => {
    const errorSpy = vi.fn();
    const bus = new RuntimeEventBus({ onListenerError: errorSpy });

    bus.once("runtime.started", async () => {
      throw new Error("async once failure");
    });

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "r1", occurredAt: "2026-01-01T00:00:00Z" }
    });

    // Wait for the promise to reject and be caught
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect((errorSpy.mock.calls[0]![0] as Error).message).toBe(
      "async once failure"
    );
  });

  it("removes once listener after async callback completes", async () => {
    const bus = new RuntimeEventBus();
    let callCount = 0;

    bus.once("runtime.started", async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "r1", occurredAt: "2026-01-01T00:00:00Z" }
    });
    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "r1", occurredAt: "2026-01-01T00:00:00Z" }
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(callCount).toBe(1);
  });
});
