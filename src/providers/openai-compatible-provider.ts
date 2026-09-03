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

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `OpenAI-compatible provider returned HTTP ${response.status}: ${errorText}`
      );
    }

    const responseBody = await response.text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(responseBody);
    } catch {
      throw new Error(
        `OpenAI-compatible provider returned invalid JSON for HTTP ${response.status}: ${formatBodyExcerpt(responseBody)}`
      );
    }

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error(
        `OpenAI-compatible provider returned a malformed response for HTTP ${response.status}: expected a JSON object. Body: ${formatBodyExcerpt(responseBody)}`
      );
    }

    const data = parsed as {
      choices?: unknown;
      usage?: Record<string, unknown>;
      model?: string;
    };

    if (!Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error(
        `OpenAI-compatible provider returned a malformed response for HTTP ${response.status}: expected choices to contain at least one entry. Body: ${formatBodyExcerpt(responseBody)}`
      );
    }

    const firstChoice = data.choices[0] as {
      message?: { content?: unknown };
      finish_reason?: string;
    } | null;
    const outputText = firstChoice?.message?.content;

    if (typeof outputText !== "string") {
      throw new Error(
        `OpenAI-compatible provider returned a malformed response for HTTP ${response.status}: expected choices[0].message.content to be a string. Body: ${formatBodyExcerpt(responseBody)}`
      );
    }

    const metadata: Record<string, unknown> = {
      model: data.model ?? this.model
    };

    if (firstChoice?.finish_reason !== undefined) {
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
