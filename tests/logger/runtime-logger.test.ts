import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsoleRuntimeLogger, InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("InMemoryRuntimeLogger", () => {
  it("records info entries with correct level and message", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.info("test message");
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0].level).toBe("info");
    expect(logger.entries[0].message).toBe("test message");
  });

  it("records error entries with correct level and message", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.error("failure occurred");
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0].level).toBe("error");
    expect(logger.entries[0].message).toBe("failure occurred");
  });

  it("preserves metadata when provided", () => {
    const logger = new InMemoryRuntimeLogger();
    const meta = { taskId: "t1", agentId: "a1" };
    logger.info("with meta", meta);
    expect(logger.entries[0].metadata).toEqual(meta);
  });

  it("stores undefined metadata when not provided", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.info("no meta");
    expect(logger.entries[0].metadata).toBeUndefined();
  });

  it("maintains insertion order across mixed calls", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.info("first");
    logger.error("second");
    logger.info("third");
    expect(logger.entries.map(e => e.message)).toEqual(["first", "second", "third"]);
    expect(logger.entries.map(e => e.level)).toEqual(["info", "error", "info"]);
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
