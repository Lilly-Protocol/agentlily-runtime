import { describe, it, expect } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import { RuntimeError } from "../../src/errors/runtime-errors.js";

describe("AgentRuntime stop-then-restart rejection", () => {
  it("throws RUNTIME_ALREADY_STOPPED when starting after stop", async () => {
    const runtime = new AgentRuntime({ runtimeId: "restart-after-stop-test" });
    await runtime.start();
    await runtime.stop();

    try {
      await runtime.start();
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("RUNTIME_ALREADY_STOPPED");
      expect(err.message).toContain("cannot be restarted");
    }
  });

  it("RUNTIME_ALREADY_STARTED still works on double start", async () => {
    const runtime = new AgentRuntime({ runtimeId: "double-start-verification" });
    await runtime.start();

    try {
      await runtime.start();
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RuntimeError;
      expect(err.code).toBe("RUNTIME_ALREADY_STARTED");
    }
  });
});
