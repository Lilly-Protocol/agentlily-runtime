import { RuntimeError } from "../errors/runtime-errors.js";
import type { RuntimeEventBus } from "../events/runtime-events.js";
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
  private readonly dependencies: ReturnType<typeof createRuntimeDependencies>;
  private readonly runtimeId: string;
  private readonly inFlightTasks = new Set<string>();
  private readonly inFlightPromises = new Set<Promise<unknown>>();
  private started = false;
  private stopped = false;

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

  public listTools(): ToolDefinition[] {
    return this.dependencies.toolRegistry.list();
  }

  public getDependencies() {
    return this.dependencies;
  }

  public async start(): Promise<void> {
    if (this.started) {
      throw new RuntimeError(
        "RUNTIME_ALREADY_STARTED",
        "AgentRuntime has already been started."
      );
    }
    if (this.stopped) {
      throw new RuntimeError(
        "RUNTIME_ALREADY_STOPPED",
        "AgentRuntime has already been stopped and cannot be restarted."
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
    if (!this.started || this.stopped) {
      return;
    }

    this.stopped = true;
    this.started = false;

    if (options.drainTimeoutMs !== undefined && options.drainTimeoutMs > 0) {
      await this.drainInFlightTasks(options.drainTimeoutMs);
      if (this.inFlightTasks.size > 0) {
        this.dependencies.logger.warn("Tasks still in flight after drain timeout.", {
          runtimeId: this.runtimeId,
          inFlightTaskCount: this.inFlightTasks.size,
          inFlightTasks: Array.from(this.inFlightTasks)
        });
      }
    }

    if (options.clearListeners === true) {
      const eventBus = this.dependencies.eventBus as RuntimeEventBus & {
        clear?: () => void;
      };
      eventBus.clear?.();
    }

    this.dependencies.logger.info("Runtime stopped.", {
      runtimeId: this.runtimeId
    });
    this.dependencies.eventBus.emit({
      name: "runtime.stopped",
      payload: {
        runtimeId: this.runtimeId,
        occurredAt: new Date().toISOString()
      }
    });
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
    let resolveTaskPromise!: () => void;
    const taskPromise = new Promise<void>((resolve) => {
      resolveTaskPromise = resolve;
    });
    this.inFlightPromises.add(taskPromise);
    try {
      const result = await this.dependencies.taskRunner.run<TPayload, TResult>(
        task,
        context
      );

      this.dependencies.logger.info("Runtime task completed.", {
        runtimeId: this.runtimeId,
        taskId: task.taskId,
        toolName: task.toolName,
        durationMs: result.durationMs
      });

      this.dependencies.eventBus.emit({
        name: "runtime.task.completed",
        payload: {
          runtimeId: this.runtimeId,
          taskId: task.taskId,
          agentId: task.agentId,
          toolName: task.toolName,
          durationMs: result.durationMs
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
      this.inFlightPromises.delete(taskPromise);
      resolveTaskPromise();
    }
  }

  private async drainInFlightTasks(timeoutMs: number): Promise<void> {
    if (this.inFlightPromises.size === 0) {
      return;
    }

    const allInFlight = Promise.allSettled(Array.from(this.inFlightPromises));
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutTimer = setTimeout(resolve, timeoutMs);
    });

    try {
      await Promise.race([allInFlight, timeoutPromise]);
    } finally {
      if (timeoutTimer !== undefined) {
        clearTimeout(timeoutTimer);
      }
    }
  }
}
