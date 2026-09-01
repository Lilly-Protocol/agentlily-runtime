 import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import type { RuntimeOptions } from "../../src/runtime/types.js";

describe("AgentRuntime.stop", () => {
  let runtime: AgentRuntime;
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const options: RuntimeOptions = {
      runtimeId: "test-runtime-stop",
      logger: { level: "error", info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    };
    runtime = new AgentRuntime(options);
    emitSpy = vi.fn();
    // Replace eventBus.emit with spy to capture events
    (runtime as any).dependencies.eventBus.emit = emitSpy;
  });

   it("emits runtime.stopped event when stop is called after start", async () => {
     await runtime.start();
     await runtime.stop();

     const stoppedEvent = emitSpy.mock.calls.find(
       (call) => call[0].name === "runtime.stopped"
     );
     expect(stoppedEvent).toBeDefined();
     expect(stoppedEvent[0].payload.runtimeId).toBe("test-runtime-stop");
     expect(stoppedEvent[0].payload.occurredAt).toBeDefined();
   });

   it("does not emit runtime.stopped if runtime was never started", async () => {
     await runtime.stop();

     const stoppedEvent = emitSpy.mock.calls.find(
       (call) => call[0].name === "runtime.stopped"
     );
     expect(stoppedEvent).toBeUndefined();
   });

   it("does not emit runtime.stopped twice on consecutive stop calls", async () => {
     await runtime.start();
     await runtime.stop();
     await runtime.stop();

     const stoppedEvents = emitSpy.mock.calls.filter(
       (call) => call[0].name === "runtime.stopped"
     );
     expect(stoppedEvents.length).toBe(1);
   });
 });
