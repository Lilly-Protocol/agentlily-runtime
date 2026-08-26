import { describe, it, expect } from 'vitest';
import { RuntimeEventBus } from '../../src/events/runtime-events.js';

describe('RuntimeEventBus subscribe/unsubscribe semantics', () => {
  it('delivers events to a listener registered for the correct name', () => {
    const bus = new RuntimeEventBus();
    const received: string[] = [];

    bus.on('runtime.started', (e) => received.push(e.name));

    bus.emit({
      name: 'runtime.started',
      payload: { runtimeId: 'rt-1', occurredAt: new Date().toISOString() }
    });

    expect(received).toEqual(['runtime.started']);
  });

  it('stops delivery after unsubscribe', () => {
    const bus = new RuntimeEventBus();
    const received: string[] = [];

    const unsub = bus.on('runtime.started', (e) => received.push(e.name));

    bus.emit({
      name: 'runtime.started',
      payload: { runtimeId: 'rt-2', occurredAt: new Date().toISOString() }
    });

    unsub();

    bus.emit({
      name: 'runtime.started',
      payload: { runtimeId: 'rt-2b', occurredAt: new Date().toISOString() }
    });

    expect(received).toEqual(['runtime.started']);
  });

  it('does not invoke listeners registered for other event names', () => {
    const bus = new RuntimeEventBus();
    const startedReceived: string[] = [];
    const completedReceived: string[] = [];

    bus.on('runtime.started', (e) => startedReceived.push(e.name));
    bus.on('runtime.task.completed', (e) => completedReceived.push(e.name));

    bus.emit({
      name: 'runtime.started',
      payload: { runtimeId: 'rt-4', occurredAt: new Date().toISOString() }
    });

    expect(startedReceived).toEqual(['runtime.started']);
    expect(completedReceived).toEqual([]);
  });

  it('unsubscribe removes the listener and subsequent emits do not deliver', () => {
    const bus = new RuntimeEventBus();
    const received: string[] = [];
    const handler = (e: any) => received.push(e.name);

    const unsub = bus.on('runtime.started', handler);
    unsub();

    bus.emit({
      name: 'runtime.started',
      payload: { runtimeId: 'rt-5', occurredAt: new Date().toISOString() }
    });

    expect(received).toEqual([]);
  });

  it('multiple distinct listeners on the same event all receive delivery', () => {
    const bus = new RuntimeEventBus();
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    bus.on('runtime.started', (e) => receivedA.push(e.name));
    bus.on('runtime.started', (e) => receivedB.push(e.name));

    bus.emit({
      name: 'runtime.started',
      payload: { runtimeId: 'rt-6', occurredAt: new Date().toISOString() }
    });

    expect(receivedA).toEqual(['runtime.started']);
    expect(receivedB).toEqual(['runtime.started']);
  });
});
