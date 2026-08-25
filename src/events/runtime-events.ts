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

export class RuntimeEventBus {
  private readonly listeners = new Map<
    RuntimeEventName,
    Set<RuntimeEventListener<RuntimeEventName>>
  >();
  private readonly maxListenersPerEvent: number;

  public constructor(maxListenersPerEvent: number = 100) {
    this.maxListenersPerEvent = maxListenersPerEvent;
  }

  public on<TName extends RuntimeEventName>(
    name: TName,
    listener: RuntimeEventListener<TName>
  ): () => void {
    const existing = this.listeners.get(name) ?? new Set();
    
    if (existing.size >= this.maxListenersPerEvent) {
      console.warn(
        `RuntimeEventBus: Max listener limit (${this.maxListenersPerEvent}) exceeded for event "${name}". ` +
        `Possible memory leak. Current count: ${existing.size}`
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

  public listenerCount(name: RuntimeEventName): number {
    return this.listeners.get(name)?.size ?? 0;
  }
}
