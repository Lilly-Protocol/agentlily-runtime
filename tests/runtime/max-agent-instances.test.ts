import { describe, it, expect } from "vitest";
import {
  AgentInstanceManager,
  DEFAULT_MAX_AGENT_INSTANCES
} from "../../src/agents/agent-instance-manager.js";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import { createRuntimeDependencies } from "../../src/runtime/bootstrap.js";
import type { ToolDefinition } from "../../src/tools/types.js";

describe("RuntimeOptions.maxAgentInstances (Issue #236)", () => {
  it("preserves the AgentInstanceManager default of 5_000 when omitted", () => {
    const deps = createRuntimeDependencies({ runtimeId: "default-cap" });
    expect(deps.agentManager.getMaxInstances()).toBe(
      DEFAULT_MAX_AGENT_INSTANCES
    );
    expect(deps.agentManager.getMaxInstances()).toBe(5_000);
  });

  it("passes maxAgentInstances into AgentInstanceManager via AgentRuntime", () => {
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
    expect(manager.getEvictionCount()).toBe(0);

    manager.getOrCreate("agent-3");
    expect(manager.size()).toBe(2);
    expect(manager.has("agent-1")).toBe(false);
    expect(manager.has("agent-2")).toBe(true);
    expect(manager.has("agent-3")).toBe(true);
    expect(manager.getEvictionCount()).toBe(1);
    expect(manager.getMaxInstances()).toBe(2);
  });

  it("exposes eviction count when capacity is exceeded on the manager directly", () => {
    const manager = new AgentInstanceManager({ maxInstances: 1 });
    manager.getOrCreate("a");
    manager.getOrCreate("b");
    manager.getOrCreate("c");
    expect(manager.size()).toBe(1);
    expect(manager.has("c")).toBe(true);
    expect(manager.getEvictionCount()).toBe(2);
  });

  it("keeps in-flight executeTask contexts intact when later agents force eviction", async () => {
    const capturedAgentIds: string[] = [];
    const testTool: ToolDefinition<{ val: number }, { val: number }> = {
      name: "capture-agent-tool",
      description: "Captures agent id from the task context",
      inputSchema: { type: "object", properties: {} },
      execute: async ({ payload, context }) => {
        await new Promise((resolve) => setTimeout(resolve, 15));
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

    const [res1, res2, res3] = await Promise.all([
      runtime.executeTask({
        taskId: "task-1",
        agentId: "agent-1",
        toolName: "capture-agent-tool",
        input: JSON.stringify({ val: 1 }),
        payload: { val: 1 }
      }),
      runtime.executeTask({
        taskId: "task-2",
        agentId: "agent-2",
        toolName: "capture-agent-tool",
        input: JSON.stringify({ val: 2 }),
        payload: { val: 2 }
      }),
      runtime.executeTask({
        taskId: "task-3",
        agentId: "agent-3",
        toolName: "capture-agent-tool",
        input: JSON.stringify({ val: 3 }),
        payload: { val: 3 }
      })
    ]);

    expect(res1.output).toEqual({ val: 1 });
    expect(res2.output).toEqual({ val: 2 });
    expect(res3.output).toEqual({ val: 3 });
    expect(capturedAgentIds).toEqual(
      expect.arrayContaining(["agent-1", "agent-2", "agent-3"])
    );
    expect(capturedAgentIds).toHaveLength(3);

    const manager = runtime.getDependencies().agentManager;
    expect(manager.size()).toBe(2);
    expect(manager.has("agent-1")).toBe(false);
    expect(manager.has("agent-2")).toBe(true);
    expect(manager.has("agent-3")).toBe(true);
    expect(manager.getEvictionCount()).toBeGreaterThanOrEqual(1);

    await runtime.stop();
  });
});
