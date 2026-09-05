import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AgentRuntime } from "../src/runtime/agent-runtime.js";
import { RuntimeError } from "../src/errors/runtime-errors.js";

describe("AgentRuntime task validation", () => {
  let runtime: AgentRuntime;

  beforeEach(async () => {
    runtime = new AgentRuntime({ runtimeId: "test-runtime" });
    await runtime.start();
  });

  afterEach(async () => {
    if (runtime.isRunning()) {
      await runtime.stop();
    }
  });

  it("should reject task with empty taskId before emitting received event", async () => {
    await expect(
      runtime.executeTask({
        taskId: "",
        agentId: "agent-1",
        toolName: "dummy",
        payload: {}
      })
    ).rejects.toThrow(RuntimeError);
  });

  it("should reject task with missing agentId", async () => {
    await expect(
      runtime.executeTask({
        taskId: "task-1",
        agentId: "",
        toolName: "dummy",
        payload: {}
      })
    ).rejects.toThrow(RuntimeError);
  });

  it("should reject task with missing toolName", async () => {
    await expect(
      runtime.executeTask({
        taskId: "task-1",
        agentId: "agent-1",
        toolName: "",
        payload: {}
      })
    ).rejects.toThrow(RuntimeError);
  });
});
