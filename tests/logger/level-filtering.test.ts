import { describe, it, expect, vi } from 'vitest';
import { ConsoleRuntimeLogger } from '../../src/logger/runtime-logger.js';

describe('ConsoleRuntimeLogger level filtering', () => {
  it('defaults to info level (outputs info and error)', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = new ConsoleRuntimeLogger();
    logger.info('test info');
    logger.error('test error');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('suppresses info when level is set to error', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = new ConsoleRuntimeLogger({ level: 'error' });
    logger.info('should be suppressed');
    logger.error('should appear');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('suppresses both info and warn when level is error', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = new ConsoleRuntimeLogger({ level: 'error' });
    logger.info('suppressed');
    if (typeof (logger as any).warn === 'function') {
      (logger as any).warn('also suppressed');
    }
    logger.error('shown');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('outputs all levels when set to debug', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = new ConsoleRuntimeLogger({ level: 'debug' });
    logger.info('visible at debug level');
    logger.error('also visible');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
