import { AgentInstanceManager } from "../agents/agent-instance-manager.js";
import { ActionExecutor } from "../actions/action-executor.js";
import { RuntimeEventBus } from "../events/runtime-events.js";
import { ConsoleRuntimeLogger } from "../logger/runtime-logger.js";
import { InMemoryMemoryStore } from "../memory/memory-store.js";
import { UnconfiguredModelProvider } from "../providers/model-provider.js";
import { InMemoryRuntimeStateStore } from "../state/runtime-state.js";
import { TaskRunner } from "../tasks/task-runner.js";
import { ToolRegistry } from "../tools/tool-registry.js";
import type { RuntimeOptions } from "./types.js";

export function createRuntimeDependencies(options: RuntimeOptions) {
  const toolRegistry = new ToolRegistry();
  const memoryStore = options.memoryStore ?? new InMemoryMemoryStore();
  const modelProvider =
    options.modelProvider ?? new UnconfiguredModelProvider();
  const logger = options.logger ?? new ConsoleRuntimeLogger();
  const stateStore = options.stateStore ?? new InMemoryRuntimeStateStore();
  const eventBus = options.eventBus ?? new RuntimeEventBus();
  const agentManager = new AgentInstanceManager();
  const actionExecutor = new ActionExecutor(toolRegistry, logger, eventBus);
  const taskRunner = new TaskRunner(actionExecutor, memoryStore);

  return {
    actionExecutor,
    agentManager,
    eventBus,
    logger,
    memoryStore,
    modelProvider,
    stateStore,
    taskRunner,
    toolRegistry
  };
}
