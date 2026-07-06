import { describe, expect, test } from "vitest";
import {
  createGatewayHandler,
  LibreTranslateProvider,
  MlxLmProvider,
  type TranslationProvider,
} from "./server";

function jsonRequest(body: unknown): Request {
  return new Request("http://127.0.0.1:5000/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function responseJson(response: Response): Promise<unknown> {
  return await response.json();
}

describe("translation gateway", () => {
  test("forwards LibreTranslate batches and preserves output order", async () => {
    const requests: unknown[] = [];
    const provider = new LibreTranslateProvider(
      "http://libretranslate:5000/translate",
      async (input, init) => {
        requests.push({
          input,
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        });
        return new Response(JSON.stringify({ translatedText: ["안녕", "세계"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    const handler = createGatewayHandler(provider);

    const response = await handler(
      jsonRequest({
        q: ["Hello", "World"],
        source: "en",
        target: "ko",
        format: "text",
        api_key: "secret",
      }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({ translatedText: ["안녕", "세계"] });
    expect(requests).toEqual([
      {
        input: "http://libretranslate:5000/translate",
        body: {
          q: ["Hello", "World"],
          source: "en",
          target: "ko",
          format: "text",
          api_key: "secret",
        },
      },
    ]);
  });

  test("returns a string translatedText when q is a string", async () => {
    const provider: TranslationProvider = {
      name: "libretranslate",
      upstream: "mock",
      model: null,
      translate: async () => ["안녕하세요"],
    };
    const response = await createGatewayHandler(provider)(
      jsonRequest({ q: "Hello", source: "en", target: "ko", format: "text" }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({ translatedText: "안녕하세요" });
  });

  test("sends MLX OpenAI-compatible chat completions with deterministic settings", async () => {
    const requests: unknown[] = [];
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: "mlx-community/Qwen3-4B-Instruct-2507-4bit",
      temperature: 0,
      maxTokens: 1024,
      fetcher: async (input, init) => {
        requests.push({
          input,
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        });
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(["안녕", "세계"]) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({
        q: ["Hello", "World"],
        source: "en",
        target: "ko",
        format: "text",
      }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({ translatedText: ["안녕", "세계"] });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      input: "http://host.docker.internal:8000/v1/chat/completions",
      body: {
        model: "mlx-community/Qwen3-4B-Instruct-2507-4bit",
        temperature: 0,
        max_tokens: 1024,
        stream: false,
      },
    });
    const body = (requests[0] as { readonly body: { readonly messages: unknown[] } }).body;
    expect(JSON.stringify(body.messages)).toContain("Return only a valid JSON array");
    expect(body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining('"texts":["Hello","World"]'),
        }),
      ]),
    );
  });

  test("rejects empty MLX output", async () => {
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: "mlx-community/Qwen3-4B-Instruct-2507-4bit",
      temperature: 0,
      maxTokens: 1024,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "   " } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({ q: ["Hello"], source: "en", target: "ko", format: "text" }),
    );

    expect(response.status).toBe(502);
    expect(await responseJson(response)).toEqual({
      error: "MLX response did not include message content.",
      code: "invalid_response",
    });
  });

  test("allows known MLX chat end tokens after the JSON array", async () => {
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: "mlx-community/Qwen3-4B-Instruct-2507-4bit",
      temperature: 0,
      maxTokens: 1024,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: `${JSON.stringify(["안녕"])}<|im_end|>` } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({ q: ["Hello"], source: "en", target: "ko", format: "text" }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      translatedText: ["안녕"],
    });
  });

  test("accepts single-item raw MLX text when the model ignores the JSON array contract", async () => {
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: "mlx-community/Qwen3-4B-Instruct-2507-4bit",
      temperature: 0,
      maxTokens: 1024,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "안녕하세요<|im_end|>" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({ q: ["Hello"], source: "en", target: "ko", format: "text" }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      translatedText: ["안녕하세요"],
    });
  });

  test("accepts single-item JSON string MLX output", async () => {
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: "mlx-community/Qwen3-4B-Instruct-2507-4bit",
      temperature: 0,
      maxTokens: 1024,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify("안녕하세요") } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({ q: ["Hello"], source: "en", target: "ko", format: "text" }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      translatedText: ["안녕하세요"],
    });
  });

  test("splits MLX batches on length mismatches and preserves output order", async () => {
    const batchSizes: number[] = [];
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: "mlx-community/Qwen3-4B-Instruct-2507-4bit",
      temperature: 0,
      maxTokens: 1024,
      fetcher: async (_input, init) => {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const userMessage = messages.find(
          (message: unknown): message is { readonly content: string; readonly role: string } =>
            typeof message === "object" &&
            message !== null &&
            (message as { readonly role?: unknown }).role === "user" &&
            typeof (message as { readonly content?: unknown }).content === "string",
        );
        const payload = JSON.parse(userMessage?.content ?? "{}") as {
          readonly texts?: readonly string[];
        };
        const texts = Array.isArray(payload.texts) ? payload.texts : [];
        batchSizes.push(texts.length);
        const translated = texts.length > 2 ? ["too few"] : texts.map((text) => `ko:${text}`);
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(translated) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({
        q: ["one", "two", "three", "four"],
        source: "en",
        target: "ko",
        format: "text",
      }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      translatedText: ["ko:one", "ko:two", "ko:three", "ko:four"],
    });
    expect(batchSizes).toEqual([4, 2, 2]);
  });

  test("rejects single-item MLX output length mismatches", async () => {
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: "mlx-community/Qwen3-4B-Instruct-2507-4bit",
      temperature: 0,
      maxTokens: 1024,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify([]) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({ q: ["Hello"], source: "en", target: "ko", format: "text" }),
    );

    expect(response.status).toBe(502);
    expect(await responseJson(response)).toEqual({
      error: "MLX output count did not match input count.",
      code: "invalid_response",
    });
  });
});
