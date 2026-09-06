import { describe, expect, it, vi } from "vitest";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

describe("RuntimeEventBus", () => {
  it("delivers events to registered listeners for that event name", () => {
    const bus = new RuntimeEventBus();
    const startedListener = vi.fn();
    const failedListener = vi.fn();

    bus.on("runtime.started", startedListener);
    bus.on("runtime.task.failed", failedListener);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-1", occurredAt: "2026-09-01T00:00:00Z" }
    });

    expect(startedListener).toHaveBeenCalledTimes(1);
    expect(startedListener).toHaveBeenCalledWith({
      name: "runtime.started",
      payload: { runtimeId: "rt-1", occurredAt: "2026-09-01T00:00:00Z" }
    });
    expect(failedListener).not.toHaveBeenCalled();
  });

  it("stops delivery after unsubscribe function is called", () => {
    const bus = new RuntimeEventBus();
    const listener = vi.fn();

    const unsubscribe = bus.on("runtime.task.completed", listener);

    bus.emit({
      name: "runtime.task.completed",
      payload: {
        runtimeId: "rt-1",
        taskId: "t-1",
        agentId: "a-1",
        toolName: "calc"
      }
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    bus.emit({
      name: "runtime.task.completed",
      payload: {
        runtimeId: "rt-1",
        taskId: "t-2",
        agentId: "a-1",
        toolName: "calc"
      }
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("handles duplicate listeners and maintains event isolation across different event names", () => {
    const bus = new RuntimeEventBus();
    const l1 = vi.fn();
    const l2 = vi.fn();
    const otherListener = vi.fn();

    bus.on("runtime.task.received", l1);
    bus.on("runtime.task.received", l2);
    bus.on("runtime.task.failed", otherListener);

    bus.emit({
      name: "runtime.task.received",
      payload: { runtimeId: "rt-1", taskId: "t-1", agentId: "a-1" }
    });

    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
    expect(otherListener).not.toHaveBeenCalled();
  });
});

describe("RuntimeEventBus registration guards (merged from root suite)", () => {
  it("does not re-add the same listener when it is already registered", () => {
    const eventBus = new RuntimeEventBus({ maxListeners: 1 });
    const listener = vi.fn();

    eventBus.on("runtime.started", listener);
    expect(() => eventBus.on("runtime.started", listener)).not.toThrow();
    expect(eventBus.listenerCount("runtime.started")).toBe(1);
  });

  it("applies maxListeners independently per event name", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const eventBus = new RuntimeEventBus({ maxListeners: 1 });
    eventBus.on("runtime.started", vi.fn());

    // Second distinct listener for the same event warns but still registers.
    expect(() => eventBus.on("runtime.started", vi.fn())).not.toThrow();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(eventBus.listenerCount("runtime.started")).toBe(2);

    // A different event name has its own quota.
    expect(() => eventBus.on("runtime.task.failed", vi.fn())).not.toThrow();
    expect(eventBus.listenerCount("runtime.task.failed")).toBe(1);

    warnSpy.mockRestore();
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid maxListeners value %s",
    (maxListeners) => {
      expect(() => new RuntimeEventBus({ maxListeners })).toThrow(RangeError);
    }
  );
});
