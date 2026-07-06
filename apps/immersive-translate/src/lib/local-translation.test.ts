import { describe, expect, test } from "vitest";
import {
  DEFAULT_LOCAL_TRANSLATION_SETTINGS,
  LocalTranslationRepository,
  LocalTranslationService,
  normalizeLocalTranslationSettings,
  resolveTranslationLanguagePair,
  type TranslationInput,
} from "./local-translation";

class MemoryStorageArea {
  readonly values: Record<string, unknown> = {};

  async get(key: string): Promise<Record<string, unknown>> {
    return { [key]: this.values[key] };
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, items);
  }
}

describe("local translation setup", () => {
  test("defaults to the Docker LibreTranslate provider for the floating toggle flow", () => {
    expect(DEFAULT_LOCAL_TRANSLATION_SETTINGS).toMatchObject({
      enabled: true,
      endpoint: "http://127.0.0.1:5000/translate",
      sourceLanguage: "auto",
      targetLanguage: "ko-en",
    });
  });

  test("normalizes configurable settings without needing workspace data", () => {
    const settings = normalizeLocalTranslationSettings({
      enabled: true,
      endpoint: "  http://127.0.0.1:5000/translate  ",
      apiKey: "  local-secret  ",
      sourceLanguage: "  en  ",
      targetLanguage: "  ko  ",
      batchSize: 999,
      cacheEnabled: false,
      cacheTtlMinutes: 0,
      clearCacheOnDisable: true,
    });

    expect(settings).toEqual({
      ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
      enabled: true,
      endpoint: "http://127.0.0.1:5000/translate",
      apiKey: "local-secret",
      sourceLanguage: "en",
      targetLanguage: "ko",
      batchSize: 50,
      cacheEnabled: false,
      cacheTtlMinutes: 5,
      clearCacheOnDisable: true,
    });
  });

  test("normalizes invalid persisted settings while preserving editable blank endpoint", () => {
    const settings = normalizeLocalTranslationSettings({
      enabled: "yes",
      endpoint: "",
      apiKey: 12,
      sourceLanguage: "",
      targetLanguage: "   ",
      batchSize: -2,
      cacheEnabled: "no",
      cacheTtlMinutes: Number.POSITIVE_INFINITY,
      clearCacheOnDisable: "yes",
    });

    expect(settings).toEqual({
      ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
      endpoint: "",
    });
  });

  test("reports blank endpoint before self-test sends data", async () => {
    let calls = 0;
    const result = await LocalTranslationService.selfTest(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "",
      },
      async () => {
        calls += 1;
        return new Response("{}");
      },
    );

    expect(result).toEqual({ ok: false, message: "Enter a local translation endpoint URL." });
    expect(calls).toBe(0);
  });

  test("persists under a local-only key separate from workspace snapshots", async () => {
    const storage = new MemoryStorageArea();
    const repository = LocalTranslationRepository.ofStorage(storage);

    await repository.save({
      ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
      enabled: true,
      endpoint: "http://127.0.0.1:5000/translate",
      apiKey: "local-secret",
      targetLanguage: "ja",
    });

    expect(storage.values.TS_localTranslation).toMatchObject({
      enabled: true,
      endpoint: "http://127.0.0.1:5000/translate",
      apiKey: "local-secret",
      targetLanguage: "ja",
    });
    expect(storage.values.TS_workspace).toBe(undefined);

    const rawWorkspace = JSON.stringify({ settings: {} });
    expect(rawWorkspace.includes("local-secret")).toBe(false);
    expect(rawWorkspace.includes("localTranslation")).toBe(false);
  });

  test("validates setup before self-test sends data to the endpoint", async () => {
    const result = await LocalTranslationService.selfTest({
      ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
      enabled: true,
      endpoint: "ftp://127.0.0.1:5000/translate",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Use an http:// or https:// endpoint URL.");
  });

  test("self-test posts sample text and reports a successful local response", async () => {
    const requests: unknown[] = [];
    const result = await LocalTranslationService.selfTest(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
        apiKey: "local-secret",
        sourceLanguage: "en",
        targetLanguage: "ko",
        batchSize: 3,
      },
      async (input: string, init: RequestInit) => {
        requests.push({ input, init });
        return new Response(JSON.stringify({ translatedText: "안녕하세요" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    expect(result).toEqual({ ok: true, message: "Local translation endpoint is ready." });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({
      input: "http://127.0.0.1:5000/translate",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: "Hello",
          source: "en",
          target: "ko",
          format: "text",
          api_key: "local-secret",
        }),
      },
    });
  });

  test("self-test reports actionable endpoint failures", async () => {
    const result = await LocalTranslationService.selfTest(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
      },
      async () =>
        new Response(JSON.stringify({ error: "language pack missing" }), {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "application/json" },
        }),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      "Endpoint returned 503: language pack missing. Check the local service is running and supports the selected languages.",
    );
  });

  test("self-test reports non-JSON endpoint responses clearly", async () => {
    const result = await LocalTranslationService.selfTest(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
      },
      async () =>
        new Response("not json", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
    );

    expect(result).toEqual({
      ok: false,
      message:
        "Endpoint responded, but the response was not JSON. Check the local service is LibreTranslate-compatible.",
    });
  });

  test("runs LibreTranslate batches and maps translated text to stable input IDs", async () => {
    const requests: Array<{ readonly input: string; readonly body: unknown }> = [];
    const inputs: TranslationInput[] = [
      { id: "text-1", text: "Hello" },
      { id: "text-2", text: "World" },
      { id: "text-3", text: "Again", format: "html" },
    ];

    const progress: unknown[] = [];
    const result = await LocalTranslationService.runJob(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
        apiKey: "local-secret",
        sourceLanguage: "en",
        targetLanguage: "ko",
        batchSize: 2,
        cacheEnabled: false,
      },
      inputs,
      {
        onProgress: (snapshot) => progress.push(snapshot),
        fetcher: async (input: string, init: RequestInit) => {
          const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
          requests.push({ input, body });
          if (requests.length === 1) {
            return new Response(JSON.stringify({ translatedText: ["안녕", "세계"] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ translatedText: ["다시"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );

    expect(progress).toEqual([
      {
        status: "running",
        translations: [],
        errors: [],
        progress: {
          total: 3,
          completed: 0,
          cacheHits: 0,
          cacheMisses: 0,
          failures: 0,
        },
      },
      {
        status: "running",
        translations: [
          { id: "text-1", text: "안녕" },
          { id: "text-2", text: "세계" },
        ],
        errors: [],
        progress: {
          total: 3,
          completed: 2,
          cacheHits: 0,
          cacheMisses: 3,
          failures: 0,
        },
      },
      {
        status: "succeeded",
        translations: [
          { id: "text-1", text: "안녕" },
          { id: "text-2", text: "세계" },
          { id: "text-3", text: "다시" },
        ],
        errors: [],
        progress: {
          total: 3,
          completed: 3,
          cacheHits: 0,
          cacheMisses: 3,
          failures: 0,
        },
      },
    ]);
    expect(requests).toEqual([
      {
        input: "http://127.0.0.1:5000/translate",
        body: {
          q: ["Hello", "World"],
          source: "en",
          target: "ko",
          format: "text",
          api_key: "local-secret",
        },
      },
      {
        input: "http://127.0.0.1:5000/translate",
        body: {
          q: ["Again"],
          source: "en",
          target: "ko",
          format: "html",
          api_key: "local-secret",
        },
      },
    ]);
    expect(result).toEqual({
      status: "succeeded",
      translations: [
        { id: "text-1", text: "안녕" },
        { id: "text-2", text: "세계" },
        { id: "text-3", text: "다시" },
      ],
      errors: [],
      progress: {
        total: 3,
        completed: 3,
        cacheHits: 0,
        cacheMisses: 3,
        failures: 0,
      },
    });
  });

  test("splits Korean and English inputs into opposite ko/en translation requests", async () => {
    const requests: Array<{ readonly body: unknown }> = [];

    const result = await LocalTranslationService.runJob(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
        targetLanguage: "ko-en",
        batchSize: 10,
        cacheEnabled: false,
      },
      [
        { id: "english", text: "Hello from captions" },
        { id: "korean", text: "안녕하세요 자막" },
      ],
      {
        fetcher: async (_input: string, init: RequestInit) => {
          const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
          requests.push({ body });
          if (requests.length === 1) {
            return new Response(JSON.stringify({ translatedText: ["캡션 안녕"] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ translatedText: ["Hello captions"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );

    expect(resolveTranslationLanguagePair(DEFAULT_LOCAL_TRANSLATION_SETTINGS, "한국어")).toEqual({
      sourceLanguage: "ko",
      targetLanguage: "en",
    });
    expect(requests).toEqual([
      {
        body: {
          q: ["Hello from captions"],
          source: "en",
          target: "ko",
          format: "text",
        },
      },
      {
        body: {
          q: ["안녕하세요 자막"],
          source: "ko",
          target: "en",
          format: "text",
        },
      },
    ]);
    expect(result).toMatchObject({
      status: "succeeded",
      translations: [
        { id: "english", text: "캡션 안녕" },
        { id: "korean", text: "Hello captions" },
      ],
    });
  });

  test("uses endpoint, source, target, and text for local translation cache keys", async () => {
    const storage = new MemoryStorageArea();
    const repository = LocalTranslationRepository.ofStorage(storage);
    const inputs: TranslationInput[] = [{ id: "text-1", text: "Hello" }];
    let calls = 0;

    const first = await LocalTranslationService.runJob(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
        sourceLanguage: "en",
        targetLanguage: "ko",
        cacheEnabled: true,
      },
      inputs,
      {
        repository,
        fetcher: async () => {
          calls += 1;
          return new Response(JSON.stringify({ translatedText: ["안녕"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );

    const second = await LocalTranslationService.runJob(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
        sourceLanguage: "en",
        targetLanguage: "ko",
        cacheEnabled: true,
      },
      inputs,
      {
        repository,
        fetcher: async () => {
          calls += 1;
          return new Response(JSON.stringify({ translatedText: ["다시"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );

    const third = await LocalTranslationService.runJob(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
        sourceLanguage: "en",
        targetLanguage: "ja",
        cacheEnabled: true,
      },
      inputs,
      {
        repository,
        fetcher: async () => {
          calls += 1;
          return new Response(JSON.stringify({ translatedText: ["こんにちは"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );

    expect(calls).toBe(2);
    expect(first.progress).toMatchObject({ cacheHits: 0, cacheMisses: 1 });
    expect(second).toMatchObject({
      status: "succeeded",
      translations: [{ id: "text-1", text: "안녕" }],
      progress: { cacheHits: 1, cacheMisses: 0 },
    });
    expect(third).toMatchObject({
      translations: [{ id: "text-1", text: "こんにちは" }],
      progress: { cacheHits: 0, cacheMisses: 1 },
    });
    expect(calls).toBe(2);

    const html = await LocalTranslationService.runJob(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
        sourceLanguage: "en",
        targetLanguage: "ko",
        cacheEnabled: true,
      },
      [{ id: "text-1", text: "Hello", format: "html" }],
      {
        repository,
        fetcher: async () => {
          calls += 1;
          return new Response(JSON.stringify({ translatedText: ["<p>안녕</p>"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );

    expect(html).toMatchObject({
      translations: [{ id: "text-1", text: "<p>안녕</p>" }],
      progress: { cacheHits: 0, cacheMisses: 1 },
    });
    expect(calls).toBe(3);
  });

  test("clears local translation cache through the public repository and service APIs", async () => {
    const storage = new MemoryStorageArea();
    const repository = LocalTranslationRepository.ofStorage(storage);
    const settings = {
      ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
      enabled: true,
      endpoint: "http://127.0.0.1:5000/translate",
      sourceLanguage: "en",
      targetLanguage: "ko",
      cacheEnabled: true,
    };
    let calls = 0;

    await LocalTranslationService.runJob(settings, [{ id: "text-1", text: "Hello" }], {
      repository,
      fetcher: async () => {
        calls += 1;
        return new Response(JSON.stringify({ translatedText: ["안녕"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    await repository.clearCache();

    const result = await LocalTranslationService.runJob(
      settings,
      [{ id: "text-1", text: "Hello" }],
      {
        repository,
        fetcher: async () => {
          calls += 1;
          return new Response(JSON.stringify({ translatedText: ["새 안녕"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );

    expect(calls).toBe(2);
    expect(result).toMatchObject({
      translations: [{ id: "text-1", text: "새 안녕" }],
      progress: { cacheHits: 0, cacheMisses: 1 },
    });

    await LocalTranslationService.clearCache(repository);
    expect(storage.values.TS_localTranslationCache).toEqual({ entries: {} });
  });

  test("normalizes LibreTranslate job failures and preserves partial progress", async () => {
    const result = await LocalTranslationService.runJob(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
        batchSize: 1,
        cacheEnabled: false,
      },
      [
        { id: "text-1", text: "Hello" },
        { id: "text-2", text: "World" },
      ],
      {
        fetcher: async () =>
          new Response(JSON.stringify({ error: "unsupported language" }), {
            status: 400,
            statusText: "Bad Request",
            headers: { "Content-Type": "application/json" },
          }),
      },
    );

    expect(result).toEqual({
      status: "failed",
      translations: [],
      errors: [
        {
          code: "unsupported_language",
          message: "unsupported language",
          inputIds: ["text-1"],
        },
        {
          code: "unsupported_language",
          message: "unsupported language",
          inputIds: ["text-2"],
        },
      ],
      progress: {
        total: 2,
        completed: 0,
        cacheHits: 0,
        cacheMisses: 2,
        failures: 2,
      },
    });
  });

  test("keeps successful translations ordered when later batches fail", async () => {
    let calls = 0;
    const progress: unknown[] = [];

    const result = await LocalTranslationService.runJob(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        endpoint: "http://127.0.0.1:5000/translate",
        batchSize: 1,
        cacheEnabled: false,
      },
      [
        { id: "text-1", text: "Hello" },
        { id: "text-2", text: "World" },
      ],
      {
        onProgress: (snapshot) => progress.push(snapshot),
        fetcher: async () => {
          calls += 1;
          if (calls === 1) {
            return new Response(JSON.stringify({ translatedText: ["안녕"] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "rate limited" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );

    expect(result).toEqual({
      status: "partial",
      translations: [{ id: "text-1", text: "안녕" }],
      errors: [{ code: "rate_limit", message: "rate limited", inputIds: ["text-2"] }],
      progress: {
        total: 2,
        completed: 1,
        cacheHits: 0,
        cacheMisses: 2,
        failures: 1,
      },
    });
    expect(progress.at(-1)).toEqual(result);
  });

  test("normalizes offline, invalid response, rate limit, credentials, invalid request, and cancellation errors", async () => {
    const settings = {
      ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
      enabled: true,
      endpoint: "http://127.0.0.1:5000/translate",
      cacheEnabled: false,
    };
    const input = [{ id: "text-1", text: "Hello" }];

    const offline = await LocalTranslationService.runJob(settings, input, {
      fetcher: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const invalidResponse = await LocalTranslationService.runJob(settings, input, {
      fetcher: async () => new Response(JSON.stringify({ translatedText: 1 }), { status: 200 }),
    });
    const rateLimit = await LocalTranslationService.runJob(settings, input, {
      fetcher: async () => new Response(JSON.stringify({ error: "slow down" }), { status: 429 }),
    });
    const missingCredentials = await LocalTranslationService.runJob(settings, input, {
      fetcher: async () => new Response(JSON.stringify({ error: "missing key" }), { status: 401 }),
    });
    const invalidRequest = await LocalTranslationService.runJob(settings, input, {
      fetcher: async () => new Response(JSON.stringify({ error: "bad q" }), { status: 422 }),
    });
    const controller = new AbortController();
    controller.abort();
    const cancelled = await LocalTranslationService.runJob(settings, input, {
      fetcher: async () =>
        new Response(JSON.stringify({ translatedText: ["안녕"] }), { status: 200 }),
      signal: controller.signal,
    });

    expect(offline.errors[0]?.code).toBe("offline_endpoint");
    expect(invalidResponse.errors[0]?.code).toBe("invalid_response");
    expect(rateLimit.errors[0]?.code).toBe("rate_limit");
    expect(missingCredentials.errors[0]?.code).toBe("missing_credentials");
    expect(invalidRequest.errors[0]?.code).toBe("invalid_request");
    expect(cancelled).toMatchObject({
      status: "cancelled",
      errors: [{ code: "cancelled", inputIds: ["text-1"] }],
      progress: { failures: 1 },
    });
  });
});
