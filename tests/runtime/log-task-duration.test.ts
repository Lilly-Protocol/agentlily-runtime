import { describe, it, expect, vi } from 'vitest';
import { AgentRuntime } from '../../src/runtime/agent-runtime.js';

describe('Task execution duration logging', () => {
  it('includes durationMs in completion log and event', async () => {
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    const events: any[] = [];
    const eventBus = {
      emit: vi.fn((e: any) => events.push(e)),
      on: vi.fn(),
      off: vi.fn(),
    };

    const runtime = new AgentRuntime({
      runtimeId: 'test-log-duration',
      logger: logger as any,
      eventBus: eventBus as any,
      tools: [],
      modelProvider: { generate: vi.fn() } as any,
    });

    runtime.registerTool({
      name: 'echo',
      description: 'Echo tool',
      inputSchema: { type: 'object', properties: {} },
      execute: vi.fn(async () => ({ echoed: true })),
    });

    await runtime.start();

    const result = await runtime.executeTask({
      taskId: 'task-log-1',
      agentId: 'agent-1',
      toolName: 'echo',
      input: 'test',
      payload: {},
    });

    // Verify result has durationMs (from #136)
    expect(result.durationMs).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Verify completion log includes durationMs
    const completionLog = logger.info.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('completed')
    );
    expect(completionLog).toBeDefined();
    expect(completionLog![1]).toHaveProperty('durationMs');
    expect(completionLog![1].durationMs).toBe(result.durationMs);

    // Verify completion event includes durationMs
    const completedEvent = events.find((e) => e.name === 'runtime.task.completed');
    expect(completedEvent).toBeDefined();
    expect(completedEvent.payload).toHaveProperty('durationMs');
    expect(completedEvent.payload.durationMs).toBe(result.durationMs);
  });
});
