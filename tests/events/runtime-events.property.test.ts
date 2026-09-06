import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { RuntimeEventBus } from "../../src/events/runtime-events.js";

type Operation = {
  kind: "on" | "off" | "unsubscribe";
  listenerId: number;
};

const EVENT_NAME = "runtime.started" as const;
const LISTENER_COUNT = 8;

const operationArb: fc.Arbitrary<Operation> = fc.record({
  kind: fc.constantFrom("on", "off", "unsubscribe"),
  listenerId: fc.integer({ min: 0, max: LISTENER_COUNT - 1 })
});

describe("RuntimeEventBus property-based listener lifecycle", () => {
  it("keeps listener counts and delivery aligned with random add/remove sequences", () => {
    fc.assert(
      fc.property(
        fc.array(operationArb, { minLength: 1, maxLength: 100 }),
        (operations) => {
          const bus = new RuntimeEventBus();
          const live = new Set<number>();
          const unsubscribeById = new Map<number, () => void>();
          const deliveries = Array.from({ length: LISTENER_COUNT }, () => 0);
          const listeners = Array.from(
            { length: LISTENER_COUNT },
            (_, listenerId) => () => {
              deliveries[listenerId] = (deliveries[listenerId] ?? 0) + 1;
            }
          );

          for (const operation of operations) {
            const listener = listeners[operation.listenerId]!;

            if (operation.kind === "on") {
              const unsubscribe = bus.on(EVENT_NAME, listener);
              if (!live.has(operation.listenerId)) {
                live.add(operation.listenerId);
                unsubscribeById.set(operation.listenerId, unsubscribe);
              }
            } else if (operation.kind === "off") {
              const wasLive = live.delete(operation.listenerId);
              expect(bus.off(EVENT_NAME, listener)).toBe(wasLive);
            } else {
              const unsubscribe = unsubscribeById.get(operation.listenerId);
              if (unsubscribe) {
                unsubscribe();
                live.delete(operation.listenerId);
              }
            }

            expect(bus.listenerCount(EVENT_NAME)).toBe(live.size);

            const beforeEmit = [...deliveries];
            bus.emit({
              name: EVENT_NAME,
              payload: {
                runtimeId: "runtime-property-test",
                occurredAt: "2026-09-04T00:00:00.000Z"
              }
            });

            for (let listenerId = 0; listenerId < LISTENER_COUNT; listenerId++) {
              const delivered =
                (deliveries[listenerId] ?? 0) - (beforeEmit[listenerId] ?? 0);
              expect(delivered).toBe(live.has(listenerId) ? 1 : 0);
            }
            expect(bus.listenerCount(EVENT_NAME)).toBe(live.size);
          }

          let probeDeliveries = 0;
          const unsubscribeProbe = bus.on(EVENT_NAME, () => {
            probeDeliveries += 1;
          });
          expect(bus.listenerCount(EVENT_NAME)).toBe(live.size + 1);

          unsubscribeProbe();
          expect(bus.listenerCount(EVENT_NAME)).toBe(live.size);

          bus.emit({
            name: EVENT_NAME,
            payload: {
              runtimeId: "runtime-property-test",
              occurredAt: "2026-09-04T00:00:00.000Z"
            }
          });
          expect(probeDeliveries).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
