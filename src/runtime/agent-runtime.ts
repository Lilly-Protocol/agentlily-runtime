import { RuntimeError } from "../errors/runtime-errors.js";
import { assertRuntimeStarted } from "../guards/runtime-guards.js";
import type { RuntimeTask, TaskExecutionResult } from "../tasks/task-types.js";
import type { ToolDefinition } from "../tools/types.js";
import { createRuntimeDependencies } from "./bootstrap.js";
import type { RuntimeContext } from "./context.js";
import type { RuntimeOptions } from "./types.js";

export interface RuntimeStopOptions {
  clearListeners?: boolean;
  drainTimeoutMs?: number;
}

export class AgentRuntime {
  private readonly dependencies;
  private readonly runtimeId: string;
  private readonly inFlightTasks = new Set<string>();
  private started = false;

  public constructor(options: RuntimeOptions) {
    this.runtimeId = options.runtimeId;
    this.dependencies = createRuntimeDependencies(options);
  }

  public registerTool<TPayload, TResult>(
    tool: ToolDefinition<TPayload, TResult>
  ): void {
    this.dependencies.toolRegistry.register(tool);
  }

  public isRunning(): boolean {
    return this.started;
  }

  public getInFlightTaskCount(): number {
    return this.inFlightTasks.size;
  }

  public async start(): Promise<void> {
    if (this.started) {
      throw new RuntimeError(
        "RUNTIME_ALREADY_STARTED",
        "AgentRuntime has already been started."
      );
    }

    this.started = true;
    this.dependencies.logger.info("Runtime started.", {
      runtimeId: this.runtimeId
    });
    this.dependencies.eventBus.emit({
      name: "runtime.started",
      payload: {
        runtimeId: this.runtimeId,
        occurredAt: new Date().toISOString()
      }
    });
  }

  public async stop(options: RuntimeStopOptions = {}): Promise<void> {
    if (!this.started) {
      return;
    }

    // Drain in-flight tasks if requested
    if (options.drainTimeoutMs && options.drainTimeoutMs > 0 && this.inFlightTasks.size > 0) {
      const startTime = Date.now();
      while (this.inFlightTasks.size > 0 && Date.now() - startTime < options.drainTimeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    this.started = false;
    const occurredAt = new Date().toISOString();
    this.dependencies.logger.info("Runtime stopped.", {
      runtimeId: this.runtimeId
    });
    this.dependencies.eventBus.emit({
      name: "runtime.stopped",
      payload: {
        runtimeId: this.runtimeId,
        occurredAt
      }
    });

    if (options.clearListeners) {
      this.dependencies.eventBus.clear();
    }
  }

  public async executeTask<TPayload, TResult>(
    task: RuntimeTask<TPayload>
  ): Promise<TaskExecutionResult<TResult>> {
    assertRuntimeStarted(this.started);

    const agent = this.dependencies.agentManager.getOrCreate(task.agentId);
    const context: RuntimeContext = {
      runtimeId: this.runtimeId,
      taskId: task.taskId,
      agent,
      memory: this.dependencies.memoryStore,
      modelProvider: this.dependencies.modelProvider,
      state: this.dependencies.stateStore,
      now: new Date().toISOString()
    };

    this.dependencies.eventBus.emit({
      name: "runtime.task.received",
      payload: {
        runtimeId: this.runtimeId,
        taskId: task.taskId,
        agentId: task.agentId
      }
    });

    this.dependencies.logger.info("Executing runtime task.", {
      runtimeId: this.runtimeId,
      taskId: task.taskId,
      toolName: task.toolName
    });

    this.inFlightTasks.add(task.taskId);
    try {
      const result = await this.dependencies.taskRunner.run<TPayload, TResult>(
        task,
        context
      );

      this.dependencies.eventBus.emit({
        name: "runtime.task.completed",
        payload: {
          runtimeId: this.runtimeId,
          taskId: task.taskId,
          agentId: task.agentId,
          toolName: task.toolName
        }
      });

      return result;
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown runtime failure.";

      this.dependencies.logger.error("Runtime task failed.", {
        runtimeId: this.runtimeId,
        taskId: task.taskId,
        reason
      });
      this.dependencies.eventBus.emit({
        name: "runtime.task.failed",
        payload: {
          runtimeId: this.runtimeId,
          taskId: task.taskId,
          agentId: task.agentId,
          reason
        }
      });

      throw error;
    } finally {
      this.inFlightTasks.delete(task.taskId);
    }
  }

  public listTools(): ToolDefinition[] {
    return this.dependencies.toolRegistry.list();
  }

  public getDependencies() {
    return this.dependencies;
  }
}
