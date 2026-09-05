import { describe, it, expect } from "vitest";
import { InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("InMemoryRuntimeLogger with configurable level", () => {
  it("should filter out log calls below configured minimum level", () => {
    const logger = new InMemoryRuntimeLogger({ level: "warn" });

    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warn message");
    logger.error("Error message");

    expect(logger.size()).toBe(2);
    expect(logger.entries.map((e) => e.level)).toEqual(["warn", "error"]);
    expect(logger.entries.map((e) => e.message)).toEqual([
      "Warn message",
      "Error message"
    ]);
  });

  it("should record all levels by default when no level option is provided", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warn message");
    logger.error("Error message");

    expect(logger.size()).toBe(4);
  });
});
