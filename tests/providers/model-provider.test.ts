import { describe, expect, it } from "vitest";
import {
  type ModelProvider,
  UnconfiguredModelProvider
} from "../../src/providers/model-provider.js";

const placeholderResponse = {
  outputText:
    "No model provider is configured. Contributors can implement one behind the ModelProvider interface."
};

describe("UnconfiguredModelProvider", () => {
  it("identifies itself as unconfigured", () => {
    const provider = new UnconfiguredModelProvider();

    expect(provider.name).toBe("unconfigured");
  });

  it("returns the stable placeholder response", async () => {
    const provider: ModelProvider = new UnconfiguredModelProvider();

    await expect(
      provider.generate({ instructions: "Be helpful", input: "Hello" })
    ).resolves.toEqual(placeholderResponse);
  });

  it("ignores prompt arguments", async () => {
    const provider: ModelProvider = new UnconfiguredModelProvider();

    const firstResponse = await provider.generate({
      instructions: "Summarize the input",
      input: "First prompt"
    });
    const secondResponse = await provider.generate({
      instructions: "Translate the input",
      input: "Completely different prompt"
    });

    expect(firstResponse).toEqual(placeholderResponse);
    expect(secondResponse).toEqual(firstResponse);
  });
});
