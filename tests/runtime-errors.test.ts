import { describe, expect, it } from "vitest";
import { RuntimeError } from "../src/index.js";

describe("RuntimeError", () => {
  it("serializes its code, details, and stack", () => {
    const error = new RuntimeError("INVALID_TASK", "Task is invalid.", {
      taskId: "task-1",
      reason: "missing input"
    });

    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: "RuntimeError",
      code: "INVALID_TASK",
      message: "Task is invalid.",
      details: {
        taskId: "task-1",
        reason: "missing input"
      },
      stack: error.stack
    });
  });
});
