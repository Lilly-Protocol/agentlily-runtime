import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ConsoleRuntimeLogger,
  InMemoryRuntimeLogger
} from "../../src/logger/runtime-logger.js";

describe("InMemoryRuntimeLogger", () => {
  it("records info entries with correct level and message", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.info("test message");
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]!.level).toBe("info");
    expect(logger.entries[0]!.message).toBe("test message");
  });

  it("records error entries with correct level and message", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.error("failure occurred");
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]!.level).toBe("error");
    expect(logger.entries[0]!.message).toBe("failure occurred");
  });

  it("preserves metadata when provided", () => {
    const logger = new InMemoryRuntimeLogger();
    const meta = { taskId: "t1", agentId: "a1" };
    logger.info("with meta", meta);
    expect(logger.entries[0]!.metadata).toEqual(meta);
  });

  it("stores undefined metadata when not provided", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.info("no meta");
    expect(logger.entries[0]!.metadata).toBeUndefined();
  });

  it("maintains insertion order across mixed calls", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.info("first");
    logger.error("second");
    logger.info("third");
    expect(logger.entries.map((e) => e.message)).toEqual([
      "first",
      "second",
      "third"
    ]);
    expect(logger.entries.map((e) => e.level)).toEqual([
      "info",
      "error",
      "info"
    ]);
  });

  describe("maxEntries eviction", () => {
    it("evicts oldest entry when info() exceeds maxEntries", () => {
      const logger = new InMemoryRuntimeLogger({ maxEntries: 2 });
      logger.info("a");
      logger.info("b");
      logger.info("c");
      expect(logger.entries).toHaveLength(2);
      expect(logger.entries.map((e) => e.message)).toEqual(["b", "c"]);
    });

    it("evicts oldest entry when error() exceeds maxEntries", () => {
      const logger = new InMemoryRuntimeLogger({ maxEntries: 2 });
      logger.error("x");
      logger.error("y");
      logger.error("z");
      expect(logger.entries).toHaveLength(2);
      expect(logger.entries.map((e) => e.message)).toEqual(["y", "z"]);
    });

    it("enforces maxEntries for warn() calls (#232)", () => {
      const logger = new InMemoryRuntimeLogger({ maxEntries: 2 });
      logger.warn("w1");
      logger.warn("w2");
      logger.warn("w3");
      expect(logger.entries.length).toBeLessThanOrEqual(2);
      expect(logger.entries.map((e) => e.message)).toEqual(["w2", "w3"]);
    });

    it("enforces maxEntries for debug() calls (#232)", () => {
      const logger = new InMemoryRuntimeLogger({ maxEntries: 2 });
      logger.debug("d1");
      logger.debug("d2");
      logger.debug("d3");
      expect(logger.entries.length).toBeLessThanOrEqual(2);
      expect(logger.entries.map((e) => e.message)).toEqual(["d2", "d3"]);
    });

    it("enforces maxEntries across mixed-level sequences (#232)", () => {
      const logger = new InMemoryRuntimeLogger({ maxEntries: 3 });
      logger.info("i1");
      logger.warn("w1");
      logger.debug("d1");
      logger.error("e1");
      expect(logger.entries).toHaveLength(3);
      expect(logger.entries.map((e) => `${e.level}:${e.message}`)).toEqual([
        "warn:w1",
        "debug:d1",
        "error:e1"
      ]);
    });

    it("preserves insertion order with eviction across all levels", () => {
      const logger = new InMemoryRuntimeLogger({ maxEntries: 4 });
      logger.debug("d1");
      logger.info("i1");
      logger.warn("w1");
      logger.error("e1");
      logger.debug("d2");
      expect(logger.entries).toHaveLength(4);
      expect(logger.entries.map((e) => `${e.level}:${e.message}`)).toEqual([
        "info:i1",
        "warn:w1",
        "error:e1",
        "debug:d2"
      ]);
    });
  });
});

describe("ConsoleRuntimeLogger", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("delegates info calls to console.info with metadata", () => {
    const logger = new ConsoleRuntimeLogger();
    const meta = { key: "value" };
    logger.info("console test", meta);
    expect(infoSpy).toHaveBeenCalledWith("console test", meta);
  });

  it("delegates error calls to console.error with empty object when no metadata", () => {
    const logger = new ConsoleRuntimeLogger();
    logger.error("error test");
    expect(errorSpy).toHaveBeenCalledWith("error test", {});
  });

  it("passes metadata through to console.error when provided", () => {
    const logger = new ConsoleRuntimeLogger();
    const meta = { reason: "timeout" };
    logger.error("error with meta", meta);
    expect(errorSpy).toHaveBeenCalledWith("error with meta", meta);
  });
});
