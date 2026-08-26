import { describe, it, expect } from 'vitest';
import { RuntimeError } from '../../src/errors/runtime-errors.js';

describe('RuntimeError.toJSON', () => {
  it('serializes code and details via JSON.stringify', () => {
    const error = new RuntimeError('TOOL_NOT_FOUND', 'Tool missing', { toolName: 'foo' });
    const json = JSON.parse(JSON.stringify(error));

    expect(json.name).toBe('RuntimeError');
    expect(json.code).toBe('TOOL_NOT_FOUND');
    expect(json.message).toBe('Tool missing');
    expect(json.details).toEqual({ toolName: 'foo' });
    expect(json.stack).toBeDefined();
    expect(typeof json.stack).toBe('string');
  });

  it('includes stack trace in toJSON output', () => {
    const error = new RuntimeError('EXECUTION_FAILED', 'boom');
    const json = error.toJSON();

    expect(json.stack).toBeDefined();
    expect(typeof json.stack).toBe('string');
    expect(json.stack).toContain('RuntimeError');
  });

  it('handles undefined details gracefully', () => {
    const error = new RuntimeError('INVALID_TASK', 'bad task');
    const json = JSON.parse(JSON.stringify(error));

    expect(json.details).toBeUndefined();
    expect(json.code).toBe('INVALID_TASK');
    expect(json.message).toBe('bad task');
  });

  it('preserves all fields through round-trip serialization', () => {
    const original = new RuntimeError('RUNTIME_NOT_STARTED', 'not started', { runtimeId: 'r1' });
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.name).toBe(original.name);
    expect(deserialized.code).toBe(original.code);
    expect(deserialized.message).toBe(original.message);
    expect(deserialized.details).toEqual(original.details);
  });
});
