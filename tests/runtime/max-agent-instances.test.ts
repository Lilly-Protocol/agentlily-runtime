import { describe, it, expect } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import { createRuntimeDependencies } from "../../src/runtime/bootstrap.js";
import type { ToolDefinition } from "../../src/tools/types.js";

describe("RuntimeOptions.maxAgentInstances capacity limit (Issue #236)", () => {
  it("defaults to 5000 maxInstances when omitted in createRuntimeDependencies", () => {
    const deps = createRuntimeDependencies({ runtimeId: "test-default-cap" });
    for (let i = 0; i < 50; i++) {
      deps.agentManager.getOrCreate(`agent-${i}`);
    }
    expect(deps.agentManager.size()).toBe(50);
  });

  it("passes configured maxAgentInstances to AgentInstanceManager", () => {
    const runtime = new AgentRuntime({
      runtimeId: "rt-capped",
      maxAgentInstances: 2
    });

    const manager = runtime.getDependencies().agentManager;
    manager.getOrCreate("agent-1");
    manager.getOrCreate("agent-2");
    expect(manager.size()).toBe(2);
    expect(manager.has("agent-1")).toBe(true);
    expect(manager.has("agent-2")).toBe(true);

    // Adding 3rd agent evicts the oldest (agent-1)
    manager.getOrCreate("agent-3");
    expect(manager.size()).toBe(2);
    expect(manager.has("agent-1")).toBe(false);
    expect(manager.has("agent-2")).toBe(true);
    expect(manager.has("agent-3")).toBe(true);
  });

  it("ensures eviction does not break in-flight task contexts during executeTask", async () => {
    const capturedAgentIds: string[] = [];
    const testTool: ToolDefinition<{ val: number }, { val: number }> = {
      name: "capture-agent-tool",
      description: "Captures agent info from context",
      inputSchema: { type: "object", properties: {} },
      execute: async ({ payload, context }) => {
        // Small delay to simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));
        capturedAgentIds.push(context.agent.agentId);
        return payload;
      }
    };

    const runtime = new AgentRuntime({
      runtimeId: "rt-task-eviction",
      maxAgentInstances: 2,
      tools: [testTool]
    });

    await runtime.start();

    // Execute task for agent-1 (this starts the task with context.agent retaining agent-1)
    const task1Promise = runtime.executeTask({
      taskId: "task-1",
      agentId: "agent-1",
      toolName: "capture-agent-tool",
      input: JSON.stringify({ val: 1 }),
      payload: { val: 1 }
    });

    // Concurrently trigger tasks for agent-2 and agent-3 to force agent-1 eviction in the manager
    const task2Promise = runtime.executeTask({
      taskId: "task-2",
      agentId: "agent-2",
      toolName: "capture-agent-tool",
      input: JSON.stringify({ val: 2 }),
      payload: { val: 2 }
    });

    const task3Promise = runtime.executeTask({
      taskId: "task-3",
      agentId: "agent-3",
      toolName: "capture-agent-tool",
      input: JSON.stringify({ val: 3 }),
      payload: { val: 3 }
    });

    const [res1, res2, res3] = await Promise.all([
      task1Promise,
      task2Promise,
      task3Promise
    ]);

    expect(res1.output).toEqual({ val: 1 });
    expect(res2.output).toEqual({ val: 2 });
    expect(res3.output).toEqual({ val: 3 });

    // Assert that each task saw its own agentId despite manager eviction
    expect(capturedAgentIds).toContain("agent-1");
    expect(capturedAgentIds).toContain("agent-2");
    expect(capturedAgentIds).toContain("agent-3");

    // Manager should only retain the last 2 instances
    const manager = runtime.getDependencies().agentManager;
    expect(manager.size()).toBe(2);
    expect(manager.has("agent-1")).toBe(false);
    expect(manager.has("agent-2")).toBe(true);
    expect(manager.has("agent-3")).toBe(true);

    await runtime.stop();
  });
});
