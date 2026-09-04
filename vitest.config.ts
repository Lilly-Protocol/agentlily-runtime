import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/types.ts",
        "src/runtime/context.ts",
        "src/tasks/task-types.ts"
      ],
      thresholds: {
        lines: 85,
        functions: 75,
        branches: 70,
        statements: 85
      }
    }
  }
});
