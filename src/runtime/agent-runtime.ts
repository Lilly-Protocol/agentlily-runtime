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

export interface RuntimeStoppedPayload {
  runtimeId: string;
  occurredAt: string;
  strandedTaskIds?: string[];
  drainDurationMs?: number;
}

export class AgentRuntime {
  private readonly dependencies: ReturnType<typeof createRuntimeDependencies>;
  private readonly runtimeId: string;
  private readonly inFlightTasks = new Set<string>();
  private readonly inFlightPromises = new Map<string, Promise<void>>();
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

    const drainStartMs = Date.now();
    let strandedTaskIds: string[] = [];

    if (options.drainTimeoutMs !== undefined && options.drainTimeoutMs > 0) {
      await this.awaitInFlightTasks(options.drainTimeoutMs);
    }

    // After draining, if there are still in-flight tasks, warn
    if (this.inFlightTasks.size > 0) {
      const stranded = Array.from(this.inFlightTasks);
      this.dependencies.logger.warn(
        `AgentRuntime.stop() timed out after ${options.drainTimeoutMs}ms with ${stranded.length} task(s) still in flight: ${stranded.join(", ")}`,
        {
          runtimeId: this.runtimeId,
          strandedTaskIds: stranded,
          drainTimeoutMs: options.drainTimeoutMs,
          elapsedMs: options.drainTimeoutMs
        }
      );
      this.dependencies.eventBus.emit({
        name: "runtime.stopped",
        payload: {
          runtimeId: this.runtimeId,
          occurredAt: new Date().toISOString(),
          strandedTaskIds: stranded,
          drainTimeoutMs: options.drainTimeoutMs
        }
      });
    }

    // Clear in-flight tracking — runtime is stopped, no new tasks can start.
    // Stranded tasks that are still running will clean themselves up via their
    // finally blocks when they eventually resolve/reject.
    this.inFlightTasks.clear();

    if (options.clearListeners === true) {
      const eventBus = this.dependencies.eventBus as RuntimeEventBus & {
        clear?: () => void;
      };
      eventBus.clear?.();
    }

    const drainDurationMs = Date.now() - drainStartMs;

    if (strandedTaskIds.length > 0) {
      this.dependencies.logger.warn(
        "Runtime stopped with stranded in-flight tasks.",
        {
          runtimeId: this.runtimeId,
          strandedTaskIds,
          drainDurationMs
        }
      );
    } else {
      this.dependencies.logger.info("Runtime stopped.", {
        runtimeId: this.runtimeId,
        drainDurationMs
      });
    }

    const stoppedPayload: RuntimeStoppedPayload = {
      runtimeId: this.runtimeId,
      occurredAt: new Date().toISOString(),
      drainDurationMs
    };
    if (strandedTaskIds.length > 0) {
      stoppedPayload.strandedTaskIds = strandedTaskIds;
    }

    this.dependencies.eventBus.emit({
      name: "runtime.stopped",
      payload: stoppedPayload
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

    const taskPromise = (async () => {
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
        this.dependencies.logger.error("Runtime task failed.", {
          runtimeId: this.runtimeId,
          taskId: task.taskId,
          toolName: task.toolName,
          error
        });
        this.dependencies.eventBus.emit({
          name: "runtime.task.error",
          payload: {
            runtimeId: this.runtimeId,
            taskId: task.taskId,
            agentId: task.agentId,
            toolName: task.toolName,
            error
          }
        });
        throw error;
      } finally {
        this.inFlightTasks.delete(task.taskId);
        this.inFlightPromises.delete(task.taskId);
      }
    })();

    this.inFlightPromises.set(task.taskId, taskPromise);
    return taskPromise;
  }

  private async awaitInFlightTasks(timeoutMs: number): Promise<void> {
    const promises = Array.from(this.inFlightPromises.values());
    if (promises.length === 0) {
      return;
    }

    const timeout = new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    });

    await Promise.race([Promise.all(promises), timeout]);
  }
}