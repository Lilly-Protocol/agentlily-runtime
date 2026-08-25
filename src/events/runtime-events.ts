export interface RuntimeEventMap {
  "runtime.started": { runtimeId: string; occurredAt: string };
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
) => void;

export interface RuntimeEventBusOptions {
  /** Maximum number of listeners allowed for each event name. */
  maxListeners?: number;
}

export class RuntimeEventListenerLimitError extends Error {
  public readonly eventName: RuntimeEventName;
  public readonly maxListeners: number;

  public constructor(eventName: RuntimeEventName, maxListeners: number) {
    super(
      `Cannot add listener for "${eventName}": the limit of ${maxListeners} listeners has been reached.`
    );
    this.name = "RuntimeEventListenerLimitError";
    this.eventName = eventName;
    this.maxListeners = maxListeners;
  }
}

export class RuntimeEventBus {
  public static readonly defaultMaxListeners = 100;

  private readonly listeners = new Map<
    RuntimeEventName,
    Set<RuntimeEventListener<RuntimeEventName>>
  >();
  private readonly maxListeners: number;

  public constructor(options: RuntimeEventBusOptions = {}) {
    const maxListeners =
      options.maxListeners ?? RuntimeEventBus.defaultMaxListeners;

    if (!Number.isInteger(maxListeners) || maxListeners < 1) {
      throw new RangeError("maxListeners must be a positive integer.");
    }

    this.maxListeners = maxListeners;
  }

  public on<TName extends RuntimeEventName>(
    name: TName,
    listener: RuntimeEventListener<TName>
  ): () => void {
    const existing = this.listeners.get(name) ?? new Set();
    const runtimeListener =
      listener as RuntimeEventListener<RuntimeEventName>;

    if (!existing.has(runtimeListener) && existing.size >= this.maxListeners) {
      throw new RuntimeEventListenerLimitError(name, this.maxListeners);
    }

    existing.add(runtimeListener);
    this.listeners.set(name, existing);

    return () => {
      existing.delete(runtimeListener);

      if (existing.size === 0) {
        this.listeners.delete(name);
      }
    };
  }

  public listenerCount(name: RuntimeEventName): number {
    return this.listeners.get(name)?.size ?? 0;
  }

  public emit<TName extends RuntimeEventName>(
    event: RuntimeEvent<TName>
  ): void {
    const listeners = this.listeners.get(event.name);

    listeners?.forEach((listener) => {
      listener(event);
    });
  }
}
