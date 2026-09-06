import { describe, it, expect, vi } from "vitest";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

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
