export interface ModelPrompt {
  instructions: string;
  input: string;
}

export interface ModelResponse {
  outputText: string;
  metadata?: Record<string, unknown>;
}

export interface ModelProvider {
  readonly name: string;
  generate(prompt: ModelPrompt): Promise<ModelResponse>;
}

export class UnconfiguredModelProvider implements ModelProvider {
  public readonly name = "unconfigured";

  public async generate(prompt: ModelPrompt): Promise<ModelResponse> {
    console.warn(
      "UnconfiguredModelProvider: no model provider is configured. " +
      "generate() was called but will return placeholder text. " +
      "Configure a real ModelProvider to enable AI-powered task execution."
    );

    return {
      outputText:
        "No model provider is configured. Contributors can implement one behind the ModelProvider interface.",
      metadata: {
        warning: "unconfigured_provider",
        instructionsLength: prompt.instructions?.length ?? 0,
        inputLength: prompt.input?.length ?? 0
      }
    };
  }
}
