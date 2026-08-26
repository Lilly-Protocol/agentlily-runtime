import { describe, it, expect, vi } from 'vitest';
import { AgentRuntime } from '../../src/runtime/agent-runtime.js';
import { RuntimeError } from '../../src/errors/runtime-errors.js';

describe('AgentRuntime.stop()', () => {
  function makeRuntime() {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    };
    const events: any[] = [];
    const eventBus = {
      emit: vi.fn((e: any) => events.push(e)),
      on: vi.fn(),
      off: vi.fn(),
    };

    const runtime = new AgentRuntime({
      runtimeId: 'test-shutdown',
      logger: logger as any,
      eventBus: eventBus as any,
      tools: [],
      modelProvider: { generate: vi.fn() } as any,
    });

    return { runtime, logger, events };
  }

  it('emits runtime.stopped event and logs stop', async () => {
    const { runtime, logger, events } = makeRuntime();
    await runtime.start();
    await runtime.stop();

    const stoppedEvent = events.find((e) => e.name === 'runtime.stopped');
    expect(stoppedEvent).toBeDefined();
    expect(stoppedEvent.payload.runtimeId).toBe('test-shutdown');
    expect(stoppedEvent.payload.occurredAt).toBeDefined();

    const stopLog = logger.info.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('stopped')
    );
    expect(stopLog).toBeDefined();
  });

  it('is idempotent - calling stop twice does not emit twice', async () => {
    const { runtime, events } = makeRuntime();
    await runtime.start();
    await runtime.stop();
    await runtime.stop();

    const stoppedEvents = events.filter((e) => e.name === 'runtime.stopped');
    expect(stoppedEvents).toHaveLength(1);
  });

  it('rejects executeTask after stop with RUNTIME_NOT_STARTED', async () => {
    const { runtime } = makeRuntime();
    runtime.registerTool({
      name: 'echo',
      description: 'Echo tool',
      inputSchema: { type: 'object', properties: {} },
      execute: vi.fn(async () => ({ echoed: true })),
    });

    await runtime.start();
    await runtime.stop();

    await expect(
      runtime.executeTask({
        taskId: 'task-after-stop',
        agentId: 'agent-1',
        toolName: 'echo',
        input: 'test',
        payload: {},
      })
    ).rejects.toThrow(RuntimeError);

    try {
      await runtime.executeTask({
        taskId: 'task-after-stop-2',
        agentId: 'agent-1',
        toolName: 'echo',
        input: 'test',
        payload: {},
      });
    } catch (error: any) {
      expect(error.code).toBe('RUNTIME_NOT_STARTED');
    }
  });

  it('stop without start is a no-op', async () => {
    const { runtime, events } = makeRuntime();
    await runtime.stop();
    const stoppedEvents = events.filter((e) => e.name === 'runtime.stopped');
    expect(stoppedEvents).toHaveLength(0);
  });
});
