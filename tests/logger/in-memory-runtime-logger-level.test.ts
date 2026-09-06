import { describe, it, expect } from "vitest";
import { InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("InMemoryRuntimeLogger level filtering", () => {
  it("records all levels by default when level is omitted", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(logger.size()).toBe(4);
    expect(logger.entries.map((entry) => entry.level)).toEqual([
      "debug",
      "info",
      "warn",
      "error"
    ]);
  });

  it("filters out debug and info when level=warn and reflects retained entries in size()", () => {
    const logger = new InMemoryRuntimeLogger({ level: "warn" });
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(logger.size()).toBe(2);
    expect(logger.entries.map((entry) => entry.level)).toEqual(["warn", "error"]);
    expect(logger.entries[0].message).toBe("warn message");
    expect(logger.entries[1].message).toBe("error message");
  });

  it("filters out debug, info, and warn when level=error", () => {
    const logger = new InMemoryRuntimeLogger({ level: "error" });
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(logger.size()).toBe(1);
    expect(logger.entries[0].level).toBe("error");
    expect(logger.entries[0].message).toBe("e");
  });

  it("retains all levels when level=debug", () => {
    const logger = new InMemoryRuntimeLogger({ level: "debug" });
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(logger.size()).toBe(4);
  });
});
