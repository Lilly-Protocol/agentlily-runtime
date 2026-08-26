import { describe, it, expect, vi } from "vitest";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

describe("RuntimeEventBus subscribe/unsubscribe semantics", () => {
  it("delivers events to subscribed listener for matching name", () => {
    const bus = new RuntimeEventBus();
    const received: string[] = [];
    bus.on("runtime.started", (e) => received.push(e.payload.runtimeId));

    bus.emit({ name: "runtime.started", payload: { runtimeId: "r1", occurredAt: new Date().toISOString() } });

    expect(received).toEqual(["r1"]);
  });

  it("stops delivery after unsubscribe function is called", () => {
    const bus = new RuntimeEventBus();
    const received: string[] = [];
    const unsub = bus.on("runtime.started", (e) => received.push(e.payload.runtimeId));

    bus.emit({ name: "runtime.started", payload: { runtimeId: "before", occurredAt: new Date().toISOString() } });
    unsub();
    bus.emit({ name: "runtime.started", payload: { runtimeId: "after", occurredAt: new Date().toISOString() } });

    expect(received).toEqual(["before"]);
  });

  it("deduplicates identical listener references (Set semantics)", () => {
    const bus = new RuntimeEventBus();
    const calls: number[] = [];
    const listener = () => calls.push(1);

    bus.on("runtime.started", listener);
    bus.on("runtime.started", listener);

    bus.emit({ name: "runtime.started", payload: { runtimeId: "dup", occurredAt: new Date().toISOString() } });

    // Set-based storage deduplicates same reference
    expect(calls).toEqual([1]);
  });

  it("does not invoke listeners registered for different event names", () => {
    const bus = new RuntimeEventBus();
    const wrongListener = vi.fn();
    bus.on("runtime.task.completed", wrongListener);

    bus.emit({ name: "runtime.started", payload: { runtimeId: "iso", occurredAt: new Date().toISOString() } });

    expect(wrongListener).not.toHaveBeenCalled();
  });

  it("supports multiple listeners on same event with independent unsubscribe", () => {
    const bus = new RuntimeEventBus();
    const a: string[] = [];
    const b: string[] = [];
    const unsubA = bus.on("runtime.started", (e) => a.push(e.payload.runtimeId));
    bus.on("runtime.started", (e) => b.push(e.payload.runtimeId));

    bus.emit({ name: "runtime.started", payload: { runtimeId: "multi", occurredAt: new Date().toISOString() } });
    unsubA();
    bus.emit({ name: "runtime.started", payload: { runtimeId: "multi2", occurredAt: new Date().toISOString() } });

    expect(a).toEqual(["multi"]);
    expect(b).toEqual(["multi", "multi2"]);
  });
});
