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
  "runtime.internal.error": {
    eventName: string;
    errorMessage: string;
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `RuntimeEventBus: listener error for "${event.name}":`,
          errorMessage
        );
        // Emit internal error event (best-effort, avoid infinite loop)
        if (event.name !== "runtime.internal.error") {
          const internalErrorListeners = this.listeners.get("runtime.internal.error");
          if (internalErrorListeners) {
            const internalEvent = {
              name: "runtime.internal.error" as const,
              payload: {
                eventName: event.name,
                errorMessage,
                occurredAt: new Date().toISOString(),
              },
            };
            for (const iel of internalErrorListeners) {
              try {
                iel(internalEvent);
              } catch {
                // Swallow errors from internal error listeners to prevent loops
              }
            }
          }
        }
      }
    }
  }
}
