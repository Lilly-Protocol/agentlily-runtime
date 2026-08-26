export interface RuntimeTask<TPayload = Record<string, unknown>> {
  taskId: string;
  agentId: string;
  toolName: string;
  input: string;
  payload: TPayload;
}

export interface TaskExecutionResult<TResult = unknown> {
  taskId: string;
  agentId: string;
  toolName: string;
  output: TResult;
  startedAt: string;
  completedAt: string;
  /** Duration of task execution in milliseconds. Always >= 0. */
  durationMs: number;
}
