import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConsoleRuntimeLogger,
  InMemoryRuntimeLogger
} from "../../src/logger/runtime-logger.js";

describe("ConsoleRuntimeLogger level filtering", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs all levels when level=info (default)", () => {
    const logger = new ConsoleRuntimeLogger();
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("filters info and warn when level=error", () => {
    const logger = new ConsoleRuntimeLogger({ level: "error" });
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("filters info but allows warn and error when level=warn", () => {
    const logger = new ConsoleRuntimeLogger({ level: "warn" });
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("matches in-memory filtering at the same configured threshold", () => {
    const consoleLogger = new ConsoleRuntimeLogger({ level: "warn" });
    const memoryLogger = new InMemoryRuntimeLogger({ level: "warn" });

    consoleLogger.debug("debug");
    consoleLogger.info("info");
    consoleLogger.warn("warn");
    consoleLogger.error("error");
    memoryLogger.debug("debug");
    memoryLogger.info("info");
    memoryLogger.warn("warn");
    memoryLogger.error("error");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(memoryLogger.entries.map((entry) => entry.level)).toEqual([
      "warn",
      "error"
    ]);
  });
});
