import { describe, it, expect } from 'vitest';
import { ConsoleRuntimeLogger, InMemoryRuntimeLogger } from '../../src/logger/runtime-logger.js';

describe('RuntimeLogger warn and debug levels', () => {
  it('InMemoryRuntimeLogger records warn entries', () => {
    const logger = new InMemoryRuntimeLogger();
    logger.warn('test warning', { key: 'value' });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0].level).toBe('warn');
    expect(logger.entries[0].message).toBe('test warning');
    expect(logger.entries[0].metadata).toEqual({ key: 'value' });
  });

  it('InMemoryRuntimeLogger records debug entries', () => {
    const logger = new InMemoryRuntimeLogger();
    logger.debug('test debug', { trace: true });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0].level).toBe('debug');
    expect(logger.entries[0].message).toBe('test debug');
    expect(logger.entries[0].metadata).toEqual({ trace: true });
  });

  it('ConsoleRuntimeLogger has warn and debug methods', () => {
    const logger = new ConsoleRuntimeLogger();
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    // Should not throw
    logger.warn('console warn test');
    logger.debug('console debug test');
  });

  it('existing info and error levels still work', () => {
    const logger = new InMemoryRuntimeLogger();
    logger.info('info msg');
    logger.error('error msg');

    expect(logger.entries).toHaveLength(2);
    expect(logger.entries[0].level).toBe('info');
    expect(logger.entries[1].level).toBe('error');
  });
});
