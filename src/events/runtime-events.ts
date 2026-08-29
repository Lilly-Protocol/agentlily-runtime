export interface RuntimeEventMap {
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
  };
  "runtime.task.failed": {
    runtimeId: string;
    taskId: string;
    agentId: string;
    reason: string;
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
) => void | Promise<void>;

export interface RuntimeEventBusErrorHandler {
  (error: unknown, event: RuntimeEvent<RuntimeEventName>): void;
}

export class RuntimeEventBus {
  private readonly listeners = new Map<
    RuntimeEventName,
    Set<RuntimeEventListener<RuntimeEventName>>
  >();
  private errorHandler?: RuntimeEventBusErrorHandler;

  public constructor(errorHandler?: RuntimeEventBusErrorHandler) {
    this.errorHandler = errorHandler;
  }

  public setErrorHandler(handler?: RuntimeEventBusErrorHandler): void {
    this.errorHandler = handler;
  }

  public on<TName extends RuntimeEventName>(
    name: TName,
    listener: RuntimeEventListener<TName>
  ): () => void {
    let existing = this.listeners.get(name);
    if (!existing) {
      existing = new Set();
      this.listeners.set(name, existing);
    }
    const genericListener = listener as RuntimeEventListener<RuntimeEventName>;
    existing.add(genericListener);

    return () => {
      this.off(name, listener);
    };
  }

  public once<TName extends RuntimeEventName>(
    name: TName,
    listener: RuntimeEventListener<TName>
  ): () => void {
    const unsubscribe = this.on(name, ((event: RuntimeEvent<TName>) => {
      unsubscribe();
      return listener(event);
    }) as RuntimeEventListener<TName>);

    return unsubscribe;
  }

  public off<TName extends RuntimeEventName>(
    name: TName,
    listener: RuntimeEventListener<TName>
  ): boolean {
    const existing = this.listeners.get(name);
    if (!existing) {
      return false;
    }

    const removed = existing.delete(
      listener as RuntimeEventListener<RuntimeEventName>
    );

    if (existing.size === 0) {
      this.listeners.delete(name);
    }

    return removed;
  }

  public removeAllListeners(name?: RuntimeEventName): void {
    if (name) {
      this.listeners.delete(name);
    } else {
      this.listeners.clear();
    }
  }

  public clear(): void {
    this.removeAllListeners();
  }

  public listenerCount(name?: RuntimeEventName): number {
    if (name) {
      return this.listeners.get(name)?.size ?? 0;
    }

    let count = 0;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }

  public emit<TName extends RuntimeEventName>(
    event: RuntimeEvent<TName>
  ): void {
    const listeners = this.listeners.get(event.name);
    if (!listeners || listeners.size === 0) {
      return;
    }

    // Defensive copy to prevent concurrent modification during dispatch
    const snapshot = Array.from(listeners);

    for (const listener of snapshot) {
      try {
        const result = listener(
          event as unknown as RuntimeEvent<RuntimeEventName>
        );
        if (result !== undefined && typeof (result as Promise<void>)?.then === "function") {
          void (result as Promise<void>).catch((err: unknown) => {
            if (this.errorHandler) {
              this.errorHandler(err, event as unknown as RuntimeEvent<RuntimeEventName>);
            }
          });
        }
      } catch (err) {
        if (this.errorHandler) {
          this.errorHandler(err, event as unknown as RuntimeEvent<RuntimeEventName>);
        }
      }
    }
  }

  public async emitAsync<TName extends RuntimeEventName>(
    event: RuntimeEvent<TName>
  ): Promise<PromiseSettledResult<void>[]> {
    const listeners = this.listeners.get(event.name);
    if (!listeners || listeners.size === 0) {
      return [];
    }

    const snapshot = Array.from(listeners);
    const promises = snapshot.map((listener) => {
      try {
        return Promise.resolve(
          listener(event as unknown as RuntimeEvent<RuntimeEventName>)
        );
      } catch (err) {
        return Promise.reject(err);
      }
    });

    return Promise.allSettled(promises);
  }
}
