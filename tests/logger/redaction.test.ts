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
  it("redacts default sensitive keys across all log levels", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.info("info test", {
      userId: "u1",
      apiKey: "sk-live-123",
      password: "pass",
      token: "tok-abc",
      nested: { secret: "hidden-val", safe: "ok" }
    });
    logger.warn("warn test", {
      authorization: "Bearer secret-token",
      normal: 1
    });
    logger.debug("debug test", { secretKey: "key-123", mode: "verbose" });
    logger.error("error test", { api_key: "api-secret", detail: "err" });

    expect(logger.entries).toHaveLength(4);

    expect(logger.entries[0]!.metadata).toEqual({
      userId: "u1",
      apiKey: "[REDACTED]",
      password: "[REDACTED]",
      token: "[REDACTED]",
      nested: {
        secret: "[REDACTED]",
        safe: "ok"
      }
    });

    expect(logger.entries[1]!.metadata).toEqual({
      authorization: "[REDACTED]",
      normal: 1
    });

    expect(logger.entries[2]!.metadata).toEqual({
      secretKey: "[REDACTED]",
      mode: "verbose"
    });

    expect(logger.entries[3]!.metadata).toEqual({
      api_key: "[REDACTED]",
      detail: "err"
    });
  });

  it("accepts custom redactKeys option in InMemoryRuntimeLogger", () => {
    const logger = new InMemoryRuntimeLogger({ redactKeys: /credit_card/i });

    logger.info("custom redaction", {
      credit_card: "1234-5678-9012-3456",
      apiKey: "visible-key"
    });

    expect(logger.entries[0]!.metadata).toEqual({
      credit_card: "[REDACTED]",
      apiKey: "visible-key"
    });
  });

  it("preserves undefined metadata when none is provided", () => {
    const logger = new InMemoryRuntimeLogger();
    logger.info("no metadata");
    expect(logger.entries[0]!.metadata).toBeUndefined();
  });
});
