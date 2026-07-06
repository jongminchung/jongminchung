import { LOCAL_TRANSLATION_STORAGE_KEY, STORAGE_PREFIX } from "./constants";

export type TranslationDisplayMode = "inline" | "side-by-side" | "replace";
export type CaptionLineOrder = "original-first" | "translated-first";
export type CaptionFontSize = "small" | "medium" | "large";
export type CaptionOverlayPosition = "top" | "bottom";

export interface CaptionDisplayPreferences {
  readonly displayMode: TranslationDisplayMode;
  readonly captionLineOrder: CaptionLineOrder;
  readonly captionFontSize: CaptionFontSize;
  readonly captionOverlayPosition: CaptionOverlayPosition;
  readonly captionBackgroundOpacity: number;
}

export interface LocalTranslationSettings {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly sttEndpoint: string;
  readonly apiKey: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly displayMode: TranslationDisplayMode;
  readonly captionLineOrder: CaptionLineOrder;
  readonly captionFontSize: CaptionFontSize;
  readonly captionOverlayPosition: CaptionOverlayPosition;
  readonly captionBackgroundOpacity: number;
  readonly batchSize: number;
  readonly cacheEnabled: boolean;
  readonly cacheTtlMinutes: number;
  readonly clearCacheOnDisable: boolean;
}

export interface TranslationLanguagePair {
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
}

export interface TranslationInput {
  readonly id: string;
  readonly text: string;
  readonly format?: "text" | "html";
}

export interface TranslationOutput {
  readonly id: string;
  readonly text: string;
}

export type TranslationJobStatus = "running" | "succeeded" | "failed" | "cancelled" | "partial";

export type LocalTranslationErrorCode =
  | "offline_endpoint"
  | "invalid_response"
  | "unsupported_language"
  | "rate_limit"
  | "invalid_request"
  | "missing_credentials"
  | "cancelled";

export interface LocalTranslationError {
  readonly code: LocalTranslationErrorCode;
  readonly message: string;
  readonly inputIds: readonly string[];
}

export interface TranslationJobProgress {
  readonly total: number;
  readonly completed: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly failures: number;
}

export interface TranslationJobResult {
  readonly status: TranslationJobStatus;
  readonly translations: readonly TranslationOutput[];
  readonly errors: readonly LocalTranslationError[];
  readonly progress: TranslationJobProgress;
}

export interface StorageAreaLike {
  readonly get: (key: string) => Promise<Record<string, unknown>>;
  readonly set: (items: Record<string, unknown>) => Promise<void>;
}

interface LocalTranslationCacheEntry {
  readonly text: string;
  readonly createdAt: number;
}

interface LocalTranslationCacheData {
  readonly entries: Record<string, LocalTranslationCacheEntry>;
}

export const DEFAULT_LOCAL_TRANSLATION_SETTINGS: LocalTranslationSettings = {
  enabled: true,
  endpoint: "http://127.0.0.1:5000/translate",
  sttEndpoint: "http://127.0.0.1:5000/transcribe",
  apiKey: "",
  sourceLanguage: "auto",
  targetLanguage: "ko-en",
  displayMode: "inline",
  captionLineOrder: "original-first",
  captionFontSize: "medium",
  captionOverlayPosition: "bottom",
  captionBackgroundOpacity: 88,
  batchSize: 10,
  cacheEnabled: true,
  cacheTtlMinutes: 1440,
  clearCacheOnDisable: false,
};

const KOREAN_TEXT_PATTERN = /[\u3131-\u318e\uac00-\ud7a3]/;
const BIDIRECTIONAL_KO_EN_TARGETS = new Set([
  "ko-en",
  "ko/en",
  "ko_en",
  "auto-ko-en",
  "bidirectional-ko-en",
]);

function prefixKey(name: string): string {
  return `${STORAGE_PREFIX}_${name}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string, fallback: string): string {
  const value = record[key];
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function readEditableString(
  record: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : fallback;
}

function readOptionalString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

export function isBidirectionalKoEnTargetLanguage(value: string): boolean {
  return BIDIRECTIONAL_KO_EN_TARGETS.has(value.trim().toLocaleLowerCase());
}

export function resolveTranslationLanguagePair(
  settings: LocalTranslationSettings,
  text: string,
): TranslationLanguagePair {
  if (!isBidirectionalKoEnTargetLanguage(settings.targetLanguage)) {
    return {
      sourceLanguage: settings.sourceLanguage,
      targetLanguage: settings.targetLanguage,
    };
  }

  const sourceLanguage = KOREAN_TEXT_PATTERN.test(text) ? "ko" : "en";
  return {
    sourceLanguage,
    targetLanguage: sourceLanguage === "ko" ? "en" : "ko",
  };
}

function readDisplayMode(record: Record<string, unknown>): TranslationDisplayMode {
  const value = record.displayMode;
  if (value === "inline" || value === "side-by-side" || value === "replace") return value;
  return DEFAULT_LOCAL_TRANSLATION_SETTINGS.displayMode;
}

function readCaptionLineOrder(record: Record<string, unknown>): CaptionLineOrder {
  const value = record.captionLineOrder;
  if (value === "original-first" || value === "translated-first") return value;
  return DEFAULT_LOCAL_TRANSLATION_SETTINGS.captionLineOrder;
}

function readCaptionFontSize(record: Record<string, unknown>): CaptionFontSize {
  const value = record.captionFontSize;
  if (value === "small" || value === "medium" || value === "large") return value;
  return DEFAULT_LOCAL_TRANSLATION_SETTINGS.captionFontSize;
}

function readCaptionOverlayPosition(record: Record<string, unknown>): CaptionOverlayPosition {
  const value = record.captionOverlayPosition;
  if (value === "top" || value === "bottom") return value;
  return DEFAULT_LOCAL_TRANSLATION_SETTINGS.captionOverlayPosition;
}

export function captionDisplayPreferencesFromSettings(
  settings: LocalTranslationSettings,
): CaptionDisplayPreferences {
  return {
    displayMode: settings.displayMode,
    captionLineOrder: settings.captionLineOrder,
    captionFontSize: settings.captionFontSize,
    captionOverlayPosition: settings.captionOverlayPosition,
    captionBackgroundOpacity: settings.captionBackgroundOpacity,
  };
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readPercentInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value < 0 || value > 100) return fallback;
  return Math.round(value);
}

export function normalizeLocalTranslationSettings(value: unknown): LocalTranslationSettings {
  if (!isRecord(value)) return DEFAULT_LOCAL_TRANSLATION_SETTINGS;

  return {
    enabled: readBoolean(value, "enabled", DEFAULT_LOCAL_TRANSLATION_SETTINGS.enabled),
    endpoint: readEditableString(value, "endpoint", DEFAULT_LOCAL_TRANSLATION_SETTINGS.endpoint),
    sttEndpoint: readEditableString(
      value,
      "sttEndpoint",
      DEFAULT_LOCAL_TRANSLATION_SETTINGS.sttEndpoint,
    ),
    apiKey: readOptionalString(value, "apiKey"),
    sourceLanguage: readString(
      value,
      "sourceLanguage",
      DEFAULT_LOCAL_TRANSLATION_SETTINGS.sourceLanguage,
    ),
    targetLanguage: readString(
      value,
      "targetLanguage",
      DEFAULT_LOCAL_TRANSLATION_SETTINGS.targetLanguage,
    ),
    displayMode: readDisplayMode(value),
    captionLineOrder: readCaptionLineOrder(value),
    captionFontSize: readCaptionFontSize(value),
    captionOverlayPosition: readCaptionOverlayPosition(value),
    captionBackgroundOpacity: readPercentInteger(
      value.captionBackgroundOpacity,
      DEFAULT_LOCAL_TRANSLATION_SETTINGS.captionBackgroundOpacity,
    ),
    batchSize: clampInteger(value.batchSize, DEFAULT_LOCAL_TRANSLATION_SETTINGS.batchSize, 1, 50),
    cacheEnabled: readBoolean(
      value,
      "cacheEnabled",
      DEFAULT_LOCAL_TRANSLATION_SETTINGS.cacheEnabled,
    ),
    cacheTtlMinutes: clampInteger(
      value.cacheTtlMinutes,
      DEFAULT_LOCAL_TRANSLATION_SETTINGS.cacheTtlMinutes,
      5,
      10080,
    ),
    clearCacheOnDisable: readBoolean(
      value,
      "clearCacheOnDisable",
      DEFAULT_LOCAL_TRANSLATION_SETTINGS.clearCacheOnDisable,
    ),
  };
}

function normalizeCacheData(value: unknown): LocalTranslationCacheData {
  if (!isRecord(value) || !isRecord(value.entries)) return { entries: {} };

  const entries: Record<string, LocalTranslationCacheEntry> = {};
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!isRecord(entry)) continue;
    if (typeof entry.text !== "string") continue;
    if (typeof entry.createdAt !== "number" || !Number.isFinite(entry.createdAt)) continue;
    entries[key] = { text: entry.text, createdAt: entry.createdAt };
  }

  return { entries };
}

export class LocalTranslationRepository {
  private readonly storageKey: string;
  private readonly cacheStorageKey: string;
  private readonly storage: StorageAreaLike;

  private constructor(storage: StorageAreaLike, key: string) {
    this.storage = storage;
    this.storageKey = prefixKey(key);
    this.cacheStorageKey = prefixKey(`${key}Cache`);
  }

  static ofStorage(storage: StorageAreaLike): LocalTranslationRepository {
    return new LocalTranslationRepository(storage, LOCAL_TRANSLATION_STORAGE_KEY);
  }

  async load(): Promise<LocalTranslationSettings> {
    const result = await this.storage.get(this.storageKey);
    return normalizeLocalTranslationSettings(result[this.storageKey]);
  }

  async save(settings: LocalTranslationSettings): Promise<void> {
    await this.storage.set({
      [this.storageKey]: normalizeLocalTranslationSettings(settings),
    });
  }

  async loadCache(): Promise<LocalTranslationCacheData> {
    const result = await this.storage.get(this.cacheStorageKey);
    return normalizeCacheData(result[this.cacheStorageKey]);
  }

  async saveCache(cache: LocalTranslationCacheData): Promise<void> {
    await this.storage.set({
      [this.cacheStorageKey]: normalizeCacheData(cache),
    });
  }

  async clearCache(): Promise<void> {
    await this.saveCache({ entries: {} });
  }
}

export interface LocalTranslationSelfTestResult {
  readonly ok: boolean;
  readonly message: string;
}

export type LocalTranslationFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface RunTranslationJobOptions {
  readonly repository?: LocalTranslationRepository;
  readonly fetcher?: LocalTranslationFetch;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
  readonly onProgress?: (result: TranslationJobResult) => void;
}

function validateEndpoint(endpoint: string): string | null {
  if (!endpoint.trim()) return "Enter a local translation endpoint URL.";

  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Use an http:// or https:// endpoint URL.";
    }
  } catch {
    return "Enter a valid endpoint URL.";
  }

  return null;
}

async function readFailureMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text.trim()) return response.statusText;

  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) {
      const error = parsed.error;
      if (typeof error === "string" && error.trim()) return error.trim();
      const message = parsed.message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
  } catch {
    return text.trim();
  }

  return text.trim();
}

function hasTranslationPayload(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.translation === "string" && value.translation.trim()) return true;
  if (typeof value.translatedText === "string" && value.translatedText.trim()) return true;
  if (Array.isArray(value.translations)) {
    return value.translations.some((item) => typeof item === "string" && item.trim());
  }
  return false;
}

function createCacheKey(settings: LocalTranslationSettings, input: TranslationInput): string {
  const languagePair = resolveTranslationLanguagePair(settings, input.text);
  return JSON.stringify({
    endpoint: settings.endpoint,
    source: languagePair.sourceLanguage,
    target: languagePair.targetLanguage,
    format: input.format ?? "text",
    text: input.text,
  });
}

function readCachedTranslation(
  cache: LocalTranslationCacheData,
  key: string,
  settings: LocalTranslationSettings,
  now: number,
): string | null {
  const entry = cache.entries[key];
  if (!entry) return null;
  const expiresAt = entry.createdAt + settings.cacheTtlMinutes * 60_000;
  return expiresAt >= now ? entry.text : null;
}

function normalizeResponseTranslations(parsed: unknown, expectedCount: number): string[] | null {
  if (!isRecord(parsed)) return null;

  const translatedText = parsed.translatedText;
  if (typeof translatedText === "string") {
    return expectedCount === 1 && translatedText.trim() ? [translatedText] : null;
  }
  if (Array.isArray(translatedText)) {
    if (translatedText.length !== expectedCount) return null;
    const values = translatedText.filter((item): item is string => typeof item === "string");
    return values.length === expectedCount ? values : null;
  }

  const translation = parsed.translation;
  if (typeof translation === "string") {
    return expectedCount === 1 && translation.trim() ? [translation] : null;
  }

  const translations = parsed.translations;
  if (!Array.isArray(translations) || translations.length !== expectedCount) return null;
  const values = translations.map((item): string | null => {
    if (typeof item === "string") return item;
    if (isRecord(item) && typeof item.translatedText === "string") return item.translatedText;
    return null;
  });

  return values.every((item): item is string => typeof item === "string") ? values : null;
}

function normalizeResponseError(status: number, message: string): LocalTranslationErrorCode {
  if (status === 401 || status === 403) return "missing_credentials";
  if (status === 429) return "rate_limit";
  if (status === 400 && message.toLowerCase().includes("language")) return "unsupported_language";
  if (status >= 400 && status < 500) return "invalid_request";
  return "offline_endpoint";
}

function normalizeThrownError(error: unknown): LocalTranslationError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { code: "cancelled", message: "Translation job was cancelled.", inputIds: [] };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "cancelled", message: "Translation job was cancelled.", inputIds: [] };
  }
  const detail = error instanceof Error ? error.message : "Request failed";
  return { code: "offline_endpoint", message: detail, inputIds: [] };
}

function createError(
  code: LocalTranslationErrorCode,
  message: string,
  inputs: readonly TranslationInput[],
): LocalTranslationError {
  return { code, message, inputIds: inputs.map((input) => input.id) };
}

function resolveJobStatus(
  errors: readonly LocalTranslationError[],
  completed: number,
  total: number,
): TranslationJobStatus {
  const failures = errors.reduce((count, error) => count + error.inputIds.length, 0);
  if (completed + failures < total) return "running";
  if (errors.length === 0) return "succeeded";
  if (completed > 0) return "partial";
  return errors.every((error) => error.code === "cancelled") ? "cancelled" : "failed";
}

function orderTranslations(
  inputs: readonly TranslationInput[],
  translations: readonly TranslationOutput[],
): TranslationOutput[] {
  const byId = new Map(translations.map((translation) => [translation.id, translation]));
  return inputs.flatMap((input) => {
    const translation = byId.get(input.id);
    return translation ? [translation] : [];
  });
}

function buildJobResult(
  inputs: readonly TranslationInput[],
  translations: readonly TranslationOutput[],
  errors: readonly LocalTranslationError[],
  cacheHits: number,
  cacheMisses: number,
): TranslationJobResult {
  const orderedTranslations = orderTranslations(inputs, translations);
  const failures = errors.reduce((count, error) => count + error.inputIds.length, 0);

  return {
    status: resolveJobStatus(errors, orderedTranslations.length, inputs.length),
    translations: orderedTranslations,
    errors,
    progress: {
      total: inputs.length,
      completed: orderedTranslations.length,
      cacheHits,
      cacheMisses,
      failures,
    },
  };
}

interface TranslationRequestBatch {
  readonly inputs: readonly TranslationInput[];
  readonly format: "text" | "html";
  readonly languagePair: TranslationLanguagePair;
}

function sameLanguagePair(left: TranslationLanguagePair, right: TranslationLanguagePair): boolean {
  return (
    left.sourceLanguage === right.sourceLanguage && left.targetLanguage === right.targetLanguage
  );
}

function createBatches(
  inputs: readonly TranslationInput[],
  settings: LocalTranslationSettings,
  batchSize: number,
): TranslationRequestBatch[] {
  const batches: TranslationRequestBatch[] = [];
  let current: TranslationInput[] = [];
  let currentFormat: "text" | "html" | null = null;
  let currentLanguagePair: TranslationLanguagePair | null = null;

  for (const input of inputs) {
    const format = input.format ?? "text";
    const languagePair = resolveTranslationLanguagePair(settings, input.text);
    const formatChanged = currentFormat !== null && currentFormat !== format;
    const languageChanged =
      currentLanguagePair !== null && !sameLanguagePair(currentLanguagePair, languagePair);
    if (current.length >= batchSize || formatChanged || languageChanged) {
      if (currentLanguagePair && currentFormat) {
        batches.push({ inputs: current, format: currentFormat, languagePair: currentLanguagePair });
      }
      current = [];
    }
    current.push(input);
    currentFormat = format;
    currentLanguagePair = languagePair;
  }

  if (current.length > 0 && currentLanguagePair && currentFormat) {
    batches.push({ inputs: current, format: currentFormat, languagePair: currentLanguagePair });
  }
  return batches;
}

async function requestTranslations(
  settings: LocalTranslationSettings,
  batch: TranslationRequestBatch,
  fetcher: LocalTranslationFetch,
  signal: AbortSignal | undefined,
): Promise<readonly TranslationOutput[] | LocalTranslationError> {
  const inputs = batch.inputs;
  if (signal?.aborted) return createError("cancelled", "Translation job was cancelled.", inputs);

  try {
    const response = await fetcher(settings.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        q: inputs.map((input) => input.text),
        source: batch.languagePair.sourceLanguage,
        target: batch.languagePair.targetLanguage,
        format: batch.format,
        ...(settings.apiKey ? { api_key: settings.apiKey } : {}),
      }),
    });

    if (!response.ok) {
      const message = await readFailureMessage(response);
      return createError(normalizeResponseError(response.status, message), message, inputs);
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      return createError("invalid_response", "Endpoint response was not valid JSON.", inputs);
    }

    const translatedTexts = normalizeResponseTranslations(parsed, inputs.length);
    if (!translatedTexts) {
      return createError(
        "invalid_response",
        "Endpoint response did not include translatedText for every input.",
        inputs,
      );
    }

    return inputs.map((input, index) => ({ id: input.id, text: translatedTexts[index] ?? "" }));
  } catch (error) {
    const normalized = normalizeThrownError(error);
    return createError(normalized.code, normalized.message, inputs);
  }
}

export class LocalTranslationService {
  private constructor() {}

  static async selfTest(
    rawSettings: LocalTranslationSettings,
    fetcher: LocalTranslationFetch = fetch,
  ): Promise<LocalTranslationSelfTestResult> {
    const settings = normalizeLocalTranslationSettings(rawSettings);
    const endpointError = validateEndpoint(settings.endpoint);
    if (endpointError) return { ok: false, message: endpointError };
    const languagePair = resolveTranslationLanguagePair(settings, "Hello");

    try {
      const response = await fetcher(settings.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: "Hello",
          source: languagePair.sourceLanguage,
          target: languagePair.targetLanguage,
          format: "text",
          ...(settings.apiKey ? { api_key: settings.apiKey } : {}),
        }),
      });

      if (!response.ok) {
        const message = await readFailureMessage(response);
        return {
          ok: false,
          message: `Endpoint returned ${response.status}: ${message}. Check the local service is running and supports the selected languages.`,
        };
      }

      let parsed: unknown;
      try {
        parsed = await response.json();
      } catch {
        return {
          ok: false,
          message:
            "Endpoint responded, but the response was not JSON. Check the local service is LibreTranslate-compatible.",
        };
      }

      if (!hasTranslationPayload(parsed)) {
        return {
          ok: false,
          message:
            "Endpoint responded, but no translated text was found. Check the response includes translatedText.",
        };
      }

      return { ok: true, message: "Local translation endpoint is ready." };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Request failed";
      return {
        ok: false,
        message: `${detail}. Check the local service is running and the endpoint URL is reachable.`,
      };
    }
  }

  static async runJob(
    rawSettings: LocalTranslationSettings,
    inputs: readonly TranslationInput[],
    options: RunTranslationJobOptions = {},
  ): Promise<TranslationJobResult> {
    const settings = normalizeLocalTranslationSettings(rawSettings);
    const endpointError = validateEndpoint(settings.endpoint);
    if (endpointError) {
      const errors = inputs.map((input) => createError("invalid_request", endpointError, [input]));
      return {
        status: "failed",
        translations: [],
        errors,
        progress: {
          total: inputs.length,
          completed: 0,
          cacheHits: 0,
          cacheMisses: 0,
          failures: inputs.length,
        },
      };
    }

    options.onProgress?.({
      status: "running",
      translations: [],
      errors: [],
      progress: {
        total: inputs.length,
        completed: 0,
        cacheHits: 0,
        cacheMisses: 0,
        failures: 0,
      },
    });

    const fetcher = options.fetcher ?? fetch;
    const now = options.now?.() ?? Date.now();
    const cache =
      settings.cacheEnabled && options.repository ? await options.repository.loadCache() : null;
    const translations: TranslationOutput[] = [];
    const errors: LocalTranslationError[] = [];
    const misses: TranslationInput[] = [];
    let cacheHits = 0;

    for (const input of inputs) {
      if (options.signal?.aborted) {
        errors.push(createError("cancelled", "Translation job was cancelled.", [input]));
        continue;
      }
      const key = createCacheKey(settings, input);
      const cached = cache ? readCachedTranslation(cache, key, settings, now) : null;
      if (cached !== null) {
        cacheHits += 1;
        translations.push({ id: input.id, text: cached });
      } else {
        misses.push(input);
      }
    }

    for (const batch of createBatches(misses, settings, settings.batchSize)) {
      const result = await requestTranslations(settings, batch, fetcher, options.signal);
      if (!("code" in result)) {
        translations.push(...result);
        if (cache) {
          for (const output of result) {
            const input = batch.inputs.find((item) => item.id === output.id);
            if (input) {
              cache.entries[createCacheKey(settings, input)] = {
                text: output.text,
                createdAt: now,
              };
            }
          }
        }
      } else {
        for (const inputId of result.inputIds) {
          errors.push({
            code: result.code,
            message: result.message,
            inputIds: [inputId],
          });
        }
      }

      options.onProgress?.(buildJobResult(inputs, translations, errors, cacheHits, misses.length));
    }

    if (misses.length === 0) {
      options.onProgress?.(buildJobResult(inputs, translations, errors, cacheHits, misses.length));
    }

    if (cache && options.repository) await options.repository.saveCache(cache);

    return buildJobResult(inputs, translations, errors, cacheHits, misses.length);
  }

  static async clearCache(repository: LocalTranslationRepository): Promise<void> {
    await repository.clearCache();
  }
}
