import { readGatewayConfig } from "./config";
import { GatewayError } from "./errors";
import { parseTranslateRequest, readJson } from "./http";
import { createProvider } from "./providers";
import type {
  TranslationGatewayConfig,
  TranslationProvider,
  YouTubeCaptionFetcher,
  YouTubeCaptionRequest,
} from "./types";
import { jsonResponse, logGatewayEvent, previewText, textResponse } from "./utils";
import {
  fetchYouTubeCaptionsWithYtDlp,
  normalizeYouTubeLanguageCode,
  normalizeYouTubeVideoId,
} from "./youtube-captions";

export { readGatewayConfig } from "./config";
export { LibreTranslateProvider, MlxLmProvider, createProvider } from "./providers";
export type {
  TranslationGatewayConfig,
  TranslationProvider,
  TranslationProviderRequest,
  YouTubeCaptionFetcher,
  YouTubeCaptionPayload,
  YouTubeCaptionRequest,
} from "./types";
export {
  buildYouTubeCaptionArgs,
  fetchYouTubeCaptionsWithYtDlp,
  pickYouTubeCaptionFile,
  preferredYouTubeSubtitleLanguages,
} from "./youtube-captions";

interface GatewayHandlerOptions {
  readonly logRequests?: boolean;
  readonly youtubeCaptionFetcher?: YouTubeCaptionFetcher;
}

async function handleTranslate(
  request: Request,
  provider: TranslationProvider,
  options: { readonly logRequests?: boolean } = {},
): Promise<Response> {
  if (request.method !== "POST") throw GatewayError.badRequest("Use POST for /translate.");
  const parsedRequest = parseTranslateRequest(await readJson(request));
  const texts = Array.isArray(parsedRequest.q) ? parsedRequest.q : [parsedRequest.q];
  if (options.logRequests) {
    logGatewayEvent("translate_request", {
      provider: provider.name,
      source: parsedRequest.source,
      target: parsedRequest.target,
      format: parsedRequest.format,
      textCount: texts.length,
      textPreview: texts.map(previewText),
    });
  }
  let translations: readonly string[];
  try {
    translations = await provider.translate({
      texts,
      source: parsedRequest.source,
      target: parsedRequest.target,
      format: parsedRequest.format,
      apiKey: parsedRequest.apiKey,
    });
  } catch (error) {
    if (options.logRequests) {
      logGatewayEvent("translate_error", {
        provider: provider.name,
        textCount: texts.length,
        message: error instanceof Error ? error.message : "Translation failed.",
      });
    }
    throw error;
  }
  if (options.logRequests) {
    logGatewayEvent("translate_response", {
      provider: provider.name,
      textCount: texts.length,
      translatedPreview: translations.map(previewText),
    });
  }
  return jsonResponse({
    translatedText: parsedRequest.originalWasArray ? translations : (translations[0] ?? ""),
  });
}

async function handleYouTubeCaptions(
  request: Request,
  fetcher: YouTubeCaptionFetcher,
  options: { readonly logRequests?: boolean } = {},
): Promise<Response> {
  if (request.method !== "GET") throw GatewayError.badRequest("Use GET for /youtube-captions.");
  const url = new URL(request.url);
  const captionRequest: YouTubeCaptionRequest = {
    videoId: normalizeYouTubeVideoId(url.searchParams.get("videoId")),
    languageCode: normalizeYouTubeLanguageCode(url.searchParams.get("languageCode")),
  };
  if (options.logRequests) {
    logGatewayEvent("youtube_caption_request", {
      videoId: captionRequest.videoId,
      languageCode: captionRequest.languageCode,
    });
  }
  return jsonResponse(await fetcher(captionRequest));
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
  options: GatewayHandlerOptions = {},
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method === "OPTIONS") return textResponse("");
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health") return handleHealth(provider);
      if (url.pathname === "/translate") return await handleTranslate(request, provider, options);
      if (url.pathname === "/youtube-captions") {
        return await handleYouTubeCaptions(
          request,
          options.youtubeCaptionFetcher ?? fetchYouTubeCaptionsWithYtDlp,
          options,
        );
      }
      return jsonResponse({ error: "Not found", code: "not_found" }, { status: 404 });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function startGateway(config: TranslationGatewayConfig = readGatewayConfig()): void {
  const provider = createProvider(config);
  const handler = createGatewayHandler(provider, { logRequests: config.logRequests });
  Bun.serve({
    hostname: config.host,
    port: config.port,
    idleTimeout: 120,
    fetch: handler,
  });
  console.log(
    `translation-gateway listening on ${config.host}:${config.port} profile=${provider.name}`,
  );
}

if (typeof Bun !== "undefined" && import.meta.main) {
  startGateway();
}
