import type { RuntimeEventBus } from "../events/runtime-events.js";
import type { RuntimeLogger } from "../logger/runtime-logger.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { ModelProvider } from "../providers/model-provider.js";
import type { RuntimeStateStore } from "../state/runtime-state.js";

export interface RuntimeOptions {
  runtimeId: string;
  memoryStore?: MemoryStore;
  memoryStoragePath?: string | undefined;
  modelProvider?: ModelProvider;
  logger?: RuntimeLogger;
  stateStore?: RuntimeStateStore;
  eventBus?: RuntimeEventBus;
}
