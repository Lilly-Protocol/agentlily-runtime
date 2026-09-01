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
  durationMs: number;
}
