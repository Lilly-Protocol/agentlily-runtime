import type { RuntimeEventBus } from "../events/runtime-events.js";
import type { RuntimeLogger } from "../logger/runtime-logger.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { ModelProvider } from "../providers/model-provider.js";
import type { RuntimeStateStore } from "../state/runtime-state.js";
import type { ToolDefinition } from "../tools/types.js";

export interface RuntimeOptions {
  runtimeId: string;
  /**
   * Maximum number of agent instances retained by the runtime's
   * AgentInstanceManager. When the cap is reached, the oldest instance is
   * evicted (FIFO) before a new one is created.
   *
   * Defaults to 5_000 when omitted (the AgentInstanceManager default).
   */
  maxAgentInstances?: number;
  maxToolCallsPerTask?: number;
  maxAgentInstances?: number;
  memoryStore?: MemoryStore;
  memoryStoragePath?: string | undefined;
  modelProvider?: ModelProvider;
  logger?: RuntimeLogger;
  stateStore?: RuntimeStateStore;
  eventBus?: RuntimeEventBus;
  tools?: ToolDefinition[];
}
