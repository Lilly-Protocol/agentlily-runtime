import { describe, it, expect, vi } from "vitest";
import { AgentRuntime } from "../../src/runtime/agent-runtime.js";
import {
  ConsoleRuntimeLogger,
  InMemoryRuntimeLogger,
  type RuntimeLogger
} from "../../src/logger/runtime-logger.js";
import { UnconfiguredModelProvider } from "../../src/providers/model-provider.js";

describe("UnconfiguredModelProvider logger routing", () => {
  it("routes placeholder warning through injected logger in AgentRuntime", async () => {
    const logger = new InMemoryRuntimeLogger();
    const runtime = new AgentRuntime({ logger });
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const prompt = { instructions: "test instructions", input: "test input" };
    const response = await runtime.getDependencies().modelProvider.generate(prompt);

    expect(response.outputText).toContain("No model provider is configured");
    expect(response.metadata?.warning).toBe("unconfigured_provider");

    // Must NOT write to raw console.warn
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    // Must record warn entry in the injected logger
    expect(logger.entries.length).toBe(1);
    expect(logger.entries[0]?.level).toBe("warn");
    expect(logger.entries[0]?.message).toContain(
      "UnconfiguredModelProvider: no model provider is configured"
    );

    consoleWarnSpy.mockRestore();
  });

  it("respects logger minimum level filtering via ConsoleRuntimeLogger (suppressed at error level)", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = new ConsoleRuntimeLogger({ level: "error" });
    const runtime = new AgentRuntime({ logger });

    await runtime.getDependencies().modelProvider.generate({ instructions: "a", input: "b" });

    // ConsoleRuntimeLogger with level="error" suppresses warn entries
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("respects custom logger level filtering", async () => {
    const warnMock = vi.fn();
    const customLogger: RuntimeLogger = {
      level: "error",
      info: vi.fn(),
      warn: (msg, meta) => {
        if (customLogger.level !== "error") {
          warnMock(msg, meta);
        }
      },
      debug: vi.fn(),
      error: vi.fn()
    };

    const runtime = new AgentRuntime({ logger: customLogger });
    await runtime.getDependencies().modelProvider.generate({ instructions: "a", input: "b" });

    expect(warnMock).not.toHaveBeenCalled();
  });

  it("falls back to console.warn when UnconfiguredModelProvider is constructed without a logger", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = new UnconfiguredModelProvider();

    await provider.generate({ instructions: "test", input: "hello" });

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0]![0]).toContain(
      "UnconfiguredModelProvider: no model provider is configured"
    );

    consoleWarnSpy.mockRestore();
  });
});
