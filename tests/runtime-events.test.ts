import { describe, expect, it, vi } from "vitest";
import { RuntimeEventBus } from "../src/index.js";

describe("RuntimeEventBus", () => {
  it("isolates listener failures and emits an internal error event", () => {
    const eventBus = new RuntimeEventBus();
    const unaffectedListener = vi.fn();
    const internalErrors: Array<{
      eventName: string;
      message: string;
    }> = [];

    eventBus.on("runtime.started", () => {
      throw new Error("listener failed");
    });
    eventBus.on("runtime.started", unaffectedListener);
    eventBus.on("runtime.internal.error", (event) => {
      internalErrors.push(event.payload);
    });

    expect(() =>
      eventBus.emit({
        name: "runtime.started",
        payload: { runtimeId: "runtime-test", occurredAt: "2025-01-01" }
      })
    ).not.toThrow();

    expect(unaffectedListener).toHaveBeenCalledOnce();
    expect(internalErrors).toEqual([
      { eventName: "runtime.started", message: "listener failed" }
    ]);
  });
});
