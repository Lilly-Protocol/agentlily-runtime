import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsoleRuntimeLogger } from "../src/index.js";

describe("ConsoleRuntimeLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info and error messages by default", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const logger = new ConsoleRuntimeLogger();

    logger.info("runtime started");
    logger.error("runtime failed", { taskId: "task-1" });

    expect(info).toHaveBeenCalledWith("runtime started", {});
    expect(error).toHaveBeenCalledWith("runtime failed", {
      taskId: "task-1"
    });
  });

  it("suppresses info below a warn threshold", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const logger = new ConsoleRuntimeLogger({ level: "warn" });

    logger.info("verbose message");
    logger.error("important message");

    expect(info).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("important message", {});
  });

  it("allows only errors at the error threshold", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const logger = new ConsoleRuntimeLogger({ level: "error" });

    logger.info("verbose message");
    logger.error("error message");

    expect(info).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });
});
