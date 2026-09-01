import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsoleRuntimeLogger } from "../../src/logger/runtime-logger";

describe("ConsoleRuntimeLogger level filtering", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
});
