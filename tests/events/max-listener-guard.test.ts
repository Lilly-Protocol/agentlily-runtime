import { describe, it, expect, vi } from 'vitest';
import { RuntimeEventBus } from '../../src/events/runtime-events.js';

describe('RuntimeEventBus max-listener guard', () => {
  it('listenerCount returns 0 for unknown events', () => {
    const bus = new RuntimeEventBus();
    expect(bus.listenerCount('runtime.started')).toBe(0);
  });

  it('listenerCount reflects registered listeners', () => {
    const bus = new RuntimeEventBus();
    bus.on('runtime.started', () => {});
    bus.on('runtime.started', () => {});
    expect(bus.listenerCount('runtime.started')).toBe(2);
  });

  it('listenerCount decreases after unsubscribe', () => {
    const bus = new RuntimeEventBus();
    const unsub = bus.on('runtime.started', () => {});
    expect(bus.listenerCount('runtime.started')).toBe(1);
    unsub();
    expect(bus.listenerCount('runtime.started')).toBe(0);
  });

  it('warns when max listeners exceeded', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bus = new RuntimeEventBus({ maxListeners: 3 });

    bus.on('runtime.started', () => {});
    bus.on('runtime.started', () => {});
    bus.on('runtime.started', () => {});
    // 4th listener should trigger warning
    bus.on('runtime.started', () => {});

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('max listener count (3) exceeded');
    expect(warnSpy.mock.calls[0][0]).toContain('runtime.started');

    warnSpy.mockRestore();
  });

  it('does not warn below the limit', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bus = new RuntimeEventBus({ maxListeners: 5 });

    for (let i = 0; i < 5; i++) {
      bus.on('runtime.started', () => {});
    }

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('uses default max of 100 when no option provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bus = new RuntimeEventBus();

    for (let i = 0; i < 100; i++) {
      bus.on('runtime.started', () => {});
    }
    expect(warnSpy).not.toHaveBeenCalled();

    // 101st should warn
    bus.on('runtime.started', () => {});
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('max listener count (100) exceeded');

    warnSpy.mockRestore();
  });
});
