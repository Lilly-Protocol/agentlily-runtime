import { describe, it, expect, vi } from 'vitest';
import { ActionExecutor } from '../../src/actions/action-executor.js';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import type { RuntimeContext } from '../../src/runtime/context.js';

describe('ActionExecutor tool invocation duration logging', () => {
  it('logs toolName and durationMs after tool execution', async () => {
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    const registry = new ToolRegistry();
    registry.register({
      name: 'slow-tool',
      description: 'A tool that takes some time',
      inputSchema: { type: 'object', properties: {} },
      execute: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { done: true };
      }),
    });

    const executor = new ActionExecutor(registry, logger as any);
    const context = {} as RuntimeContext;

    const result = await executor.execute('slow-tool', {}, context);

    expect(result).toEqual({ done: true });

    // Verify logger was called with toolName and durationMs
    const logCall = logger.info.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('Tool invocation completed')
    );
    expect(logCall).toBeDefined();
    expect(logCall![1]).toHaveProperty('toolName', 'slow-tool');
    expect(logCall![1]).toHaveProperty('durationMs');
    expect(logCall![1].durationMs).toBeGreaterThanOrEqual(20);
    expect(logCall![1].durationMs).toBeLessThan(500);
  });

  it('works without logger (optional dependency)', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'quick-tool',
      description: 'A fast tool',
      inputSchema: { type: 'object', properties: {} },
      execute: vi.fn(async () => ({ ok: true })),
    });

    // No logger passed - should not throw
    const executor = new ActionExecutor(registry);
    const context = {} as RuntimeContext;

    const result = await executor.execute('quick-tool', {}, context);
    expect(result).toEqual({ ok: true });
  });
});
