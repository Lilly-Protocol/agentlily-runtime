import type {
  ModelPrompt,
  ModelProvider,
  ModelResponse
} from "./model-provider.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface OpenAICompatibleProviderOptions {
  apiKey: string;
  baseUrl?: string | undefined;
  model?: string | undefined;
  timeoutMs?: number | undefined;
  headers?: Record<string, string> | undefined;
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
      throw new Error(
        `OpenAI-compatible provider could not read HTTP ${response.status} response body.`,
        { cause: error }
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText) as unknown;
    } catch (error) {
      const excerpt = JSON.stringify(responseText.slice(0, 200));
      throw new Error(
        `OpenAI-compatible provider returned invalid JSON (HTTP ${response.status}): ${excerpt}${responseText.length > 200 ? "..." : ""}`,
        { cause: error }
      );
    }

    if (
      !isRecord(data) ||
      !Array.isArray(data.choices) ||
      data.choices.length === 0
    ) {
      throw new Error(
        `OpenAI-compatible provider returned malformed response (HTTP ${response.status}): expected a non-empty choices array.`
      );
    }

    const choice: unknown = data.choices[0];
    if (
      !isRecord(choice) ||
      !isRecord(choice.message) ||
      typeof choice.message.content !== "string"
    ) {
      throw new Error(
        `OpenAI-compatible provider returned malformed response (HTTP ${response.status}): expected choices[0].message.content to be a string.`
      );
    }

    // Explicit empty strings are valid text responses. Missing/null content,
    // including tool-call-only completions, cannot satisfy this text-only API.
    const outputText = choice.message.content;
    const metadata: Record<string, unknown> = {
      model: data.model ?? this.model
    };

    if (choice.finish_reason !== undefined) {
      metadata.finishReason = choice.finish_reason;
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

function formatBodyExcerpt(body: string): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length === 0) {
    return "<empty body>";
  }

  const maxLength = 500;
  return compact.length > maxLength
    ? `${compact.slice(0, maxLength)}...`
    : compact;
}
