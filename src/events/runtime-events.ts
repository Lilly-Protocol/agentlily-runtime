export interface RuntimeEventMap {
  "runtime.internal.error": {
    eventName: keyof RuntimeEventMap;
    errorMessage: string;
    occurredAt: string;
  };
  "runtime.started": { runtimeId: string; occurredAt: string };
  "runtime.stopped": { runtimeId: string; occurredAt: string };
  "runtime.task.received": {
    runtimeId: string;
    taskId: string;
    agentId: string;
  };
  "runtime.task.completed": {
    runtimeId: string;
    taskId: string;
    agentId: string;
    toolName: string;
    durationMs?: number;
  };
  "runtime.task.failed": {
    runtimeId: string;
    taskId: string;
    agentId: string;
    reason: string;
  };
  "runtime.tool.invoked": {
    runtimeId: string;
    taskId: string;
    agentId: string;
    toolName: string;
    invokedAt: string;
  };
}

export type RuntimeEventName = keyof RuntimeEventMap;

export interface RuntimeEvent<
  TName extends RuntimeEventName = RuntimeEventName
> {
  name: TName;
  payload: RuntimeEventMap[TName];
}

export type RuntimeEventListener<TName extends RuntimeEventName> = (
  event: RuntimeEvent<TName>
) => void;

export interface RuntimeEventBusOptions {
  /** Maximum listener registrations allowed per event name before warning. Defaults to 100. */
  maxListeners?: number;
  /** Optional handler invoked whenever a listener throws or rejects. */
  onListenerError?: (error: unknown) => void;
}

export const DEFAULT_MAX_LISTENERS = 100;

type Listener = RuntimeEventListener<RuntimeEventName>;

export class RuntimeEventBus {
  private readonly listeners = new Map<RuntimeEventName, Set<Listener>>();
  private readonly maxListeners: number;
  private readonly onListenerError: ((error: unknown) => void) | undefined;
  private isEmittingInternalError = false;

  public constructor(
    options?: number | RuntimeEventBusOptions | ((error: unknown) => void)
  ) {
    const resolved: RuntimeEventBusOptions =
      typeof options === "number"
        ? { maxListeners: options }
        : typeof options === "function"
          ? { onListenerError: options }
          : (options ?? {});

    if (
      resolved.maxListeners !== undefined &&
      (!Number.isInteger(resolved.maxListeners) || resolved.maxListeners < 1)
    ) {
      throw new RangeError("maxListeners must be a positive integer.");
    }

    this.maxListeners = resolved.maxListeners ?? DEFAULT_MAX_LISTENERS;
    this.onListenerError = resolved.onListenerError;
  }

  public on<TName extends RuntimeEventName>(
    eventName: TName,
    listener: RuntimeEventListener<TName>
  ): () => void {
    const listenerSet = this.getOrCreateListenerSet(eventName);
    const stored = listener as Listener;

    if (listenerSet.has(stored)) {
      return () => undefined;
    }

    if (listenerSet.size >= this.maxListeners) {
      console.warn(
        `[RuntimeEventBus] Possible memory leak: max listener count (${this.maxListeners}) exceeded for event "${eventName}".`
      );
    }

    listenerSet.add(stored);

    return () => {
      this.off(eventName, listener);
    };
  }

  public once<TName extends RuntimeEventName>(
    eventName: TName,
    listener: RuntimeEventListener<TName>
  ): () => void {
    const wrapped: RuntimeEventListener<TName> = (event) => {
      this.off(eventName, wrapped);
      listener(event);
    };
    this.on(eventName, wrapped);
    return () => this.off(eventName, wrapped);
  }

  public off<TName extends RuntimeEventName>(
    eventName: TName,
    listener: RuntimeEventListener<TName>
  ): boolean {
    const listenerSet = this.listeners.get(eventName);
    if (!listenerSet) {
      return false;
    }
    return listenerSet.delete(listener as Listener);
  }

  public listenerCount(eventName?: RuntimeEventName): number {
    if (eventName === undefined) {
      let total = 0;
      for (const listenerSet of this.listeners.values()) {
        total += listenerSet.size;
      }
      return total;
    }
    return this.listeners.get(eventName)?.size ?? 0;
  }

  public clear(): void {
    this.listeners.clear();
  }

  public emit<TName extends RuntimeEventName>(
    event: RuntimeEvent<TName>
  ): void {
    const listenerSet = this.listeners.get(event.name);
    if (!listenerSet) {
      return;
    }

    // Snapshot so listeners added during dispatch do not fire on this emit,
    // while still honoring removals that happen mid-dispatch.
    const snapshot = Array.from(listenerSet);

    for (const listener of snapshot) {
      if (!this.listeners.get(event.name)?.has(listener)) {
        continue;
      }

      try {
        const result = listener(event) as unknown;
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            this.handleListenerError(event.name, error);
          });
        }
      } catch (error) {
        this.handleListenerError(event.name, error);
      }
    }
  }

  private getOrCreateListenerSet(eventName: RuntimeEventName): Set<Listener> {
    let listenerSet = this.listeners.get(eventName);
    if (!listenerSet) {
      listenerSet = new Set<Listener>();
      this.listeners.set(eventName, listenerSet);
    }
    return listenerSet;
  }

  private handleListenerError(
    eventName: RuntimeEventName,
    error: unknown
  ): void {
    console.error(
      `[RuntimeEventBus] Listener error during "${eventName}" (listener error):`,
      error
    );
    this.onListenerError?.(error);

    if (
      eventName !== "runtime.internal.error" &&
      !this.isEmittingInternalError
    ) {
      this.isEmittingInternalError = true;
      try {
        this.emit({
          name: "runtime.internal.error",
          payload: {
            eventName,
            errorMessage:
              error instanceof Error ? error.message : String(error),
            occurredAt: new Date().toISOString()
          }
        });
      } finally {
        this.isEmittingInternalError = false;
      }
    }
  }
}
