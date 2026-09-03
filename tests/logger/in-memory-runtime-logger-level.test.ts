import { describe, it, expect } from "vitest";
import { InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("InMemoryRuntimeLogger level filtering (#266)", () => {
  it("records all levels by default (minimumLevel = debug)", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(logger.entries).toHaveLength(4);
    expect(logger.size()).toBe(4);
    expect(logger.entries.map((e) => e.level)).toEqual([
      "debug",
      "info",
      "warn",
      "error"
    ]);
  });

  it("filters entries below configured level (level = warn)", () => {
    const logger = new InMemoryRuntimeLogger({ level: "warn" });
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(logger.entries).toHaveLength(2);
    expect(logger.size()).toBe(2);
    expect(logger.entries.map((e) => e.level)).toEqual(["warn", "error"]);
    expect(logger.entries.map((e) => e.message)).toEqual([
      "warn message",
      "error message"
    ]);
  });

  it("filters entries below configured level (level = error)", () => {
    const logger = new InMemoryRuntimeLogger({ level: "error" });
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(logger.entries).toHaveLength(1);
    expect(logger.size()).toBe(1);
    expect(logger.entries[0]?.level).toBe("error");
    expect(logger.entries[0]?.message).toBe("error message");
  });

  it("filters entries below configured level (level = info)", () => {
    const logger = new InMemoryRuntimeLogger({ level: "info" });
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(logger.entries).toHaveLength(3);
    expect(logger.size()).toBe(3);
    expect(logger.entries.map((e) => e.level)).toEqual(["info", "warn", "error"]);
  });

  it("size() reflects only retained entries after filtering and maxEntries", () => {
    const logger = new InMemoryRuntimeLogger({ level: "warn", maxEntries: 2 });
    logger.debug("ignore 1");
    logger.info("ignore 2");
    logger.warn("warn 1");
    logger.warn("warn 2");
    logger.error("error 1");

    expect(logger.size()).toBe(2);
    expect(logger.entries.map((e) => e.message)).toEqual(["warn 2", "error 1"]);
  });
});
