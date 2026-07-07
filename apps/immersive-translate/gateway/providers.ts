import { GatewayError } from "./errors";
import { normalizeTranslations } from "./http";
import type {
  TranslationGatewayConfig,
  TranslationProvider,
  TranslationProviderRequest,
} from "./types";
import { delay, isRecord, logGatewayEvent, previewText, readErrorMessage } from "./utils";

interface OpenAiChatMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

type MlxPromptMode = "default" | "force-english";

const MLX_HTTP_RETRY_COUNT = 2;
const MLX_HTTP_RETRY_DELAY_MS = 250;
const KOREAN_TEXT_PATTERN = /[\u3131-\u318e\uac00-\ud7a3]/;

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function languageLabel(code: string): string {
  const normalized = code.toLowerCase();
  if (normalized === "auto") return "the auto-detected source language";
  if (normalized.startsWith("en")) return "English";
  if (normalized.startsWith("ko")) return "Korean";
  if (normalized.startsWith("ja")) return "Japanese";
  if (normalized.startsWith("zh")) return "Chinese";
  if (normalized.startsWith("es")) return "Spanish";
  if (normalized.startsWith("fr")) return "French";
  if (normalized.startsWith("de")) return "German";
  return code;
}

function translationPrompt(
  request: TranslationProviderRequest,
  mode: MlxPromptMode = "default",
): readonly OpenAiChatMessage[] {
  const source = languageLabel(request.source);
  const target = languageLabel(request.target);
  const forceEnglish = mode === "force-english";
  return [
    {
      role: "system",
      content: [
        "/no_think",
        "You are a deterministic subtitle translation engine.",
        "Return only a valid JSON array of strings.",
        "The output array length must exactly match the input array length.",
        "Translate each input item independently.",
        "Do not combine, split, omit, reorder, or explain items.",
        "Copy only code, API identifiers, URLs, numbers, punctuation, or proper names.",
        "Preserve HTML tags when the format is html.",
        "For subtitles, make Korean concise and natural.",
        "Keeping ordinary English text unchanged is invalid when the target is Korean.",
        "Keeping ordinary Korean text unchanged is invalid when the target is English.",
        "When translating Korean to English, output fluent English, not Korean.",
        ...(forceEnglish
          ? [
              "This is a correction pass for Korean subtitles.",
              "Every output item must be natural English only.",
              "Do not output Hangul/Korean script.",
              "Transliterate names and translate meaning into English.",
            ]
          : []),
        "Do not return an object.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        forceEnglish
          ? "/no_think Rewrite the Korean subtitle input into English only."
          : `/no_think Translate from ${source} to ${target}.`,
        `Format: ${request.format}.`,
        "Return only the translated JSON array.",
        `Input length: ${request.texts.length}.`,
        `Input: ${JSON.stringify(request.texts)}`,
      ].join(" "),
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

function stripLeadingThinkBlock(value: string): string {
  return value
    .trim()
    .replace(/^<think>[\s\S]*?<\/think>\s*/i, "")
    .trim();
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
  const cleaned = stripMarkdownFence(stripLeadingThinkBlock(stripKnownModelSuffixes(content)));
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
    if (expectedCount === 1 && parsed.length > 0) {
      const values = parsed.filter((item): item is string => typeof item === "string");
      const joined = values.join(" ").replace(/\s+/g, " ").trim();
      if (values.length === parsed.length && joined) return [joined];
    }
    throw GatewayError.invalidResponse("MLX output count did not match input count.");
  }
  return parsed.map((item) => {
    if (typeof item !== "string") {
      throw GatewayError.invalidResponse("MLX output items must be strings.");
    }
    return item;
  });
}

function normalizeComparableText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function countCopiedEnglishTexts(
  request: TranslationProviderRequest,
  translations: readonly string[],
): number {
  return translations.filter((translation, index) => {
    const input = request.texts[index] ?? "";
    if (!/[A-Za-z]/.test(input)) return false;
    return normalizeComparableText(input) === normalizeComparableText(translation);
  }).length;
}

function countUntranslatedKoreanTexts(
  request: TranslationProviderRequest,
  translations: readonly string[],
): number {
  return translations.filter((translation, index) => {
    const input = request.texts[index] ?? "";
    if (!KOREAN_TEXT_PATTERN.test(input)) return false;
    const copied = normalizeComparableText(input) === normalizeComparableText(translation);
    const stillKoreanOnly = KOREAN_TEXT_PATTERN.test(translation) && !/[A-Za-z]/.test(translation);
    return copied || stillKoreanOnly;
  }).length;
}

function countKoreanScriptOutputsForKoreanInputs(
  request: TranslationProviderRequest,
  translations: readonly string[],
): number {
  return translations.filter((translation, index) => {
    const input = request.texts[index] ?? "";
    return KOREAN_TEXT_PATTERN.test(input) && KOREAN_TEXT_PATTERN.test(translation);
  }).length;
}

function copiedTextThreshold(textCount: number): number {
  return Math.max(1, Math.ceil(textCount / 2));
}

function shouldRetryAutoSourceAsEnglish(
  request: TranslationProviderRequest,
  translations: readonly string[],
): boolean {
  if (request.source !== "auto") return false;
  if (!request.target.toLowerCase().startsWith("ko")) return false;
  return (
    countCopiedEnglishTexts(request, translations) >= copiedTextThreshold(request.texts.length)
  );
}

function shouldRetryAutoSourceAsKorean(
  request: TranslationProviderRequest,
  translations: readonly string[],
): boolean {
  if (request.source !== "auto") return false;
  if (!request.target.toLowerCase().startsWith("en")) return false;
  return countKoreanScriptOutputsForKoreanInputs(request, translations) > 0;
}

function shouldCorrectKoreanToEnglishOutput(
  request: TranslationProviderRequest,
  translations: readonly string[],
): boolean {
  if (request.source.toLowerCase() !== "ko") return false;
  if (!request.target.toLowerCase().startsWith("en")) return false;
  return countKoreanScriptOutputsForKoreanInputs(request, translations) > 0;
}

function shouldSplitCopiedEnglishBatch(
  request: TranslationProviderRequest,
  translations: readonly string[],
): boolean {
  if (request.texts.length <= 1) return false;
  if (!request.target.toLowerCase().startsWith("ko")) return false;
  if (request.source !== "auto" && request.source.toLowerCase() !== "en") return false;
  return (
    countCopiedEnglishTexts(request, translations) >= copiedTextThreshold(request.texts.length)
  );
}

function shouldSplitUntranslatedKoreanBatch(
  request: TranslationProviderRequest,
  translations: readonly string[],
): boolean {
  if (request.texts.length <= 1) return false;
  if (!request.target.toLowerCase().startsWith("en")) return false;
  if (request.source !== "auto" && request.source.toLowerCase() !== "ko") return false;
  return (
    countUntranslatedKoreanTexts(request, translations) >= copiedTextThreshold(request.texts.length)
  );
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
  private readonly logRequests: boolean;

  constructor(input: {
    readonly baseUrl: string;
    readonly model: string;
    readonly temperature: number;
    readonly maxTokens: number;
    readonly fetcher?: typeof fetch;
    readonly logRequests?: boolean;
  }) {
    this.upstream = input.baseUrl.replace(/\/+$/, "");
    this.model = input.model;
    this.temperature = input.temperature;
    this.maxTokens = input.maxTokens;
    this.fetcher = input.fetcher ?? fetch;
    this.logRequests = input.logRequests ?? false;
  }

  async translate(request: TranslationProviderRequest): Promise<readonly string[]> {
    return await this.translateWithFallback(request);
  }

  private async translateWithFallback(
    request: TranslationProviderRequest,
  ): Promise<readonly string[]> {
    try {
      const translations = await this.translateBatch(request);
      if (shouldRetryAutoSourceAsEnglish(request, translations)) {
        return await this.translateWithFallback({ ...request, source: "en" });
      }
      if (shouldRetryAutoSourceAsKorean(request, translations)) {
        return await this.translateWithFallback({ ...request, source: "ko" });
      }
      if (shouldCorrectKoreanToEnglishOutput(request, translations)) {
        return await this.translateKoreanToEnglishStrict(request);
      }
      if (shouldSplitCopiedEnglishBatch(request, translations)) {
        throw GatewayError.invalidResponse("MLX copied too many English inputs.");
      }
      if (shouldSplitUntranslatedKoreanBatch(request, translations)) {
        throw GatewayError.invalidResponse("MLX copied too many Korean inputs.");
      }
      return translations;
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

  private async translateKoreanToEnglishStrict(
    request: TranslationProviderRequest,
  ): Promise<readonly string[]> {
    const correctedRequest: TranslationProviderRequest = { ...request, source: "ko" };
    const translations = await this.translateBatch(correctedRequest, "force-english");
    if (countKoreanScriptOutputsForKoreanInputs(correctedRequest, translations) > 0) {
      throw GatewayError.invalidResponse("MLX kept Korean text for English output.");
    }
    return translations;
  }

  private async translateBatch(
    request: TranslationProviderRequest,
    mode: MlxPromptMode = "default",
  ): Promise<readonly string[]> {
    const body = JSON.stringify({
      model: this.model,
      messages: translationPrompt(request, mode),
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: false,
    });
    const response = await this.fetchChatCompletions(request, body, mode);
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

  private async fetchChatCompletions(
    request: TranslationProviderRequest,
    body: string,
    mode: MlxPromptMode,
  ): Promise<Response> {
    if (this.logRequests) {
      logGatewayEvent("mlx_chat_request", {
        model: this.model,
        promptMode: mode,
        source: request.source,
        target: request.target,
        format: request.format,
        textCount: request.texts.length,
        textPreview: request.texts.map(previewText),
      });
    }
    let lastError: unknown;
    for (let attempt = 0; attempt <= MLX_HTTP_RETRY_COUNT; attempt += 1) {
      try {
        return await this.fetcher(chatCompletionsUrl(this.upstream), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      } catch (error) {
        lastError = error;
        if (attempt >= MLX_HTTP_RETRY_COUNT) break;
        if (this.logRequests) {
          logGatewayEvent("mlx_chat_retry", {
            model: this.model,
            source: request.source,
            target: request.target,
            promptMode: mode,
            attempt: attempt + 1,
            message: error instanceof Error ? error.message : "MLX request failed.",
          });
        }
        await delay(MLX_HTTP_RETRY_DELAY_MS);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("MLX request failed.");
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
      logRequests: config.logRequests,
      fetcher,
    });
  }
  return new LibreTranslateProvider(config.libreTranslateUrl, fetcher);
}
