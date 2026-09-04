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

  it("fires once() listener exactly once and automatically deregisters", () => {
    const bus = new RuntimeEventBus();
    const listener = vi.fn();

    bus.once("runtime.started", listener);
    expect(bus.listenerCount("runtime.started")).toBe(1);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-once-1", occurredAt: "2026-09-01T00:00:00Z" }
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount("runtime.started")).toBe(0);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-once-2", occurredAt: "2026-09-01T00:00:01Z" }
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("allows off() to remove a listener registered via once() before it fires (Issue #251)", () => {
    const bus = new RuntimeEventBus();
    const listener = vi.fn();

    bus.once("runtime.task.failed", listener);
    expect(bus.listenerCount("runtime.task.failed")).toBe(1);

    const removed = bus.off("runtime.task.failed", listener);
    expect(removed).toBe(true);
    expect(bus.listenerCount("runtime.task.failed")).toBe(0);

    bus.emit({
      name: "runtime.task.failed",
      payload: {
        runtimeId: "rt-1",
        taskId: "t-1",
        agentId: "a-1",
        reason: "test failure"
      }
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it("handles unsubscribe returned by once() correctly", () => {
    const bus = new RuntimeEventBus();
    const listener = vi.fn();

    const unsubscribe = bus.once("runtime.stopped", listener);
    expect(bus.listenerCount("runtime.stopped")).toBe(1);

    unsubscribe();
    expect(bus.listenerCount("runtime.stopped")).toBe(0);

    bus.emit({
      name: "runtime.stopped",
      payload: { runtimeId: "rt-1", occurredAt: "2026-09-01T00:00:00Z" }
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
