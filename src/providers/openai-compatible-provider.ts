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

    const rawBody = await response.text().catch(() => "");

    if (!response.ok) {
      throw new Error(
        `OpenAI-compatible provider returned HTTP ${response.status}: ${rawBody}`
      );
    }

    let data: {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
        finish_reason?: string;
      }>;
      usage?: Record<string, unknown>;
      model?: string;
    };

    try {
      data = JSON.parse(rawBody);
    } catch {
      const bodyExcerpt = rawBody.length > 200 ? `${rawBody.slice(0, 200)}...` : rawBody;
      throw new Error(
        `OpenAI-compatible provider returned invalid JSON (HTTP ${response.status}): ${bodyExcerpt}`
      );
    }

    if (!data || typeof data !== "object") {
      throw new Error(
        `OpenAI-compatible provider returned malformed response object (HTTP ${response.status}).`
      );
    }

    if (!Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error(
        `OpenAI-compatible provider response missing non-empty "choices" array.`
      );
    }

    const firstChoice = data.choices[0];
    if (!firstChoice || typeof firstChoice !== "object") {
      throw new Error(
        `OpenAI-compatible provider response contains malformed choice entry.`
      );
    }

    const messageContent = firstChoice.message?.content;
    if (typeof messageContent !== "string") {
      throw new Error(
        `OpenAI-compatible provider choice missing string message content.`
      );
    }

    const outputText = messageContent;
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
