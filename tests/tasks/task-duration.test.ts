import { describe, it, expect, vi } from 'vitest';
import { TaskRunner } from '../../src/tasks/task-runner.js';
import type { ActionExecutor } from '../../src/actions/action-executor.js';
import type { MemoryStore } from '../../src/memory/memory-store.js';
import type { RuntimeContext } from '../../src/runtime/context.js';
import type { RuntimeTask } from '../../src/tasks/task-types.js';

function makeMockActionExecutor(delayMs: number = 0): ActionExecutor {
  return {
    execute: vi.fn(async () => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return { result: 'success' };
    }),
  } as unknown as ActionExecutor;
}

function makeMockMemoryStore(): MemoryStore {
  return {
    append: vi.fn(async () => {}),
  } as unknown as MemoryStore;
}

function makeTask(overrides: Partial<RuntimeTask> = {}): RuntimeTask {
  return {
    taskId: 'task-1',
    agentId: 'agent-1',
    toolName: 'test-tool',
    input: 'test input',
    payload: {},
    ...overrides,
  };
}

const mockContext = {} as RuntimeContext;

describe('TaskExecutionResult duration fields', () => {
  it('includes startedAt and durationMs in the result', async () => {
    const runner = new TaskRunner(makeMockActionExecutor(), makeMockMemoryStore());
    const result = await runner.run(makeTask(), mockContext);

    expect(result.startedAt).toBeDefined();
    expect(typeof result.startedAt).toBe('string');
    expect(new Date(result.startedAt).toISOString()).toBe(result.startedAt);

    expect(result.durationMs).toBeDefined();
    expect(typeof result.durationMs).toBe('number');
  });

  it('durationMs is always >= 0', async () => {
    const runner = new TaskRunner(makeMockActionExecutor(), makeMockMemoryStore());
    const result = await runner.run(makeTask(), mockContext);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('durationMs reflects actual execution time', async () => {
    const delayMs = 50;
    const runner = new TaskRunner(makeMockActionExecutor(delayMs), makeMockMemoryStore());
    const result = await runner.run(makeTask(), mockContext);

    expect(result.durationMs).toBeGreaterThanOrEqual(delayMs - 10);
    expect(result.durationMs).toBeLessThan(delayMs + 200);
  });

  it('startedAt is before completedAt', async () => {
    const runner = new TaskRunner(makeMockActionExecutor(10), makeMockMemoryStore());
    const result = await runner.run(makeTask(), mockContext);

    const started = new Date(result.startedAt).getTime();
    const completed = new Date(result.completedAt).getTime();

    expect(started).toBeLessThanOrEqual(completed);
  });
});
