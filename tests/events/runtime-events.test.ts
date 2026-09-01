import { describe, expect, it, vi } from "vitest";
import { RuntimeEventBus } from "../../src/events/runtime-events";

describe("RuntimeEventBus", () => {
  it("delivers events to registered listeners for that event name", () => {
    const bus = new RuntimeEventBus();
    const startedListener = vi.fn();
    const failedListener = vi.fn();

    bus.on("runtime.started", startedListener);
    bus.on("runtime.task.failed", failedListener);

    bus.emit({
      name: "runtime.started",
      payload: { runtimeId: "rt-1", occurredAt: "2026-09-01T00:00:00Z" },
    });

    expect(startedListener).toHaveBeenCalledTimes(1);
    expect(startedListener).toHaveBeenCalledWith({
      name: "runtime.started",
      payload: { runtimeId: "rt-1", occurredAt: "2026-09-01T00:00:00Z" },
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
        toolName: "calc",
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    bus.emit({
      name: "runtime.task.completed",
      payload: {
        runtimeId: "rt-1",
        taskId: "t-2",
        agentId: "a-1",
        toolName: "calc",
      },
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
      payload: { runtimeId: "rt-1", taskId: "t-1", agentId: "a-1" },
    });

    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
    expect(otherListener).not.toHaveBeenCalled();
  });
});
