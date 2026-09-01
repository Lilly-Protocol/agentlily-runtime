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
  "runtime.internal.error": {
    eventName: string;
    error: string;
    occurredAt: string;
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

export interface RuntimeEventBusOptions {
  /** Maximum listener registrations allowed per event name before warning. Defaults to 100. */
  maxListeners?: number;
}

export const DEFAULT_MAX_LISTENERS = 100;

export class RuntimeEventBus {
  private readonly listeners = new Map<
    RuntimeEventName,
    Set<RuntimeEventListener<RuntimeEventName>>
  >();
  private readonly maxListeners: number;
  private isEmittingInternalError = false;

  public constructor(options?: RuntimeEventBusOptions) {
    this.maxListeners = options?.maxListeners ?? DEFAULT_MAX_LISTENERS;
  }

  public on<TName extends RuntimeEventName>(
    name: TName,
    listener: RuntimeEventListener<TName>
  ): () => void {
    const existing = this.listeners.get(name) ?? new Set();
    if (existing.size >= this.maxListeners) {
      console.warn(
        `[RuntimeEventBus] Warning: Event "${name}" reached maximum listener limit (${this.maxListeners}).`
      );
    }
    existing.add(listener as RuntimeEventListener<RuntimeEventName>);
    this.listeners.set(name, existing);

    return () => {
      this.off(name, listener);
    };
  }

  public listenerCount(name: RuntimeEventName): number {
    return this.listeners.get(name)?.size ?? 0;
  }

  public emit<TName extends RuntimeEventName>(
    event: RuntimeEvent<TName>
  ): void {
    const listenerSet = this.listeners.get(event.name);
    if (!listenerSet || listenerSet.size === 0) {
      return;
    }

    const snapshot = Array.from(listenerSet);

    for (const listener of snapshot) {
      try {
        listener(event);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (event.name !== "runtime.internal.error" && !this.isEmittingInternalError) {
          try {
            this.isEmittingInternalError = true;
            this.emit({
              name: "runtime.internal.error",
              payload: {
                eventName: event.name,
                error: errorMsg,
                occurredAt: new Date().toISOString()
              }
            });
          } finally {
            this.isEmittingInternalError = false;
          }
        }
      }
    }
  }

  public listenerCount(name: RuntimeEventName): number {
    return this.listeners.get(name)?.size ?? 0;
  }
}
