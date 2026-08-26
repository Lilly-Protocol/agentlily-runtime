import { describe, it, expect, vi } from "vitest";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

describe("RuntimeEventBus listener removal mid-emit", () => {
  it("allows unsubscribing another listener during emission without breaking iteration", () => {
    const bus = new RuntimeEventBus();
    const calls: string[] = [];
    let unsubB: (() => void) | null = null;

    // Listener A runs first and unsubscribes B
    bus.on("runtime.started", () => {
      calls.push("A");
      if (unsubB) unsubB();
    });

    // Listener B should be removed by A before it fires
    unsubB = bus.on("runtime.started", () => {
      calls.push("B");
    });

    // Listener C should still fire after B is removed
    bus.on("runtime.started", () => {
      calls.push("C");
    });

    bus.emit({ name: "runtime.started", payload: { runtimeId: "mid-emit", occurredAt: new Date().toISOString() } });

    // A fires, removes B, C still fires. B never fires.
    expect(calls).toContain("A");
    expect(calls).toContain("C");
    expect(calls).not.toContain("B");
  });

  it("does not invoke the unsubscribed listener on subsequent emissions", () => {
    const bus = new RuntimeEventBus();
    const calls: string[] = [];
    let unsub: (() => void) | null = null;

    bus.on("runtime.started", () => {
      calls.push("remover");
      if (unsub) unsub();
    });

    unsub = bus.on("runtime.started", () => {
      calls.push("removed");
    });

    bus.emit({ name: "runtime.started", payload: { runtimeId: "first", occurredAt: new Date().toISOString() } });
    bus.emit({ name: "runtime.started", payload: { runtimeId: "second", occurredAt: new Date().toISOString() } });

    // "removed" should never appear in any emission
    expect(calls.filter((c) => c === "removed")).toHaveLength(0);
    // "remover" fires on both emissions
    expect(calls.filter((c) => c === "remover")).toHaveLength(2);
  });

  it("remaining listeners continue to fire after mid-emit unsubscribe", () => {
    const bus = new RuntimeEventBus();
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    const spy3 = vi.fn();

    let unsub2: (() => void) | null = null;
    bus.on("runtime.started", spy1);
    unsub2 = bus.on("runtime.started", () => {
      spy2();
      if (unsub2) unsub2();
    });
    bus.on("runtime.started", spy3);

    bus.emit({ name: "runtime.started", payload: { runtimeId: "cont", occurredAt: new Date().toISOString() } });

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy3).toHaveBeenCalledTimes(1);
  });
});
