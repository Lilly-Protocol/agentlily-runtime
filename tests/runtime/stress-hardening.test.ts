import { describe, expect, it } from "vitest";
import {
  AgentInstanceManager,
  AgentRuntime,
  InMemoryMemoryStore,
  InMemoryRuntimeLogger,
  InMemoryRuntimeStateStore,
  RuntimeEventBus
} from "../../src/index.js";

describe("AgentLily Runtime Stress & Hardening Test Suite", () => {
  describe("RuntimeEventBus High-Volume & Error Isolation Stress", () => {
    it("handles 20,000 event dispatches across multiple concurrent subscribers without leaking listeners", () => {
      const bus = new RuntimeEventBus();
      let subscriber1Count = 0;
      let subscriber2Count = 0;
      let subscriber3Count = 0;

      const unsub1 = bus.on("runtime.task.received", () => {
        subscriber1Count++;
      });
      const unsub2 = bus.on("runtime.task.received", () => {
        subscriber2Count++;
      });
      const unsub3 = bus.on("runtime.task.received", () => {
        subscriber3Count++;
      });

      expect(bus.listenerCount("runtime.task.received")).toBe(3);

      const iterations = 20_000;
      for (let i = 0; i < iterations; i++) {
        bus.emit({
          name: "runtime.task.received",
          payload: {
            runtimeId: "rt-stress",
            taskId: `task-${i}`,
            agentId: `agent-${i % 10}`
          }
        });
      }

      expect(subscriber1Count).toBe(iterations);
      expect(subscriber2Count).toBe(iterations);
      expect(subscriber3Count).toBe(iterations);

      // Unsubscribe all and verify clean map teardown
      unsub1();
      unsub2();
      unsub3();

      expect(bus.listenerCount("runtime.task.received")).toBe(0);
      expect(bus.listenerCount()).toBe(0);
    });

    it("isolates synchronous and asynchronous listener exceptions without breaking dispatch or leaking unhandled rejections", async () => {
      const errorsCaught: unknown[] = [];
      const bus = new RuntimeEventBus((err) => {
        errorsCaught.push(err);
      });

      let normalSubscriberReceived = 0;

      // Faulty listener 1: Throws synchronously
      bus.on("runtime.task.completed", () => {
        throw new Error("Faulty sync listener exploded");
      });

      // Normal listener
      bus.on("runtime.task.completed", () => {
        normalSubscriberReceived++;
      });

      // Faulty listener 2: Rejects asynchronously
      bus.on("runtime.task.completed", async () => {
        throw new Error("Faulty async listener rejected");
      });

      bus.emit({
        name: "runtime.task.completed",
        payload: {
          runtimeId: "rt-isolate",
          taskId: "t-1",
          agentId: "a-1",
          toolName: "calc"
        }
      });

      // Wait a tick for async rejection catch handler
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(normalSubscriberReceived).toBe(1);
      expect(errorsCaught.length).toBe(2);
    });

    it("supports once listeners and unsubscribing during active dispatch", () => {
      const bus = new RuntimeEventBus();
      let onceFired = 0;
      let dynamicFired = 0;

      bus.once("runtime.started", () => {
        onceFired++;
      });

      let unsubDynamic: (() => void) | null = null;
      unsubDynamic = bus.on("runtime.started", () => {
        dynamicFired++;
        if (unsubDynamic) {
          unsubDynamic();
        }
      });

      bus.emit({
        name: "runtime.started",
        payload: { runtimeId: "rt-dyn", occurredAt: new Date().toISOString() }
      });

      expect(onceFired).toBe(1);
      expect(dynamicFired).toBe(1);
      expect(bus.listenerCount("runtime.started")).toBe(0);

      // Emit again: should not fire anything
      bus.emit({
        name: "runtime.started",
        payload: { runtimeId: "rt-dyn", occurredAt: new Date().toISOString() }
      });

      expect(onceFired).toBe(1);
      expect(dynamicFired).toBe(1);
    });
  });

  describe("InMemoryMemoryStore Eviction & High-Load Capacity", () => {
    it("strictly bounds memory entries and evicts FIFO under 15,000 appends", async () => {
      const store = new InMemoryMemoryStore({
        maxEntries: 200,
        maxEntriesPerAgent: 50
      });

      const totalAppends = 15_000;
      for (let i = 0; i < totalAppends; i++) {
        await store.append({
          agentId: `agent-${i % 10}`,
          taskId: `task-${i}`,
          input: `Input query ${i}`,
          output: { resultIndex: i },
          recordedAt: new Date().toISOString()
        });
      }

      const size = await store.size();
      expect(size).toBeLessThanOrEqual(200);

      // Verify each agent does not exceed per-agent cap of 50
      for (let a = 0; a < 10; a++) {
        const agentEntries = await store.listByAgent(`agent-${a}`);
        expect(agentEntries.length).toBeLessThanOrEqual(50);
      }

      // Pagination test
      const page1 = await store.listByAgent("agent-0", { limit: 10, offset: 0 });
      expect(page1.length).toBe(10);

      // Clear test
      await store.clear();
      expect(await store.size()).toBe(0);
    });
  });

  describe("InMemoryRuntimeStateStore & Logger Bounded Capacity", () => {
    it("bounds state store keys under high throughput", async () => {
      const stateStore = new InMemoryRuntimeStateStore({ maxEntries: 100 });

      for (let i = 0; i < 5_000; i++) {
        await stateStore.put(`key-${i}`, { val: i });
      }

      expect(await stateStore.size()).toBe(100);
      expect(await stateStore.has("key-4999")).toBe(true);
      expect(await stateStore.has("key-0")).toBe(false); // Evicted FIFO

      await stateStore.delete("key-4999");
      expect(await stateStore.size()).toBe(99);
      await stateStore.clear();
      expect(await stateStore.size()).toBe(0);
    });

    it("bounds in-memory logger entries under continuous logging", () => {
      const logger = new InMemoryRuntimeLogger({ maxEntries: 50 });

      for (let i = 0; i < 2_000; i++) {
        logger.info(`Log message ${i}`);
      }

      expect(logger.size()).toBe(50);
      expect(logger.entries[49]?.message).toBe("Log message 1999");
      logger.clear();
      expect(logger.size()).toBe(0);
    });
  });

  describe("AgentInstanceManager Ephemeral Capacity", () => {
    it("caps agent instance map size to avoid memory leaks from unbounded ephemeral agents", () => {
      const manager = new AgentInstanceManager({ maxInstances: 50 });

      for (let i = 0; i < 1_000; i++) {
        manager.getOrCreate(`ephemeral-agent-${i}`);
      }

      expect(manager.size()).toBe(50);
      expect(manager.has("ephemeral-agent-999")).toBe(true);
      expect(manager.has("ephemeral-agent-0")).toBe(false);
      manager.clear();
      expect(manager.size()).toBe(0);
    });
  });

  describe("AgentRuntime Teardown & In-Flight Draining", () => {
    it("gracefully waits for in-flight tasks when draining during stop", async () => {
      const runtime = new AgentRuntime({ runtimeId: "rt-drain" });

      runtime.registerTool({
        name: "work",
        description: "Simulate async work",
        execute: async () => {
          await new Promise((r) => setTimeout(r, 40));
          return { done: true };
        }
      });

      await runtime.start();
      expect(runtime.isRunning()).toBe(true);

      const taskPromise = runtime.executeTask({
        taskId: "task-drain-1",
        agentId: "agent-drain",
        toolName: "work",
        input: "run work",
        payload: {}
      });

      expect(runtime.getInFlightTaskCount()).toBe(1);

      // Stop with drain timeout
      await runtime.stop({ drainTimeoutMs: 200, clearListeners: true });

      const result = await taskPromise;
      expect(result.output).toEqual({ done: true });
      expect(runtime.isRunning()).toBe(false);
      expect(runtime.getInFlightTaskCount()).toBe(0);
    });
  });
});
