import { describe, it, expect } from "vitest";
import { InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("InMemoryRuntimeLogger redaction", () => {
  it("redacts default sensitive keys in metadata", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.info("test", {
      apiKey: "sk-live-xxx",
      password: "hunter2",
      token: "tok-123",
      nested: { secret: "my-secret" }
    });

    const meta = logger.entries[0]!.metadata as Record<string, unknown>;
    expect(meta.apiKey).toBe("[REDACTED]");
    expect(meta.password).toBe("[REDACTED]");
    expect(meta.token).toBe("[REDACTED]");
    expect((meta.nested as Record<string, unknown>).secret).toBe("[REDACTED]");
  });

  it("passes non-sensitive keys through unchanged", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.info("test", {
      userId: "u1",
      taskId: "t1",
      apiKey: "leaked"
    });

    const meta = logger.entries[0]!.metadata as Record<string, unknown>;
    expect(meta.userId).toBe("u1");
    expect(meta.taskId).toBe("t1");
    expect(meta.apiKey).toBe("[REDACTED]");
  });

  it("honors a custom redactKeys regex", () => {
    const logger = new InMemoryRuntimeLogger({ redactKeys: /^ssn$/i });

    logger.info("test", {
      ssn: "123-45-6789",
      name: "Alice",
      token: "visible-token"
    });

    const meta = logger.entries[0]!.metadata as Record<string, unknown>;
    expect(meta.ssn).toBe("[REDACTED]");
    expect(meta.name).toBe("Alice");
    expect(meta.token).toBe("visible-token");
  });

  it("applies redaction to all four log levels", () => {
    const logger = new InMemoryRuntimeLogger();
    const sensitive = { password: "secret123", safe: "visible" };

    logger.info("i", { ...sensitive });
    logger.warn("w", { ...sensitive });
    logger.debug("d", { ...sensitive });
    logger.error("e", { ...sensitive });

    for (const entry of logger.entries) {
      const meta = entry.metadata as Record<string, unknown>;
      expect(meta.password).toBe("[REDACTED]");
      expect(meta.safe).toBe("visible");
    }
  });

  it("handles undefined metadata gracefully", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.info("no meta");

    expect(logger.entries[0]!.metadata).toBeUndefined();
  });

  it("redacts nested objects recursively", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.info("nested", {
      user: {
        name: "Bob",
        credentials: {
          password: "secret",
          apiKey: "sk-xxx"
        }
      },
      safe: "value"
    });

    const meta = logger.entries[0]!.metadata as Record<string, unknown>;
    expect(meta.user).toEqual({
      name: "Bob",
      credentials: {
        password: "[REDACTED]",
        apiKey: "[REDACTED]"
      }
    });
    expect(meta.safe).toBe("value");
  });

  it("redacts authorization and secretKey via default pattern", () => {
    const logger = new InMemoryRuntimeLogger();

    logger.error("auth test", {
      authorization: "Bearer xyz",
      secretKey: "my-secret",
      normalField: "visible"
    });

    const meta = logger.entries[0]!.metadata as Record<string, unknown>;
    expect(meta.authorization).toBe("[REDACTED]");
    expect(meta.secretKey).toBe("[REDACTED]");
    expect(meta.normalField).toBe("visible");
  });
});
