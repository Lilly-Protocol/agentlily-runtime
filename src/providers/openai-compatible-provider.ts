import type {
  ModelPrompt,
  ModelProvider,
  ModelResponse
} from "./model-provider.js";

export interface OpenAICompatibleProviderOptions {
  apiKey: string;
  baseUrl?: string | undefined;
  model?: string | undefined;
  timeoutMs?: number | undefined;
  headers?: Record<string, string> | undefined;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBodyExcerpt(body: string): string {
  const excerpt = body.replace(/\s+/g, " ").trim().slice(0, 200);
  return excerpt.length > 0 ? excerpt : "<empty body>";
}

export class OpenAICompatibleModelProvider implements ModelProvider {
  public readonly name = "openai-compatible";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number | undefined;
  private readonly customHeaders: Record<string, string> | undefined;

  public constructor(options: OpenAICompatibleProviderOptions) {
    if (
      !options.apiKey ||
      typeof options.apiKey !== "string" ||
      options.apiKey.trim().length === 0
    ) {
      throw new Error(
        "OpenAI-compatible provider requires a non-empty apiKey."
      );
    }

    const rawBaseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    if (typeof rawBaseUrl !== "string" || rawBaseUrl.trim().length === 0) {
      throw new Error("OpenAI-compatible provider requires a valid baseUrl.");
    }

    try {
      new URL(rawBaseUrl);
    } catch {
      throw new Error(
        `Invalid baseUrl provided to OpenAICompatibleModelProvider: "${rawBaseUrl}".`
      );
    }

    this.apiKey = options.apiKey.trim();
    this.baseUrl = rawBaseUrl.trim().replace(/\/+$/, "");
    this.model = options.model?.trim() || "gpt-4o-mini";
    this.timeoutMs = options.timeoutMs;
    this.customHeaders = options.headers;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getModel(): string {
    return this.model;
  }

  public async generate(prompt: ModelPrompt): Promise<ModelResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const payload = {
      model: this.model,
      messages: [
        { role: "system", content: prompt.instructions },
        { role: "user", content: prompt.input }
      ]
    };

    let response: Response;
    const requestInit: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(this.customHeaders ?? {})
      },
      body: JSON.stringify(payload)
    };

    if (this.timeoutMs !== undefined) {
      requestInit.signal = AbortSignal.timeout(this.timeoutMs);
    }

    try {
      response = await fetch(url, requestInit);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI-compatible provider request failed: ${message}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `OpenAI-compatible provider returned HTTP ${response.status}: ${errorText}`
      );
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `OpenAI-compatible provider failed to read successful HTTP ${response.status} response: ${message}`
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `OpenAI-compatible provider returned invalid JSON for HTTP ${response.status}: ${message}. Body excerpt: ${getBodyExcerpt(responseText)}`
      );
    }

    if (!isJsonObject(data)) {
      throw new Error(
        `OpenAI-compatible provider returned an invalid response for HTTP ${response.status}: expected a JSON object.`
      );
    }

    const choicesValue = data.choices;
    if (!Array.isArray(choicesValue) || choicesValue.length === 0) {
      throw new Error(
        `OpenAI-compatible provider returned an invalid response for HTTP ${response.status}: expected a non-empty choices array.`
      );
    }

    const firstChoice = (choicesValue as unknown[])[0];
    if (!isJsonObject(firstChoice)) {
      throw new Error(
        `OpenAI-compatible provider returned an invalid response for HTTP ${response.status}: expected the first choice to be an object.`
      );
    }

    const message = firstChoice.message;
    if (!isJsonObject(message)) {
      throw new Error(
        `OpenAI-compatible provider returned an invalid response for HTTP ${response.status}: expected first choice.message to be an object.`
      );
    }

    const outputText = message.content;
    if (typeof outputText !== "string") {
      throw new Error(
        `OpenAI-compatible provider returned an invalid response for HTTP ${response.status}: expected first choice.message.content to be a string.`
      );
    }

    const metadata: Record<string, unknown> = {
      model: data.model ?? this.model
    };

    if (firstChoice.finish_reason !== undefined) {
      metadata.finishReason = firstChoice.finish_reason;
    }
    if (data.usage !== undefined) {
      metadata.usage = data.usage;
    }

    return {
      outputText,
      metadata
    };
  }
}
