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

const DEFAULT_MAX_LISTENERS = 100;

export class RuntimeEventBus {
  private readonly listeners = new Map<
    RuntimeEventName,
    Set<RuntimeEventListener<RuntimeEventName>>
  >();
  private readonly maxListeners: number;

  public constructor(options?: { maxListeners?: number }) {
    this.maxListeners = options?.maxListeners ?? DEFAULT_MAX_LISTENERS;
  }

  public listenerCount(name: RuntimeEventName): number {
    return this.listeners.get(name)?.size ?? 0;
  }

  public on<TName extends RuntimeEventName>(
    name: TName,
    listener: RuntimeEventListener<TName>
  ): () => void {
    const existing = this.listeners.get(name) ?? new Set();

    if (existing.size >= this.maxListeners) {
      console.warn(
        `RuntimeEventBus: max listener count (${this.maxListeners}) exceeded for event "${name}". ` +
        `This may indicate a memory leak from unsubscribed listeners.`
      );
    }

    existing.add(listener as RuntimeEventListener<RuntimeEventName>);
    this.listeners.set(name, existing);

    return () => {
      existing.delete(listener as RuntimeEventListener<RuntimeEventName>);
    };
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
