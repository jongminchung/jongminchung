type TranslationProfile = "libretranslate" | "mlx";
type TranslationFormat = "text" | "html";

export interface TranslationGatewayConfig {
  readonly profile: TranslationProfile;
  readonly host: string;
  readonly port: number;
  readonly libreTranslateUrl: string;
  readonly mlxBaseUrl: string;
  readonly mlxModel: string;
  readonly mlxTemperature: number;
  readonly mlxMaxTokens: number;
}

export interface TranslationProviderRequest {
  readonly texts: readonly string[];
  readonly source: string;
  readonly target: string;
  readonly format: TranslationFormat;
  readonly apiKey: string;
}

export interface TranslationProvider {
  readonly name: TranslationProfile;
  readonly upstream: string;
  readonly model: string | null;
  translate(request: TranslationProviderRequest): Promise<readonly string[]>;
}

interface IncomingTranslateRequest {
  readonly q: string | readonly string[];
  readonly source: string;
  readonly target: string;
  readonly format: TranslationFormat;
  readonly apiKey: string;
  readonly originalWasArray: boolean;
}

interface OpenAiChatMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

const DEFAULT_LIBRETRANSLATE_URL = "http://libretranslate:5000/translate";
const DEFAULT_MLX_BASE_URL = "http://host.docker.internal:8000/v1";
const DEFAULT_MLX_MODEL = "mlx-community/Qwen3-4B-Instruct-2507-4bit";
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 5000;

class GatewayError extends Error {
  readonly status: number;
  readonly code: string;

  private constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string): GatewayError {
    return new GatewayError(400, "invalid_request", message);
  }

  static upstream(status: number, message: string): GatewayError {
    return new GatewayError(status, "upstream_error", message);
  }

  static invalidResponse(message: string): GatewayError {
    return new GatewayError(502, "invalid_response", message);
  }
}

function readEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProfile(value: string): TranslationProfile {
  const normalized = value.trim().toLowerCase();
  if (normalized === "mlx") return "mlx";
  return "libretranslate";
}

export function readGatewayConfig(): TranslationGatewayConfig {
  return {
    profile: normalizeProfile(readEnv("TRANSLATION_PROFILE", "libretranslate")),
    host: readEnv("GATEWAY_HOST", DEFAULT_HOST),
    port: readNumberEnv("GATEWAY_PORT", DEFAULT_PORT),
    libreTranslateUrl: readEnv("LIBRETRANSLATE_URL", DEFAULT_LIBRETRANSLATE_URL),
    mlxBaseUrl: readEnv("MLX_BASE_URL", DEFAULT_MLX_BASE_URL),
    mlxModel: readEnv("MLX_MODEL", DEFAULT_MLX_MODEL),
    mlxTemperature: readNumberEnv("MLX_TEMPERATURE", 0),
    mlxMaxTokens: Math.max(1, Math.round(readNumberEnv("MLX_MAX_TOKENS", 1024))),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeFormat(value: unknown): TranslationFormat {
  return value === "html" ? "html" : "text";
}

function normalizeTextInput(value: unknown): {
  readonly texts: readonly string[];
  readonly originalWasArray: boolean;
} {
  if (typeof value === "string") {
    return { texts: [value], originalWasArray: false };
  }
  if (!Array.isArray(value)) throw GatewayError.badRequest("Request q must be a string or array.");
  const texts = value.map((item) => {
    if (typeof item !== "string") throw GatewayError.badRequest("Every q item must be a string.");
    return item;
  });
  return { texts, originalWasArray: true };
}

function parseTranslateRequest(value: unknown): IncomingTranslateRequest {
  if (!isRecord(value)) throw GatewayError.badRequest("Request body must be a JSON object.");
  const { texts, originalWasArray } = normalizeTextInput(value.q);
  const source =
    typeof value.source === "string" && value.source.trim() ? value.source.trim() : "auto";
  const target =
    typeof value.target === "string" && value.target.trim() ? value.target.trim() : "ko";
  const apiKey = typeof value.api_key === "string" ? value.api_key.trim() : "";
  return {
    q: originalWasArray ? texts : (texts[0] ?? ""),
    source,
    target,
    format: normalizeFormat(value.format),
    apiKey,
    originalWasArray,
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw GatewayError.badRequest("Request body must be valid JSON.");
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text.trim()) return response.statusText || "Upstream request failed.";
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) return text.trim();
    const error = parsed.error;
    if (typeof error === "string" && error.trim()) return error.trim();
    if (isRecord(error) && typeof error.message === "string" && error.message.trim()) {
      return error.message.trim();
    }
    const message = parsed.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  } catch {
    return text.trim();
  }
  return text.trim();
}

function normalizeTranslations(parsed: unknown, expectedCount: number): readonly string[] {
  if (!isRecord(parsed)) throw GatewayError.invalidResponse("Upstream response was not an object.");
  const translatedText = parsed.translatedText;
  if (typeof translatedText === "string") {
    if (expectedCount === 1) return [translatedText];
    throw GatewayError.invalidResponse("Upstream returned a single translation for a batch.");
  }
  if (Array.isArray(translatedText)) {
    if (translatedText.length !== expectedCount) {
      throw GatewayError.invalidResponse("Upstream translation count did not match input count.");
    }
    return translatedText.map((item) => {
      if (typeof item !== "string") {
        throw GatewayError.invalidResponse("Upstream translatedText items must be strings.");
      }
      return item;
    });
  }
  const translation = parsed.translation;
  if (typeof translation === "string" && expectedCount === 1) return [translation];
  const translations = parsed.translations;
  if (!Array.isArray(translations) || translations.length !== expectedCount) {
    throw GatewayError.invalidResponse("Upstream response did not include translatedText.");
  }
  return translations.map((item) => {
    if (typeof item === "string") return item;
    if (isRecord(item) && typeof item.translatedText === "string") return item.translatedText;
    throw GatewayError.invalidResponse("Upstream translations items must be strings.");
  });
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(value), {
    ...init,
    headers,
  });
}

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function translationPrompt(request: TranslationProviderRequest): readonly OpenAiChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a deterministic translation engine.",
        "Return only a valid JSON array of strings.",
        "The output array length must exactly match the input texts length.",
        "Do not include markdown, commentary, numbering, or explanations.",
        "Preserve code, API names, URLs, package names, and HTML tags.",
        "For subtitles, make Korean concise and natural.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        source: request.source,
        target: request.target,
        format: request.format,
        texts: request.texts,
      }),
    },
  ];
}

function parseOpenAiContent(parsed: unknown): string {
  if (!isRecord(parsed) || !Array.isArray(parsed.choices)) {
    throw GatewayError.invalidResponse("MLX response did not include choices.");
  }
  const firstChoice: unknown = parsed.choices[0];
  if (!isRecord(firstChoice)) {
    throw GatewayError.invalidResponse("MLX response did not include choices.");
  }
  const message = firstChoice.message;
  if (!isRecord(message)) {
    throw GatewayError.invalidResponse("MLX response did not include message content.");
  }
  const content = message.content;
  if (typeof content !== "string" || !content.trim()) {
    throw GatewayError.invalidResponse("MLX response did not include message content.");
  }
  return content.trim();
}

function stripMarkdownFence(value: string): string {
  const trimmed = value.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
}

function stripKnownModelSuffixes(value: string): string {
  return value.replace(/\s*(?:<\|im_end\|>|<\|endoftext\|>|<\/s>)\s*$/g, "").trim();
}

function stripMatchingQuotes(value: string): string {
  const trimmed = value.trim();
  const quotePairs = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["「", "」"],
  ] as const;
  for (const [start, end] of quotePairs) {
    if (trimmed.startsWith(start) && trimmed.endsWith(end) && trimmed.length >= 2) {
      return trimmed.slice(start.length, -end.length).trim();
    }
  }
  return trimmed;
}

function parseMlxTranslations(content: string, expectedCount: number): readonly string[] {
  const cleaned = stripMarkdownFence(stripKnownModelSuffixes(content));
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    if (expectedCount === 1 && cleaned) return [stripMatchingQuotes(cleaned)];
    throw GatewayError.invalidResponse("MLX output was not valid JSON.");
  }
  if (typeof parsed === "string" && expectedCount === 1) return [parsed];
  if (!Array.isArray(parsed))
    throw GatewayError.invalidResponse("MLX output must be a JSON array.");
  if (parsed.length !== expectedCount) {
    throw GatewayError.invalidResponse("MLX output count did not match input count.");
  }
  return parsed.map((item) => {
    if (typeof item !== "string") {
      throw GatewayError.invalidResponse("MLX output items must be strings.");
    }
    return item;
  });
}

export class LibreTranslateProvider implements TranslationProvider {
  readonly name = "libretranslate" as const;
  readonly model = null;
  readonly upstream: string;
  private readonly fetcher: typeof fetch;

  constructor(upstream: string, fetcher: typeof fetch = fetch) {
    this.upstream = upstream;
    this.fetcher = fetcher;
  }

  async translate(request: TranslationProviderRequest): Promise<readonly string[]> {
    const response = await this.fetcher(this.upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: request.texts,
        source: request.source,
        target: request.target,
        format: request.format,
        ...(request.apiKey ? { api_key: request.apiKey } : {}),
      }),
    });
    if (!response.ok) {
      throw GatewayError.upstream(response.status, await readErrorMessage(response));
    }
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw GatewayError.invalidResponse("LibreTranslate response was not valid JSON.");
    }
    return normalizeTranslations(parsed, request.texts.length);
  }
}

export class MlxLmProvider implements TranslationProvider {
  readonly name = "mlx" as const;
  readonly upstream: string;
  readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly fetcher: typeof fetch;

  constructor(input: {
    readonly baseUrl: string;
    readonly model: string;
    readonly temperature: number;
    readonly maxTokens: number;
    readonly fetcher?: typeof fetch;
  }) {
    this.upstream = input.baseUrl.replace(/\/+$/, "");
    this.model = input.model;
    this.temperature = input.temperature;
    this.maxTokens = input.maxTokens;
    this.fetcher = input.fetcher ?? fetch;
  }

  async translate(request: TranslationProviderRequest): Promise<readonly string[]> {
    return await this.translateWithFallback(request);
  }

  private async translateWithFallback(
    request: TranslationProviderRequest,
  ): Promise<readonly string[]> {
    try {
      return await this.translateBatch(request);
    } catch (error) {
      if (!(error instanceof GatewayError) || error.code !== "invalid_response") throw error;
      if (request.texts.length <= 1) throw error;
      const middleIndex = Math.ceil(request.texts.length / 2);
      const first = await this.translateWithFallback({
        ...request,
        texts: request.texts.slice(0, middleIndex),
      });
      const second = await this.translateWithFallback({
        ...request,
        texts: request.texts.slice(middleIndex),
      });
      return [...first, ...second];
    }
  }

  private async translateBatch(request: TranslationProviderRequest): Promise<readonly string[]> {
    const response = await this.fetcher(chatCompletionsUrl(this.upstream), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: translationPrompt(request),
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        stream: false,
      }),
    });
    if (!response.ok) {
      throw GatewayError.upstream(response.status, await readErrorMessage(response));
    }
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw GatewayError.invalidResponse("MLX response was not valid JSON.");
    }
    return parseMlxTranslations(parseOpenAiContent(parsed), request.texts.length);
  }
}

export function createProvider(
  config: TranslationGatewayConfig,
  fetcher: typeof fetch = fetch,
): TranslationProvider {
  if (config.profile === "mlx") {
    return new MlxLmProvider({
      baseUrl: config.mlxBaseUrl,
      model: config.mlxModel,
      temperature: config.mlxTemperature,
      maxTokens: config.mlxMaxTokens,
      fetcher,
    });
  }
  return new LibreTranslateProvider(config.libreTranslateUrl, fetcher);
}

async function handleTranslate(request: Request, provider: TranslationProvider): Promise<Response> {
  if (request.method !== "POST") throw GatewayError.badRequest("Use POST for /translate.");
  const parsedRequest = parseTranslateRequest(await readJson(request));
  const texts = Array.isArray(parsedRequest.q) ? parsedRequest.q : [parsedRequest.q];
  const translations = await provider.translate({
    texts,
    source: parsedRequest.source,
    target: parsedRequest.target,
    format: parsedRequest.format,
    apiKey: parsedRequest.apiKey,
  });
  return jsonResponse({
    translatedText: parsedRequest.originalWasArray ? translations : (translations[0] ?? ""),
  });
}

function handleHealth(provider: TranslationProvider): Response {
  return jsonResponse({
    ok: true,
    profile: provider.name,
    upstream: provider.upstream,
    ...(provider.model ? { model: provider.model } : {}),
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof GatewayError) {
    return jsonResponse({ error: error.message, code: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Gateway request failed.";
  return jsonResponse({ error: message, code: "gateway_error" }, { status: 500 });
}

export function createGatewayHandler(
  provider: TranslationProvider,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health") return handleHealth(provider);
      if (url.pathname === "/translate") return await handleTranslate(request, provider);
      return jsonResponse({ error: "Not found", code: "not_found" }, { status: 404 });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function startGateway(config: TranslationGatewayConfig = readGatewayConfig()): void {
  const provider = createProvider(config);
  const handler = createGatewayHandler(provider);
  Bun.serve({
    hostname: config.host,
    port: config.port,
    fetch: handler,
  });
  console.log(
    `translation-gateway listening on ${config.host}:${config.port} profile=${provider.name}`,
  );
}

if (typeof Bun !== "undefined" && import.meta.main) {
  startGateway();
}
