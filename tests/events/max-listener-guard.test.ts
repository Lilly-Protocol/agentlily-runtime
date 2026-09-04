import { describe, expect, it } from "vitest";
import {
  RuntimeEventBus,
  RuntimeEventListenerLimitError
} from "../../src/index.js";

describe("RuntimeEventBus max-listener guard", () => {
  it("listenerCount returns 0 for unknown events", () => {
    const bus = new RuntimeEventBus();
    expect(bus.listenerCount("runtime.started")).toBe(0);
  });

  it("listenerCount reflects registered listeners", () => {
    const bus = new RuntimeEventBus();
    bus.on("runtime.started", () => {});
    bus.on("runtime.started", () => {});
    expect(bus.listenerCount("runtime.started")).toBe(2);
  });

  it("listenerCount decreases after unsubscribe", () => {
    const bus = new RuntimeEventBus();
    const unsub = bus.on("runtime.started", () => {});
    expect(bus.listenerCount("runtime.started")).toBe(1);
    unsub();
    expect(bus.listenerCount("runtime.started")).toBe(0);
  });

  it("throws without exceeding the configured max listeners", () => {
    const bus = new RuntimeEventBus({ maxListeners: 3 });

    bus.on("runtime.started", () => {});
    bus.on("runtime.started", () => {});
    bus.on("runtime.started", () => {});

    expect(() => bus.on("runtime.started", () => {})).toThrow(
      RuntimeEventListenerLimitError
    );
    expect(() => bus.on("runtime.started", () => {})).toThrow(
      'Cannot add listener for "runtime.started": max listener count (3) exceeded.'
    );
    expect(bus.listenerCount("runtime.started")).toBe(3);
  });

  it("allows registrations up to the configured limit", () => {
    const bus = new RuntimeEventBus({ maxListeners: 5 });

    for (let i = 0; i < 5; i++) {
      bus.on("runtime.started", () => {});
    }

    expect(bus.listenerCount("runtime.started")).toBe(5);
  });

  it("enforces the default max of 100", () => {
    const bus = new RuntimeEventBus();

    for (let i = 0; i < 100; i++) {
      bus.on("runtime.started", () => {});
    }

    expect(() => bus.on("runtime.started", () => {})).toThrow(
      RuntimeEventListenerLimitError
    );
    expect(bus.listenerCount("runtime.started")).toBe(100);
  });
});
