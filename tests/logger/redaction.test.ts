import { describe, it, expect, vi } from 'vitest';
import { ConsoleRuntimeLogger } from '../../src/logger/runtime-logger.js';

describe('ConsoleRuntimeLogger redaction', () => {
  it('redacts default sensitive keys (secret, token, password, apiKey, authorization)', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger();

    logger.info('test', {
      userId: 'u1',
      apiToken: 'abc-123',
      password: 'hunter2',
      apiKey: 'sk-live-xxx',
      authorization: 'Bearer xyz',
      secretKey: 'my-secret',
      normalField: 'visible'
    });

    const loggedMeta = infoSpy.mock.calls[0][1];
    expect(loggedMeta.userId).toBe('u1');
    expect(loggedMeta.normalField).toBe('visible');
    expect(loggedMeta.apiToken).toBe('[REDACTED]');
    expect(loggedMeta.password).toBe('[REDACTED]');
    expect(loggedMeta.apiKey).toBe('[REDACTED]');
    expect(loggedMeta.authorization).toBe('[REDACTED]');
    expect(loggedMeta.secretKey).toBe('[REDACTED]');

    infoSpy.mockRestore();
  });

  it('accepts custom redactKeys pattern', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger({ redactKeys: /^ssn$/i });

    logger.info('test', { ssn: '123-45-6789', name: 'Alice', token: 'visible-token' });

    const loggedMeta = infoSpy.mock.calls[0][1];
    expect(loggedMeta.ssn).toBe('[REDACTED]');
    expect(loggedMeta.name).toBe('Alice');
    expect(loggedMeta.token).toBe('visible-token');

    infoSpy.mockRestore();
  });

  it('redacts nested objects recursively', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger();

    logger.info('nested test', {
      user: {
        name: 'Bob',
        credentials: {
          password: 'secret',
          token: 'tok-123'
        }
      },
      safe: 'value'
    });

    const loggedMeta = infoSpy.mock.calls[0][1];
    expect(loggedMeta.user.name).toBe('Bob');
    expect(loggedMeta.user.credentials.password).toBe('[REDACTED]');
    expect(loggedMeta.user.credentials.token).toBe('[REDACTED]');
    expect(loggedMeta.safe).toBe('value');

    infoSpy.mockRestore();
  });

  it('does not redact arrays', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger();

    logger.info('array test', { tags: ['a', 'b'], secret: 'hidden' });

    const loggedMeta = infoSpy.mock.calls[0][1];
    expect(loggedMeta.tags).toEqual(['a', 'b']);
    expect(loggedMeta.secret).toBe('[REDACTED]');

    infoSpy.mockRestore();
  });

  it('handles undefined metadata gracefully', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger();

    expect(() => logger.info('no meta')).not.toThrow();
    expect(infoSpy.mock.calls[0][1]).toEqual({});

    infoSpy.mockRestore();
  });

  it('applies redaction to error() as well', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger();

    logger.error('fail', { apiKey: 'leaked', detail: 'oops' });

    const loggedMeta = errorSpy.mock.calls[0][1];
    expect(loggedMeta.apiKey).toBe('[REDACTED]');
    expect(loggedMeta.detail).toBe('oops');

    errorSpy.mockRestore();
  });
});
