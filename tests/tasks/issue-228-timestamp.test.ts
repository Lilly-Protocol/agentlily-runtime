import { describe, it, expect, vi } from "vitest";
import { TaskRunner } from "../../src/tasks/task-runner.js";
import type { ActionExecutor } from "../../src/actions/action-executor.js";
import type { MemoryStore, MemoryEntry } from "../../src/memory/memory-store.js";
import type { RuntimeContext } from "../../src/runtime/context.js";
import type { RuntimeTask } from "../../src/tasks/task-types.js";

describe("TaskRunner timestamp persistence (Issue #228)", () => {
  it("persists recordedAt as a valid ISO string matching completedAt without calling toISOString on a string", async () => {
    let capturedEntry: MemoryEntry | undefined;
    const appendSpy = vi.fn(async (entry: MemoryEntry) => {
      capturedEntry = entry;
    });

    const memoryStore: MemoryStore = {
      append: appendSpy,
      listByAgent: vi.fn(async () => [])
    };

    const actionExecutor: ActionExecutor = {
      execute: vi.fn(async () => ({ status: "ok", payload: "test-data" }))
    } as unknown as ActionExecutor;

    const runner = new TaskRunner(actionExecutor, memoryStore);

    const task: RuntimeTask = {
      taskId: "task-228",
      agentId: "agent-228",
      toolName: "test-tool",
      input: "test execution input",
      payload: {}
    };

    const context = {
      runtimeId: "rt-228",
      taskId: "task-228",
      agent: {
        agentId: "agent-228",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      memory: memoryStore,
      modelProvider: {} as any,
      state: {} as any,
      now: new Date().toISOString()
    } as unknown as RuntimeContext;

    // Execution must resolve cleanly, NOT reject with EXECUTION_FAILED
    const result = await runner.run(task, context);

    // 1. Verify result structure
    expect(result).toBeDefined();
    expect(result.output).toEqual({ status: "ok", payload: "test-data" });
    expect(typeof result.completedAt).toBe("string");
    expect(typeof result.startedAt).toBe("string");

    // 2. Verify memoryStore.append was invoked
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(capturedEntry).toBeDefined();

    // 3. Verify recordedAt is an ISO string valid under Date.parse
    const parsedCompletedAt = Date.parse(result.completedAt);
    expect(Number.isNaN(parsedCompletedAt)).toBe(false);
    expect(new Date(result.completedAt).toISOString()).toBe(result.completedAt);

    const parsedRecordedAt = Date.parse(capturedEntry!.recordedAt);
    expect(Number.isNaN(parsedRecordedAt)).toBe(false);
    expect(new Date(capturedEntry!.recordedAt).toISOString()).toBe(
      capturedEntry!.recordedAt
    );

    // 4. Verify recordedAt strictly equals completedAt
    expect(capturedEntry!.recordedAt).toBe(result.completedAt);
    expect(capturedEntry!.agentId).toBe(task.agentId);
    expect(capturedEntry!.taskId).toBe(task.taskId);
    expect(capturedEntry!.input).toBe(task.input);
    expect(capturedEntry!.output).toEqual({
      status: "ok",
      payload: "test-data"
    });
  });

  it("handles string input and payload with chronological start and completion timestamps", async () => {
    let capturedEntry: MemoryEntry | undefined;

    const memoryStore: MemoryStore = {
      append: vi.fn(async (entry: MemoryEntry) => {
        capturedEntry = entry;
      }),
      listByAgent: vi.fn(async () => [])
    };

    const actionExecutor: ActionExecutor = {
      execute: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return { value: 42 };
      })
    } as unknown as ActionExecutor;

    const runner = new TaskRunner(actionExecutor, memoryStore);

    const task: RuntimeTask = {
      taskId: "task-228-chrono",
      agentId: "agent-228-chrono",
      toolName: "chrono-tool",
      input: "chrono input",
      payload: { param: "val" }
    };

    const context = {
      runtimeId: "rt-chrono",
      taskId: "task-228-chrono",
      agent: {
        agentId: "agent-228-chrono",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      memory: memoryStore,
      modelProvider: {} as any,
      state: {} as any,
      now: new Date().toISOString()
    } as unknown as RuntimeContext;

    const result = await runner.run(task, context);

    expect(Date.parse(result.startedAt)).toBeLessThanOrEqual(
      Date.parse(result.completedAt)
    );
    expect(capturedEntry?.recordedAt).toBe(result.completedAt);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
