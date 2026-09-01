import { describe, it, expect } from "vitest";
import * as pkg from "../src/index.js";

describe("Public export surface of src/index.ts", () => {
  const expectedClasses = [
    "AgentRuntime",
    "AgentInstanceManager",
    "ActionExecutor",
    "RuntimeError",
    "RuntimeEventBus",
    "InMemoryRuntimeLogger",
    "InMemoryMemoryStore",
    "UnconfiguredModelProvider",
    "InMemoryRuntimeStateStore",
    "TaskRunner",
    "ToolRegistry",
  ];

  const expectedFunctions = ["createRuntimeDependencies"];

  it("exports all expected classes", () => {
    for (const name of expectedClasses) {
      expect(pkg).toHaveProperty(name);
      expect(typeof (pkg as any)[name]).toBe("function");
    }
  });

  it("exports all expected functions", () => {
    for (const name of expectedFunctions) {
      expect(pkg).toHaveProperty(name);
      expect(typeof (pkg as any)[name]).toBe("function");
    }
  });

  it("does not accidentally remove or rename public exports", () => {
    const allExpected = [...expectedClasses, ...expectedFunctions];
    const exportedKeys = Object.keys(pkg);
    for (const name of allExpected) {
      expect(exportedKeys).toContain(name);
    }
  });
});
