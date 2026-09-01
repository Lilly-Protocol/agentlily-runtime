import { describe, it, expect, vi } from 'vitest';
import { ActionExecutor } from '../../src/actions/action-executor.js';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import type { RuntimeEventBus } from '../../src/events/runtime-events.js';
import type { RuntimeContext } from '../../src/runtime/context.js';

describe('runtime.tool.invoked audit event', () => {
  function makeSetup() {
    const events: any[] = [];
    const eventBus = {
      emit: vi.fn((e: any) => events.push(e)),
      on: vi.fn(),
      off: vi.fn(),
      listenerCount: vi.fn(() => 0),
    } as unknown as RuntimeEventBus;

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    };

    const registry = new ToolRegistry();
    registry.register({
      name: 'echo',
      description: 'Echo tool',
      inputSchema: { type: 'object', properties: {} },
      execute: vi.fn(async ({ payload }: any) => ({ echoed: payload })),
    });

    const executor = new ActionExecutor(registry, logger as any, eventBus);

    const context: RuntimeContext = {
      runtimeId: 'rt-1',
      taskId: 'task-42',
      agent: { id: 'agent-x' } as any,
      memory: {} as any,
      modelProvider: {} as any,
      state: {} as any,
      now: new Date().toISOString(),
    };

    return { executor, eventBus, events, context };
  }

  it('emits runtime.tool.invoked with correct payload on every execution', async () => {
    const { executor, events, context } = makeSetup();

    await executor.execute('echo', { msg: 'hello' }, context);

    const invoked = events.find((e) => e.name === 'runtime.tool.invoked');
    expect(invoked).toBeDefined();
    expect(invoked.payload.runtimeId).toBe('rt-1');
    expect(invoked.payload.taskId).toBe('task-42');
    expect(invoked.payload.agentId).toBe('agent-x');
    expect(invoked.payload.toolName).toBe('echo');
    expect(invoked.payload.invokedAt).toBeDefined();
    expect(typeof invoked.payload.invokedAt).toBe('string');
  });

  it('emits the event before tool execution begins', async () => {
    const callOrder: string[] = [];
    const events: any[] = [];
    const eventBus = {
      emit: vi.fn((e: any) => { events.push(e); callOrder.push('emit'); }),
      on: vi.fn(),
      off: vi.fn(),
      listenerCount: vi.fn(() => 0),
    } as unknown as RuntimeEventBus;

    const registry = new ToolRegistry();
    registry.register({
      name: 'ordered',
      description: 'Ordered tool',
      inputSchema: { type: 'object', properties: {} },
      execute: vi.fn(async () => { callOrder.push('execute'); return {}; }),
    });

    const executor = new ActionExecutor(registry, undefined, eventBus);
    const context: RuntimeContext = {
      runtimeId: 'rt-2',
      taskId: 't-1',
      agent: { id: 'a-1' } as any,
      memory: {} as any,
      modelProvider: {} as any,
      state: {} as any,
      now: new Date().toISOString(),
    };

    await executor.execute('ordered', {}, context);

    expect(callOrder[0]).toBe('emit');
    expect(callOrder[1]).toBe('execute');
  });

  it('works without eventBus (optional dependency)', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'noop',
      description: 'Noop',
      inputSchema: { type: 'object', properties: {} },
      execute: vi.fn(async () => ({ ok: true })),
    });

    const executor = new ActionExecutor(registry);
    const context: RuntimeContext = {
      runtimeId: 'rt-3',
      taskId: 't-2',
      agent: { id: 'a-2' } as any,
      memory: {} as any,
      modelProvider: {} as any,
      state: {} as any,
      now: new Date().toISOString(),
    };

    const result = await executor.execute('noop', {}, context);
    expect(result).toEqual({ ok: true });
  });
});
