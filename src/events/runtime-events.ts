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

  public on<TName extends RuntimeEventName>(
    name: TName,
    listener: RuntimeEventListener<TName>
  ): () => void {
    const existing = this.listeners.get(name) ?? new Set();
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

    if (!listeners) return;

    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(
          `RuntimeEventBus: listener error for "${event.name}":`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }
}
