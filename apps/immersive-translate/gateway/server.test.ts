import { describe, expect, test } from "vitest";
import {
  buildYouTubeCaptionArgs,
  createGatewayHandler,
  LibreTranslateProvider,
  MlxLmProvider,
  pickYouTubeCaptionFile,
  preferredYouTubeSubtitleLanguages,
  type TranslationProvider,
} from "./server";

const MLX_MODEL = "mlx-community/Qwen3-1.7B-4bit";

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

function readMlxUserPrompt(init: RequestInit | undefined): string {
  const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
  if (typeof body !== "object" || body === null) return "";
  const messages = (body as { readonly messages?: unknown }).messages;
  if (!Array.isArray(messages)) return "";
  const userMessage = messages.find(
    (message: unknown): message is { readonly content: string; readonly role: string } =>
      typeof message === "object" &&
      message !== null &&
      (message as { readonly role?: unknown }).role === "user" &&
      typeof (message as { readonly content?: unknown }).content === "string",
  );
  return userMessage?.content ?? "";
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

  test("serves local YouTube caption fallback payloads", async () => {
    const provider: TranslationProvider = {
      name: "mlx",
      upstream: "mock",
      model: MLX_MODEL,
      translate: async () => [],
    };
    const handler = createGatewayHandler(provider, {
      youtubeCaptionFetcher: async (request) => ({
        videoId: request.videoId,
        languageCode: request.languageCode,
        label: "YouTube en captions",
        source: "yt-dlp",
        payload: '{"events":[]}',
      }),
    });

    const response = await handler(
      new Request("http://127.0.0.1:5000/youtube-captions?videoId=-30RvjXTxvc&languageCode=en"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await responseJson(response)).toEqual({
      videoId: "-30RvjXTxvc",
      languageCode: "en",
      label: "YouTube en captions",
      source: "yt-dlp",
      payload: '{"events":[]}',
    });
  });

  test("builds YouTube caption fallback args for extended auto-caption language codes", () => {
    const args = buildYouTubeCaptionArgs({
      request: { videoId: "SSIGI9mm0DU", languageCode: "ko" },
      outputTemplate: "/tmp/%(id)s.%(ext)s",
    });

    expect(args).toEqual(
      expect.arrayContaining([
        "--ignore-errors",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "ko-orig,ko,ko.*,en-orig,en,en.*,zh-Hans.*,zh.*",
      ]),
    );
    expect(preferredYouTubeSubtitleLanguages("en")).toBe("en-orig,en,en.*");
  });

  test("prefers matching YouTube caption files with generated language suffixes", () => {
    const files = [
      "SSIGI9mm0DU.zh-Hans-ko.json3",
      "SSIGI9mm0DU.ko-ko.json3",
      "SSIGI9mm0DU.ko-en-US-y-JJSUA13BM.json3",
      "SSIGI9mm0DU.en-zh-Hans-xmBv0MfmNEY.json3",
    ];

    expect(pickYouTubeCaptionFile(files, "ko")).toBe("SSIGI9mm0DU.ko-ko.json3");
    expect(pickYouTubeCaptionFile(files, "en")).toBe(
      "SSIGI9mm0DU.en-zh-Hans-xmBv0MfmNEY.json3",
    );
    expect(pickYouTubeCaptionFile(files, "ja")).toBe(
      "SSIGI9mm0DU.en-zh-Hans-xmBv0MfmNEY.json3",
    );
  });

  test("handles local gateway CORS preflight", async () => {
    const provider: TranslationProvider = {
      name: "mlx",
      upstream: "mock",
      model: MLX_MODEL,
      translate: async () => [],
    };

    const response = await createGatewayHandler(provider)(
      new Request("http://127.0.0.1:5000/youtube-captions", { method: "OPTIONS" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  test("sends MLX OpenAI-compatible chat completions with deterministic settings", async () => {
    const requests: unknown[] = [];
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
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
        model: MLX_MODEL,
        temperature: 0,
        max_tokens: 1024,
        stream: false,
      },
    });
    const body = (requests[0] as { readonly body: { readonly messages: unknown[] } }).body;
    expect(JSON.stringify(body.messages)).toContain("Return only a valid JSON array");
    expect(JSON.stringify(body.messages)).toContain("/no_think");
    expect(body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining('Input: ["Hello","World"]'),
        }),
      ]),
    );
  });

  test("rejects empty MLX output", async () => {
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
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

  test("strips Qwen thinking wrappers before parsing MLX JSON output", async () => {
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
      temperature: 0,
      maxTokens: 1024,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: `<think>\n\n</think>\n\n${JSON.stringify(["안녕"])}<|im_end|>`,
                },
              },
            ],
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

  test("allows known MLX chat end tokens after the JSON array", async () => {
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
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
      model: MLX_MODEL,
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
      model: MLX_MODEL,
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
      model: MLX_MODEL,
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
        const inputMatch = /Input: (\[[\s\S]*\])$/.exec(userMessage?.content ?? "");
        const texts = inputMatch ? (JSON.parse(inputMatch[1]) as readonly string[]) : [];
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

  test("retries auto Korean source when MLX returns Korean for an English target", async () => {
    const sources: string[] = [];
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
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
        const content = userMessage?.content ?? "";
        sources.push(content.includes("from Korean to English") ? "ko" : "auto");
        const translated = content.includes("from Korean to English")
          ? ["Korean source translated to English"]
          : ["한국어 원문입니다"];
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(translated) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({ q: ["한국어 원문입니다"], source: "auto", target: "en", format: "text" }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      translatedText: ["Korean source translated to English"],
    });
    expect(sources).toEqual(["auto", "ko"]);
  });

  test("uses strict English correction when source Korean still returns Korean", async () => {
    const prompts: string[] = [];
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
      temperature: 0,
      maxTokens: 1024,
      fetcher: async (_input, init) => {
        const prompt = readMlxUserPrompt(init);
        prompts.push(prompt);
        const translated = prompt.includes("Rewrite the Korean subtitle input into English only")
          ? ["Korean source translated to English"]
          : ["한국어 원문입니다"];
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(translated) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({ q: ["한국어 원문입니다"], source: "ko", target: "en", format: "text" }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      translatedText: ["Korean source translated to English"],
    });
    expect(prompts).toEqual([
      expect.stringContaining("Translate from Korean to English"),
      expect.stringContaining("Rewrite the Korean subtitle input into English only"),
    ]);
  });

  test("uses strict English correction when an English target still contains Korean script", async () => {
    const prompts: string[] = [];
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
      temperature: 0,
      maxTokens: 1024,
      fetcher: async (_input, init) => {
        const prompt = readMlxUserPrompt(init);
        prompts.push(prompt);
        const translated = prompt.includes("Rewrite the Korean subtitle input into English only")
          ? ["Seoul National University last week"]
          : ["Seoul 서울국대 last week"];
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
        q: ["지난주 서울국대"],
        source: "ko",
        target: "en",
        format: "text",
      }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      translatedText: ["Seoul National University last week"],
    });
    expect(prompts).toEqual([
      expect.stringContaining("Translate from Korean to English"),
      expect.stringContaining("Rewrite the Korean subtitle input into English only"),
    ]);
  });

  test("rejects strict English correction when MLX still returns Korean", async () => {
    const prompts: string[] = [];
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
      temperature: 0,
      maxTokens: 1024,
      fetcher: async (_input, init) => {
        prompts.push(readMlxUserPrompt(init));
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(["한국어 원문입니다"]) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({ q: ["한국어 원문입니다"], source: "ko", target: "en", format: "text" }),
    );

    expect(response.status).toBe(502);
    expect(await responseJson(response)).toEqual({
      error: "MLX kept Korean text for English output.",
      code: "invalid_response",
    });
    expect(prompts).toEqual([
      expect.stringContaining("Translate from Korean to English"),
      expect.stringContaining("Rewrite the Korean subtitle input into English only"),
    ]);
  });

  test("splits Korean to English MLX batches when the model copies Korean outputs", async () => {
    const batchSizes: number[] = [];
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
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
        const inputMatch = /Input: (\[[\s\S]*\])$/.exec(userMessage?.content ?? "");
        const texts = inputMatch ? (JSON.parse(inputMatch[1]) as readonly string[]) : [];
        batchSizes.push(texts.length);
        const translated =
          texts.length > 1 ? texts : texts.map((_text, index) => `English ${index + 1}`);
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
        q: ["첫 번째", "두 번째"],
        source: "ko",
        target: "en",
        format: "text",
      }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      translatedText: ["English 1", "English 1"],
    });
    expect(batchSizes).toEqual([2, 2, 1, 1]);
  });

  test("joins non-empty single-item MLX output length mismatches", async () => {
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
      temperature: 0,
      maxTokens: 1024,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(["안녕", "하세요"]) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    const response = await createGatewayHandler(provider)(
      jsonRequest({ q: ["Hello"], source: "en", target: "ko", format: "text" }),
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      translatedText: ["안녕 하세요"],
    });
  });

  test("rejects single-item MLX output length mismatches", async () => {
    const provider = new MlxLmProvider({
      baseUrl: "http://host.docker.internal:8000/v1",
      model: MLX_MODEL,
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
