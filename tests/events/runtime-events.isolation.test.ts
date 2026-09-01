import { describe, it, expect, vi } from 'vitest';
import { RuntimeEventBus, RuntimeEvent } from '../../src/events/runtime-events';

describe('RuntimeEventBus listener isolation', () => {
  it('continues delivering to remaining listeners when one throws', () => {
    const bus = new RuntimeEventBus();
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    const spy3 = vi.fn();

    bus.on('runtime.started', spy1);
    bus.on('runtime.started', () => { throw new Error('boom'); });
    bus.on('runtime.started', spy2);
    bus.on('runtime.started', spy3);

    const event: RuntimeEvent<'runtime.started'> = {
      name: 'runtime.started',
      payload: { runtimeId: 'r1', occurredAt: new Date().toISOString() },
    };

    expect(() => bus.emit(event)).not.toThrow();
    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);
    expect(spy3).toHaveBeenCalledTimes(1);
  });

  it('emit never propagates listener errors to caller', () => {
    const bus = new RuntimeEventBus();
    bus.on('runtime.task.failed', () => { throw new Error('listener failure'); });

    const event: RuntimeEvent<'runtime.task.failed'> = {
      name: 'runtime.task.failed',
      payload: { runtimeId: 'r1', taskId: 't1', agentId: 'a1', reason: 'test' },
    };

    expect(() => bus.emit(event)).not.toThrow();
  });

  it('logs listener errors without breaking delivery', () => {
    const bus = new RuntimeEventBus();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const nextListener = vi.fn();

    bus.on('runtime.task.completed', () => { throw new Error('isolated error'); });
    bus.on('runtime.task.completed', nextListener);

    const event: RuntimeEvent<'runtime.task.completed'> = {
      name: 'runtime.task.completed',
      payload: { runtimeId: 'r1', taskId: 't1', agentId: 'a1', toolName: 'test-tool' },
    };

    bus.emit(event);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[RuntimeEventBus] Listener error during "runtime.task.completed"'),
      expect.any(Error)
    );
    expect(nextListener).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });
});
