import { describe, it, expect } from "vitest";
import { UnconfiguredModelProvider } from "../../src/providers/model-provider.js";

describe("UnconfiguredModelProvider", () => {
  const provider = new UnconfiguredModelProvider();

  it("has name set to 'unconfigured'", () => {
    expect(provider.name).toBe("unconfigured");
  });

  it("returns stable outputText regardless of prompt input", async () => {
    const response = await provider.generate({
      instructions: "ignored-instructions",
      input: "ignored-input"
    });

    expect(response.outputText).toBe(
      "No model provider is configured. Contributors can implement one behind the ModelProvider interface."
    );
  });

  it("returns same response shape for empty prompt", async () => {
    const response = await provider.generate({ instructions: "", input: "" });

    expect(response).toHaveProperty("outputText");
    expect(typeof response.outputText).toBe("string");
    expect(response.outputText.length).toBeGreaterThan(0);
  });

  it("reports zero lengths when prompt fields are absent at runtime", async () => {
    const response = await provider.generate(
      {} as { instructions: string; input: string }
    );

    expect(response.metadata).toMatchObject({
      instructionsLength: 0,
      inputLength: 0
    });
  });

  it("ignores prompt arguments completely", async () => {
    const r1 = await provider.generate({ instructions: "a", input: "b" });
    const r2 = await provider.generate({
      instructions: "completely-different",
      input: "also-different"
    });

    expect(r1.outputText).toBe(r2.outputText);
  });
});
