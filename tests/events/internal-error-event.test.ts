import { describe, it, expect, vi } from 'vitest';
import { RuntimeEventBus } from '../../src/events/runtime-events.js';

describe('runtime.internal.error event', () => {
  it('emits runtime.internal.error when a listener throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new RuntimeEventBus();
    const internalErrors: any[] = [];

    bus.on('runtime.started', () => { throw new Error('listener boom'); });
    bus.on('runtime.internal.error', (event) => { internalErrors.push(event); });

    bus.emit({
      name: 'runtime.started',
      payload: { runtimeId: 'rt-1', occurredAt: new Date().toISOString() }
    });

    expect(internalErrors).toHaveLength(1);
    expect(internalErrors[0].name).toBe('runtime.internal.error');
    expect(internalErrors[0].payload.eventName).toBe('runtime.started');
    expect(internalErrors[0].payload.errorMessage).toBe('listener boom');
    expect(internalErrors[0].payload.occurredAt).toBeDefined();

    errorSpy.mockRestore();
  });

  it('does not emit runtime.internal.error for its own listener failures (no loop)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new RuntimeEventBus();
    let internalErrorCount = 0;

    bus.on('runtime.internal.error', () => {
      internalErrorCount++;
      throw new Error('internal handler also fails');
    });

    // Trigger an error on a different event to cause internal error emission
    bus.on('runtime.started', () => { throw new Error('original fail'); });

    expect(() => {
      bus.emit({
        name: 'runtime.started',
        payload: { runtimeId: 'rt-2', occurredAt: new Date().toISOString() }
      });
    }).not.toThrow();

    // Internal error listener was called once, but its own failure did not recurse
    expect(internalErrorCount).toBe(1);

    errorSpy.mockRestore();
  });

  it('handles non-Error thrown values in errorMessage', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new RuntimeEventBus();
    const internalErrors: any[] = [];

    bus.on('runtime.started', () => { throw 'string-throw'; });
    bus.on('runtime.internal.error', (event) => { internalErrors.push(event); });

    bus.emit({
      name: 'runtime.started',
      payload: { runtimeId: 'rt-3', occurredAt: new Date().toISOString() }
    });

    expect(internalErrors).toHaveLength(1);
    expect(internalErrors[0].payload.errorMessage).toBe('string-throw');

    errorSpy.mockRestore();
  });

  it('does not emit runtime.internal.error when no listeners throw', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new RuntimeEventBus();
    const internalErrors: any[] = [];

    bus.on('runtime.started', () => {});
    bus.on('runtime.internal.error', (event) => { internalErrors.push(event); });

    bus.emit({
      name: 'runtime.started',
      payload: { runtimeId: 'rt-4', occurredAt: new Date().toISOString() }
    });

    expect(internalErrors).toHaveLength(0);

    errorSpy.mockRestore();
  });
});
