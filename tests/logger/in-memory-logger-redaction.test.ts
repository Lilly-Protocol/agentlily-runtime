import { describe, it, expect } from "vitest";
import { InMemoryRuntimeLogger } from "../../src/logger/runtime-logger.js";

describe("InMemoryRuntimeLogger secret redaction", () => {
  it("recursively redacts sensitive keys matching DEFAULT_REDACT_KEYS across all levels", () => {
    const logger = new InMemoryRuntimeLogger();

    const sensitiveData = {
      username: "alice",
      apiKey: "sk-secret-12345",
      password: "super-secret-password",
      token: "bearer-token-abc",
      nested: {
        secret: "top-secret-val",
        safeVal: 42
      }
    };

    logger.debug("debug message", sensitiveData);
    logger.info("info message", sensitiveData);
    logger.warn("warn message", sensitiveData);
    logger.error("error message", sensitiveData);

    expect(logger.entries.length).toBe(4);

    for (const entry of logger.entries) {
      expect(entry.metadata).toMatchObject({
        username: "alice",
        apiKey: "[REDACTED]",
        password: "[REDACTED]",
        token: "[REDACTED]",
        nested: {
          secret: "[REDACTED]",
          safeVal: 42
        }
      });
    }
  });

  it("honors custom redactKeys regex option", () => {
    const logger = new InMemoryRuntimeLogger({
      redactKeys: /(ssn|creditCard)/i
    });

    logger.info("payment info", {
      ssn: "123-45-6789",
      creditCard: "4111-2222-3333-4444",
      apiKey: "not-redacted-by-custom-filter"
    });

    expect(logger.entries[0]?.metadata).toEqual({
      ssn: "[REDACTED]",
      creditCard: "[REDACTED]",
      apiKey: "not-redacted-by-custom-filter"
    });
  });
});
