import { describe, it, expect, vi } from 'vitest';
import { UnconfiguredModelProvider } from '../../src/providers/model-provider.js';

describe('UnconfiguredModelProvider warning', () => {
  it('emits console.warn on generate()', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new UnconfiguredModelProvider();

    await provider.generate({ instructions: 'test', input: 'hello' });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('UnconfiguredModelProvider');
    expect(warnSpy.mock.calls[0][0]).toContain('no model provider is configured');

    warnSpy.mockRestore();
  });

  it('returns placeholder outputText with warning metadata', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new UnconfiguredModelProvider();

    const result = await provider.generate({ instructions: 'do something', input: 'data' });

    expect(result.outputText).toContain('No model provider is configured');
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.warning).toBe('unconfigured_provider');
    expect(result.metadata!.instructionsLength).toBe(12);
    expect(result.metadata!.inputLength).toBe(4);

    warnSpy.mockRestore();
  });

  it('handles empty prompt gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new UnconfiguredModelProvider();

    const result = await provider.generate({ instructions: '', input: '' });

    expect(result.metadata!.instructionsLength).toBe(0);
    expect(result.metadata!.inputLength).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});
