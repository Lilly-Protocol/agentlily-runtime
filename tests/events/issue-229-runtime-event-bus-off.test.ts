import { describe, it, expect, vi } from "vitest";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

describe("RuntimeEventBus public off() method (Issue #229)", () => {
  it("removes only the specified listener and decreases listenerCount by one", () => {
    const bus = new RuntimeEventBus();
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    bus.on("runtime.started", fn1);
    bus.on("runtime.started", fn2);
    expect(bus.listenerCount("runtime.started")).toBe(2);

    const removed = bus.off("runtime.started", fn1);
    expect(removed).toBe(true);
    expect(bus.listenerCount("runtime.started")).toBe(1);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-1", occurredAt: "2026-09-01T00:00:00Z" }
    });

    // fn1 must NOT be called; fn2 MUST be called
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it("allows calling the unsubscribe function returned by on() without throwing", () => {
    const bus = new RuntimeEventBus();
    const fn = vi.fn();

    const unsubscribe = bus.on("runtime.started", fn);
    expect(bus.listenerCount("runtime.started")).toBe(1);

    expect(() => unsubscribe()).not.toThrow();
    expect(bus.listenerCount("runtime.started")).toBe(0);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-1", occurredAt: "2026-09-01T00:00:00Z" }
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it("returns false when attempting to remove an unregistered listener or from an empty event", () => {
    const bus = new RuntimeEventBus();
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    // 1. Event has no listeners at all
    expect(bus.off("runtime.started", fn1)).toBe(false);

    // 2. Event has other listeners, but not fn2
    bus.on("runtime.started", fn1);
    expect(bus.off("runtime.started", fn2)).toBe(false);

    // 3. Second call with the same listener after removal returns false
    expect(bus.off("runtime.started", fn1)).toBe(true);
    expect(bus.off("runtime.started", fn1)).toBe(false);
  });

  it("maintains strict event isolation when unregistering listeners across different event names", () => {
    const bus = new RuntimeEventBus();
    const startHandler = vi.fn();
    const stopHandler = vi.fn();

    bus.on("runtime.started", startHandler);
    bus.on("runtime.stopped", stopHandler);

    bus.off("runtime.started", startHandler);

    expect(bus.listenerCount("runtime.started")).toBe(0);
    expect(bus.listenerCount("runtime.stopped")).toBe(1);

    bus.emit({
      name: "runtime.stopped",
      payload: { runtimeId: "rt-2", occurredAt: "2026-09-01T00:00:00Z" }
    });

    expect(stopHandler).toHaveBeenCalledTimes(1);
  });
});
