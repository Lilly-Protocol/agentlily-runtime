import { describe, it, expect, vi } from 'vitest';
import { RuntimeEventBus } from '../../src/events/runtime-events.js';

describe('RuntimeEventBus isolates failing listeners', () => {
  it('continues delivering to other listeners when one throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new RuntimeEventBus();
    const results: string[] = [];

    bus.on('runtime.started', () => { results.push('first'); });
    bus.on('runtime.started', () => { throw new Error('boom'); });
    bus.on('runtime.started', () => { results.push('third'); });

    expect(() => {
      bus.emit({
        name: 'runtime.started',
        payload: { runtimeId: 'rt-1', occurredAt: new Date().toISOString() }
      });
    }).not.toThrow();

    expect(results).toEqual(['first', 'third']);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('listener error');
    expect(errorSpy.mock.calls[0][0]).toContain('runtime.started');

    errorSpy.mockRestore();
  });

  it('emit never throws even if all listeners fail', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new RuntimeEventBus();

    bus.on('runtime.started', () => { throw new Error('fail1'); });
    bus.on('runtime.started', () => { throw new Error('fail2'); });

    expect(() => {
      bus.emit({
        name: 'runtime.started',
        payload: { runtimeId: 'rt-2', occurredAt: new Date().toISOString() }
      });
    }).not.toThrow();

    expect(errorSpy).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });

  it('logs non-Error thrown values gracefully', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new RuntimeEventBus();

    bus.on('runtime.started', () => { throw 'string-error'; });

    expect(() => {
      bus.emit({
        name: 'runtime.started',
        payload: { runtimeId: 'rt-3', occurredAt: new Date().toISOString() }
      });
    }).not.toThrow();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][1]).toBe('string-error');

    errorSpy.mockRestore();
  });

  it('delivers normally when no listeners throw', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new RuntimeEventBus();
    const results: number[] = [];

    bus.on('runtime.started', () => { results.push(1); });
    bus.on('runtime.started', () => { results.push(2); });

    bus.emit({
      name: 'runtime.started',
      payload: { runtimeId: 'rt-4', occurredAt: new Date().toISOString() }
    });

    expect(results).toEqual([1, 2]);
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
