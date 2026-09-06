import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("ConsoleRuntimeLogger warn dedup + level filtering (Issue #231)", () => {
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

  it("exposes a single warn method on the prototype", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      ConsoleRuntimeLogger.prototype,
      "warn"
    );
    expect(descriptor).toBeDefined();
    expect(typeof descriptor?.value).toBe("function");
  });

  it("with level error, warn makes no console.warn call", () => {
    const logger = new ConsoleRuntimeLogger({ level: "error" });
    expect(logger.level).toBe("error");

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("e", {});
  });

  it("with level warn, info is suppressed while warn and error print", () => {
    const logger = new ConsoleRuntimeLogger({ level: "warn" });
    expect(logger.level).toBe("warn");

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("w", {});
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("e", {});
  });

  it("routes every level through the same shouldLog gate", () => {
    const logger = new ConsoleRuntimeLogger({ level: "info" });
    logger.debug("hidden");
    logger.info("shown-info");
    logger.warn("shown-warn");
    logger.error("shown-error");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
