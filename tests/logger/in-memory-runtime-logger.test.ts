import { describe, it, expect } from "vitest";
import { InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("InMemoryRuntimeLogger minimum level filtering", () => {
  it("filters entries below configured minimum level", () => {
    const logger = new InMemoryRuntimeLogger({ level: "warn" });

    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(logger.entries.length).toBe(2);
    expect(logger.size()).toBe(2);
    expect(logger.entries.map((e) => e.level)).toEqual(["warn", "error"]);
    expect(logger.entries[0]?.message).toBe("warn message");
    expect(logger.entries[1]?.message).toBe("error message");
  });

  it("retains all log levels by default when level option is omitted", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(logger.entries.length).toBe(4);
    expect(logger.size()).toBe(4);
    expect(logger.entries.map((e) => e.level)).toEqual([
      "debug",
      "info",
      "warn",
      "error"
    ]);
  });
});
