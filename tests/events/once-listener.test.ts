import { describe, it, expect, vi } from "vitest";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

describe("RuntimeEventBus.once()", () => {
  it("fires exactly once across repeated emits for the same event name", () => {
    const bus = new RuntimeEventBus();
    const spy = vi.fn();

    bus.once("runtime.started", spy);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-1", occurredAt: new Date().toISOString() }
    });

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-1", occurredAt: new Date().toISOString() }
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("returns listenerCount 0 immediately after once-listener fires", () => {
    const bus = new RuntimeEventBus();
    bus.once("runtime.started", () => {});

    expect(bus.listenerCount("runtime.started")).toBe(1);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-2", occurredAt: new Date().toISOString() }
    });

    expect(bus.listenerCount("runtime.started")).toBe(0);
  });

  it("prevents listener from firing if unsubscribed before emit", () => {
    const bus = new RuntimeEventBus();
    const spy = vi.fn();

    const unsubscribe = bus.once("runtime.started", spy);
    expect(bus.listenerCount("runtime.started")).toBe(1);

    unsubscribe();
    expect(bus.listenerCount("runtime.started")).toBe(0);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-3", occurredAt: new Date().toISOString() }
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it("removes once listener when bus.off() is called with original listener reference", () => {
    const bus = new RuntimeEventBus();
    const spy = vi.fn();

    bus.once("runtime.started", spy);
    expect(bus.listenerCount("runtime.started")).toBe(1);

    const removed = bus.off("runtime.started", spy);
    expect(removed).toBe(true);
    expect(bus.listenerCount("runtime.started")).toBe(0);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-4", occurredAt: new Date().toISOString() }
    });

    expect(spy).not.toHaveBeenCalled();
  });
});
