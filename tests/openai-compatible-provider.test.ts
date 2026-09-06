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

  it("passes AbortSignal timeout when timeoutMs is configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Timed response" } }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const provider = new OpenAICompatibleModelProvider({
      apiKey: "test-key",
      timeoutMs: 5000
    });

    await provider.generate({
      instructions: "Instructions",
      input: "Input"
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(calledInit.signal).toBeDefined();
    expect(calledInit.signal).toBeInstanceOf(AbortSignal);
  });

  it("resolves with empty outputText when choices array is empty or missing content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "gpt-4o-mini",
          choices: []
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const provider = new OpenAICompatibleModelProvider({
      apiKey: "test-key"
    });

    const response1 = await provider.generate({
      instructions: "test",
      input: "test"
    });
    expect(response1.outputText).toBe("");
    expect(response1.metadata.model).toBe("gpt-4o-mini");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "gpt-4o-mini",
          choices: [{ message: {} }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const response2 = await provider.generate({
      instructions: "test",
      input: "test"
    });
    expect(response2.outputText).toBe("");
    expect(response2.metadata.model).toBe("gpt-4o-mini");
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

  it("handles malformed non-JSON response body with descriptive error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html>Bad Gateway</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" }
      })
    );

    const provider = new OpenAICompatibleModelProvider({
      apiKey: "valid-key"
    });

    await expect(
      provider.generate({ instructions: "test", input: "test" })
    ).rejects.toThrowError();
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

  it.each([null, [], {}, { choices: null }, { choices: {} }, { choices: [] }])(
    "rejects a successful HTTP response without a non-empty choices array: %j",
    async (payload) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(payload), { status: 200 })
      );
      const provider = new OpenAICompatibleModelProvider({
        apiKey: "test-key"
      });

      await expect(
        provider.generate({ instructions: "test", input: "test" })
      ).rejects.toThrowError(
        "malformed response (HTTP 200): expected a non-empty choices array."
      );
    }
  );

  it.each([
    null,
    {},
    { message: null },
    { message: {} },
    { message: { content: null }, finish_reason: "tool_calls" },
    { message: { content: 123 } }
  ])("rejects a choice without string message content: %j", async (choice) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [choice] }), { status: 200 })
    );
    const provider = new OpenAICompatibleModelProvider({ apiKey: "test-key" });

    await expect(
      provider.generate({ instructions: "test", input: "test" })
    ).rejects.toThrowError(
      "malformed response (HTTP 200): expected choices[0].message.content to be a string."
    );
  });

  it("preserves an explicitly empty string and completion metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "" }, finish_reason: "stop" }],
          usage: { total_tokens: 1 }
        }),
        { status: 200 }
      )
    );
    const provider = new OpenAICompatibleModelProvider({ apiKey: "test-key" });

    await expect(
      provider.generate({ instructions: "test", input: "test" })
    ).resolves.toEqual({
      outputText: "",
      metadata: {
        model: "gpt-4o-mini",
        finishReason: "stop",
        usage: { total_tokens: 1 }
      }
    });
  });

  it("wraps malformed JSON with HTTP context and a bounded body excerpt", async () => {
    const body =
      "<html>upstream error</html>\n" + "x".repeat(300) + "AFTER_LIMIT";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(body, { status: 200 })
    );
    const provider = new OpenAICompatibleModelProvider({ apiKey: "test-key" });

    const failure = await provider
      .generate({ instructions: "test", input: "test" })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(
      `OpenAI-compatible provider returned invalid JSON (HTTP 200): ${JSON.stringify(body.slice(0, 200))}...`
    );
    expect((failure as Error).message).not.toContain("AFTER_LIMIT");
    expect((failure as Error).cause).toBeInstanceOf(SyntaxError);
  });

  it("preserves HTTP context when reading the successful response body fails", async () => {
    const bodyFailure = new Error("connection closed during response");
    const response = new Response("", { status: 200 });
    vi.spyOn(response, "text").mockRejectedValueOnce(bodyFailure);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);
    const provider = new OpenAICompatibleModelProvider({ apiKey: "test-key" });

    await expect(
      provider.generate({ instructions: "test", input: "test" })
    ).rejects.toMatchObject({
      message:
        "OpenAI-compatible provider could not read HTTP 200 response body.",
      cause: bodyFailure
    });
  });
});

it("rejects empty choices array with descriptive error", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ choices: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  );
  const provider = new OpenAICompatibleModelProvider({ apiKey: "sk-key" });
  await expect(
    provider.generate({ instructions: "test", input: "test" })
  ).rejects.toThrow("empty choices");
});

it("rejects choice without message content", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ choices: [{ message: {} }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  );
  const provider = new OpenAICompatibleModelProvider({ apiKey: "sk-key" });
  await expect(
    provider.generate({ instructions: "test", input: "test" })
  ).rejects.toThrow("without message content");
});

it("wraps non-JSON response in error with HTTP context", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response("not json at all", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    })
  );
  const provider = new OpenAICompatibleModelProvider({ apiKey: "sk-key" });
  await expect(
    provider.generate({ instructions: "test", input: "test" })
  ).rejects.toThrow();
});

it("rejects empty choices array with descriptive error", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ choices: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  );
  const provider = new OpenAICompatibleModelProvider({ apiKey: "sk-key" });
  await expect(
    provider.generate({ instructions: "test", input: "test" })
  ).rejects.toThrow("empty choices");
});

it("rejects choice without message content", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ choices: [{ message: {} }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  );
  const provider = new OpenAICompatibleModelProvider({ apiKey: "sk-key" });
  await expect(
    provider.generate({ instructions: "test", input: "test" })
  ).rejects.toThrow("without message content");
});

it("wraps non-JSON response in error with HTTP context", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response("not json at all", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    })
  );
  const provider = new OpenAICompatibleModelProvider({ apiKey: "sk-key" });
  await expect(
    provider.generate({ instructions: "test", input: "test" })
  ).rejects.toThrow();
});
