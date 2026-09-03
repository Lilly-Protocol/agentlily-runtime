import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenAICompatibleModelProvider,
  type ModelPrompt
} from "../src/index.js";

describe("OpenAICompatibleModelProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates configuration and throws on missing apiKey", () => {
    expect(
      () => new OpenAICompatibleModelProvider({ apiKey: "" })
    ).toThrowError("OpenAI-compatible provider requires a non-empty apiKey.");

    expect(
      () =>
        new OpenAICompatibleModelProvider({
          apiKey: "   "
        })
    ).toThrowError("OpenAI-compatible provider requires a non-empty apiKey.");
  });

  it("validates configuration and throws on invalid baseUrl", () => {
    expect(
      () =>
        new OpenAICompatibleModelProvider({
          apiKey: "valid-key",
          baseUrl: "not-a-valid-url"
        })
    ).toThrowError(
      'Invalid baseUrl provided to OpenAICompatibleModelProvider: "not-a-valid-url".'
    );
  });

  it("initializes with default options", () => {
    const provider = new OpenAICompatibleModelProvider({
      apiKey: "sk-test-key"
    });

    expect(provider.name).toBe("openai-compatible");
    expect(provider.getBaseUrl()).toBe("https://api.openai.com/v1");
    expect(provider.getModel()).toBe("gpt-4o-mini");
  });

  it("generates model response with mocked HTTP success", async () => {
    const mockResponsePayload = {
      id: "chatcmpl-test",
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Autonomous payment prepared successfully."
          },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 8,
        total_tokens: 23
      }
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const provider = new OpenAICompatibleModelProvider({
      apiKey: "sk-mock-key",
      model: "gpt-4o-mini"
    });

    const prompt: ModelPrompt = {
      instructions: "You are an autonomous Stellar agent.",
      input: "Prepare 10 XLM payment to recipient."
    };

    const response = await provider.generate(prompt);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer sk-mock-key"
        }),
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: prompt.instructions },
            { role: "user", content: prompt.input }
          ]
        })
      })
    );

    expect(response.outputText).toBe(
      "Autonomous payment prepared successfully."
    );
    expect(response.metadata).toEqual({
      model: "gpt-4o-mini",
      finishReason: "stop",
      usage: {
        prompt_tokens: 15,
        completion_tokens: 8,
        total_tokens: 23
      }
    });
  });

  it("supports custom baseUrl and custom headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "custom-llm",
          choices: [{ message: { content: "Custom response" } }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const provider = new OpenAICompatibleModelProvider({
      apiKey: "custom-token",
      baseUrl: "https://custom-llm.example.com/v1/",
      model: "custom-llm",
      headers: { "X-Custom-Header": "custom-val" }
    });

    const response = await provider.generate({
      instructions: "Instructions",
      input: "Input"
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://custom-llm.example.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Custom-Header": "custom-val",
          Authorization: "Bearer custom-token"
        })
      })
    );
    expect(response.outputText).toBe("Custom response");
  });

  it.each([
    ["missing choices", {}, "expected a non-empty choices array"],
    ["empty choices", { choices: [] }, "expected a non-empty choices array"],
    [
      "non-array choices",
      { choices: {} },
      "expected a non-empty choices array"
    ],
    [
      "missing message content",
      { choices: [{ message: {} }] },
      "expected first choice.message.content to be a string"
    ],
    [
      "invalid message content",
      { choices: [{ message: { content: 42 } }] },
      "expected first choice.message.content to be a string"
    ]
  ])(
    "rejects successful responses with %s",
    async (_description, payload, expectedError) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(payload), { status: 200 })
      );

      const provider = new OpenAICompatibleModelProvider({
        apiKey: "valid-key"
      });

      await expect(
        provider.generate({ instructions: "test", input: "test" })
      ).rejects.toThrowError(expectedError);
    }
  );

  it("rejects a successful non-JSON response with status and a bounded body excerpt", async () => {
    const body = "upstream gateway failure: " + "x".repeat(500);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(body, { status: 200, statusText: "OK" })
    );

    const provider = new OpenAICompatibleModelProvider({
      apiKey: "valid-key"
    });

    const error = await provider
      .generate({ instructions: "test", input: "test" })
      .catch((value: unknown) => value);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("HTTP 200");
    expect(message).toContain(`Body excerpt: ${body.slice(0, 200)}`);
    expect(message).not.toContain(body.slice(0, 201));
  });

  it("handles non-2xx HTTP responses with descriptive error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        statusText: "Unauthorized"
      })
    );

    const provider = new OpenAICompatibleModelProvider({
      apiKey: "invalid-key"
    });

    await expect(
      provider.generate({ instructions: "test", input: "test" })
    ).rejects.toThrowError(
      'OpenAI-compatible provider returned HTTP 401: {"error":"Invalid API key"}'
    );
  });

  it("handles network failure gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("ECONNREFUSED")
    );

    const provider = new OpenAICompatibleModelProvider({
      apiKey: "valid-key"
    });

    await expect(
      provider.generate({ instructions: "test", input: "test" })
    ).rejects.toThrowError(
      "OpenAI-compatible provider request failed: ECONNREFUSED"
    );
  });
});
