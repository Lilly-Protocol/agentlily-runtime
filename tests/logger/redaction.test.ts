import { describe, it, expect, vi } from "vitest";
import {
  ConsoleRuntimeLogger,
  InMemoryRuntimeLogger
} from "../../src/logger/runtime-logger.js";

describe("ConsoleRuntimeLogger redaction", () => {
  it("redacts default sensitive keys (secret, token, password, apiKey, authorization)", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger();

    logger.info("test", {
      userId: "u1",
      apiToken: "abc-123",
      password: "hunter2",
      apiKey: "sk-live-xxx",
      authorization: "Bearer xyz",
      secretKey: "my-secret",
      normalField: "visible"
    });

    const loggedMeta = infoSpy.mock.calls[0]![1] as Record<string, unknown>;
    expect(loggedMeta.userId).toBe("u1");
    expect(loggedMeta.normalField).toBe("visible");
    expect(loggedMeta.apiToken).toBe("[REDACTED]");
    expect(loggedMeta.password).toBe("[REDACTED]");
    expect(loggedMeta.apiKey).toBe("[REDACTED]");
    expect(loggedMeta.authorization).toBe("[REDACTED]");
    expect(loggedMeta.secretKey).toBe("[REDACTED]");

    infoSpy.mockRestore();
  });

  it("accepts custom redactKeys pattern", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger({ redactKeys: /^ssn$/i });

    logger.info("test", {
      ssn: "123-45-6789",
      name: "Alice",
      token: "visible-token"
    });

    const loggedMeta = infoSpy.mock.calls[0]![1] as Record<string, unknown>;
    expect(loggedMeta.ssn).toBe("[REDACTED]");
    expect(loggedMeta.name).toBe("Alice");
    expect(loggedMeta.token).toBe("visible-token");

    infoSpy.mockRestore();
  });

  it("redacts nested objects recursively", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger();

    logger.info("nested test", {
      user: {
        name: "Bob",
        credentials: {
          password: "secret",
          token: "tok-123"
        }
      },
      safe: "value"
    });

    const loggedMeta = infoSpy.mock.calls[0]![1] as Record<string, unknown>;
    expect(loggedMeta.user).toEqual({
      name: "Bob",
      credentials: {
        password: "[REDACTED]",
        token: "[REDACTED]"
      }
    });
    expect(loggedMeta.safe).toBe("value");

    infoSpy.mockRestore();
  });

  it("does not redact arrays", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger();

    logger.info("array test", { tags: ["a", "b"], secret: "hidden" });

    const loggedMeta = infoSpy.mock.calls[0]![1] as Record<string, unknown>;
    expect(loggedMeta.tags).toEqual(["a", "b"]);
    expect(loggedMeta.secret).toBe("[REDACTED]");

    infoSpy.mockRestore();
  });

  it("handles undefined metadata gracefully", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger();

    expect(() => logger.info("no meta")).not.toThrow();
    expect(infoSpy.mock.calls[0]![1]).toEqual({});

    infoSpy.mockRestore();
  });

  it("applies redaction to error() as well", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger();

    logger.error("fail", { apiKey: "leaked", detail: "oops" });

    const loggedMeta = errorSpy.mock.calls[0]![1] as Record<string, unknown>;
    expect(loggedMeta.apiKey).toBe("[REDACTED]");
    expect(loggedMeta.detail).toBe("oops");

    errorSpy.mockRestore();
  });
});

describe("InMemoryRuntimeLogger redaction", () => {
  it("redacts sensitive metadata for all log levels", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.debug("debug", { apiKey: "debug-secret", safe: "debug" });
    logger.info("info", { password: "info-secret", safe: "info" });
    logger.warn("warn", { token: "warn-secret", safe: "warn" });
    logger.error("error", { authorization: "error-secret", safe: "error" });

    expect(logger.entries).toEqual([
      {
        level: "debug",
        message: "debug",
        metadata: { apiKey: "[REDACTED]", safe: "debug" }
      },
      {
        level: "info",
        message: "info",
        metadata: { password: "[REDACTED]", safe: "info" }
      },
      {
        level: "warn",
        message: "warn",
        metadata: { token: "[REDACTED]", safe: "warn" }
      },
      {
        level: "error",
        message: "error",
        metadata: { authorization: "[REDACTED]", safe: "error" }
      }
    ]);
  });

  it("redacts nested metadata recursively", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.info("nested", {
      user: {
        credentials: { password: "secret", token: "token" },
        name: "Alice"
      },
      safe: "value"
    });

    expect(logger.entries[0]!.metadata).toEqual({
      user: {
        credentials: { password: "[REDACTED]", token: "[REDACTED]" },
        name: "Alice"
      },
      safe: "value"
    });
  });

  it("supports a custom redactKeys pattern", () => {
    const logger = new InMemoryRuntimeLogger({ redactKeys: /^ssn$/i });

    logger.info("custom", {
      ssn: "123-45-6789",
      token: "visible-token",
      name: "Alice"
    });

    expect(logger.entries[0]!.metadata).toEqual({
      ssn: "[REDACTED]",
      token: "visible-token",
      name: "Alice"
    });
  });
});
