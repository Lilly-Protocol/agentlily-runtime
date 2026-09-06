import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsoleRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("Issue #231: ConsoleRuntimeLogger warn() deduplication and level filtering", () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("has exactly one warn method on ConsoleRuntimeLogger prototype (no duplicate properties)", () => {
    const descriptors = Object.getOwnPropertyDescriptor(
      ConsoleRuntimeLogger.prototype,
      "warn"
    );
    expect(descriptors).toBeDefined();
    expect(typeof descriptors?.value).toBe("function");
  });

  it("suppresses warn() completely when minimumLevel is 'error'", () => {
    const logger = new ConsoleRuntimeLogger({ level: "error" });
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warning message");
    logger.error("error message");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("error message", {});
  });

  it("suppresses info() and debug() but prints warn() and error() when minimumLevel is 'warn'", () => {
    const logger = new ConsoleRuntimeLogger({ level: "warn" });
    logger.debug("suppressed debug");
    logger.info("suppressed info");
    logger.warn("allowed warning");
    logger.error("allowed error");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("allowed warning", {});
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("allowed error", {});
  });

  it("suppresses debug() but prints info(), warn(), and error() under default level ('info')", () => {
    const logger = new ConsoleRuntimeLogger();
    logger.debug("debug-default");
    logger.info("info-default");
    logger.warn("warn-default");
    logger.error("error-default");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("prints all levels when minimumLevel is 'debug'", () => {
    const logger = new ConsoleRuntimeLogger({ level: "debug" });
    logger.debug("debug-all");
    logger.info("info-all");
    logger.warn("warn-all");
    logger.error("error-all");

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("redacts sensitive keys in warn() metadata matching info() and error() behavior", () => {
    const logger = new ConsoleRuntimeLogger({ level: "warn" });
    logger.warn("security alert", {
      token: "secret_tok_123",
      password: "pass",
      apiKey: "sk-live-xyz",
      safeKey: "safe_val"
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, meta] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(meta.token).toBe("[REDACTED]");
    expect(meta.password).toBe("[REDACTED]");
    expect(meta.apiKey).toBe("[REDACTED]");
    expect(meta.safeKey).toBe("safe_val");
  });
});
