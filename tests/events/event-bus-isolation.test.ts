import { describe, expect, it, vi } from "vitest";
import { RuntimeEventBus, type RuntimeEvent } from "../../src/events/runtime-events.js";

describe("RuntimeEventBus Listener Isolation & Error Emission", () => {
  it("isolates throwing listeners so other listeners continue executing", () => {
    const bus = new RuntimeEventBus();
    const l1 = vi.fn();
    const throwingListener = vi.fn(() => {
      throw new Error("listener crashed");
    });
    const l2 = vi.fn();

    bus.on("runtime.started", l1);
    bus.on("runtime.started", throwingListener);
    bus.on("runtime.started", l2);

    expect(() => {
      bus.emit({
        name: "runtime.started",
        payload: { runtimeId: "rt-1", occurredAt: new Date().toISOString() }
      });
    }).not.toThrow();

    expect(l1).toHaveBeenCalledOnce();
    expect(throwingListener).toHaveBeenCalledOnce();
    expect(l2).toHaveBeenCalledOnce();
  });

  it("emits runtime.internal.error on listener exception", () => {
    const bus = new RuntimeEventBus();
    const internalErrors: Array<RuntimeEvent<"runtime.internal.error">> = [];

    bus.on("runtime.internal.error", (e) => internalErrors.push(e));
    bus.on("runtime.task.received", () => {
      throw new Error("unhandled subscription fault");
    });

    bus.emit({
      name: "runtime.task.received",
      payload: { runtimeId: "rt-1", taskId: "t-10", agentId: "agent-1" }
    });

    expect(internalErrors).toHaveLength(1);
    expect(internalErrors[0]?.payload.eventName).toBe("runtime.task.received");
    expect(internalErrors[0]?.payload.error).toBe("unhandled subscription fault");
  });

  it("tracks listener counts accurately and unregisters cleanly", () => {
    const bus = new RuntimeEventBus();
    const unsub = bus.on("runtime.task.completed", () => {});
    expect(bus.listenerCount("runtime.task.completed")).toBe(1);
    unsub();
    expect(bus.listenerCount("runtime.task.completed")).toBe(0);
  });
});
