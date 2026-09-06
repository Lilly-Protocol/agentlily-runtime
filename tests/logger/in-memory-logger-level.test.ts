import { describe, it, expect } from "vitest";
import { InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("InMemoryRuntimeLogger level filtering", () => {
  it("records only warn and error when level is 'warn'", () => {
    const logger = new InMemoryRuntimeLogger({ level: "warn" });

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(logger.entries).toHaveLength(2);
    expect(logger.entries.map((e) => e.level)).toEqual(["warn", "error"]);
  });

  it("records only error when level is 'error'", () => {
    const logger = new InMemoryRuntimeLogger({ level: "error" });

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]!.level).toBe("error");
    expect(logger.entries[0]!.message).toBe("e");
  });

  it("records all levels when level is 'debug'", () => {
    const logger = new InMemoryRuntimeLogger({ level: "debug" });

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(logger.entries).toHaveLength(4);
    expect(logger.entries.map((e) => e.level)).toEqual([
      "debug",
      "info",
      "warn",
      "error"
    ]);
  });

  it("records all levels when no level option is provided (default)", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(logger.entries).toHaveLength(4);
    expect(logger.entries.map((e) => e.level)).toEqual([
      "debug",
      "info",
      "warn",
      "error"
    ]);
  });

  it("size() reflects only retained entries after filtering", () => {
    const logger = new InMemoryRuntimeLogger({ level: "warn" });

    logger.debug("ignored");
    logger.info("ignored");
    logger.warn("kept");
    logger.error("kept");

    expect(logger.size()).toBe(2);
  });

  it("records info, warn, and error when level is 'info'", () => {
    const logger = new InMemoryRuntimeLogger({ level: "info" });

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(logger.entries).toHaveLength(3);
    expect(logger.entries.map((e) => e.level)).toEqual([
      "info",
      "warn",
      "error"
    ]);
  });
});
