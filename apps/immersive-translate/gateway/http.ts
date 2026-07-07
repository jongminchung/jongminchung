import { GatewayError } from "./errors";
import type {
  IncomingTranslateRequest,
  TranslationFormat,
} from "./types";
import { isRecord } from "./utils";

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

export function parseTranslateRequest(value: unknown): IncomingTranslateRequest {
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

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw GatewayError.badRequest("Request body must be valid JSON.");
  }
}

export function normalizeTranslations(parsed: unknown, expectedCount: number): readonly string[] {
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
