import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { readGatewayConfig } from "./config.ts";
import { GatewayError } from "./errors.ts";
import { parseTranslateRequest, readJson } from "./http.ts";
import { createProvider } from "./providers.ts";
import type {
  TranslationGatewayConfig,
  TranslationProvider,
  YouTubeCaptionFetcher,
  YouTubeCaptionRequest,
} from "./types.ts";
import { jsonResponse, logGatewayEvent, previewText, textResponse } from "./utils.ts";
import {
  fetchYouTubeCaptionsWithYtDlp,
  normalizeYouTubeLanguageCode,
  normalizeYouTubeVideoId,
} from "./youtube-captions.ts";

export { readGatewayConfig } from "./config.ts";
export { LibreTranslateProvider, MlxLmProvider, createProvider } from "./providers.ts";
export type {
  TranslationGatewayConfig,
  TranslationProvider,
  TranslationProviderRequest,
  YouTubeCaptionFetcher,
  YouTubeCaptionPayload,
  YouTubeCaptionRequest,
} from "./types.ts";
export {
  buildYouTubeCaptionArgs,
  fetchYouTubeCaptionsWithYtDlp,
  pickYouTubeCaptionFile,
  preferredYouTubeSubtitleLanguages,
} from "./youtube-captions.ts";

interface GatewayHandlerOptions {
  readonly logRequests?: boolean;
  readonly youtubeCaptionFetcher?: YouTubeCaptionFetcher;
}

async function readIncomingBody(request: IncomingMessage): Promise<Buffer | null> {
  if (request.method === "GET" || request.method === "HEAD") return null;

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function incomingHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
      continue;
    }
    headers.set(name, value);
  }
  return headers;
}

async function toFetchRequest(request: IncomingMessage): Promise<Request> {
  const host = request.headers.host ?? "127.0.0.1";
  const url = new URL(request.url ?? "/", `http://${host}`);
  const body = await readIncomingBody(request);
  return new Request(url, {
    body:
      body === null
        ? undefined
        : (body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer),
    headers: incomingHeaders(request),
    method: request.method,
  });
}

async function sendNodeResponse(response: ServerResponse, fetchResponse: Response): Promise<void> {
  response.statusCode = fetchResponse.status;
  response.statusMessage = fetchResponse.statusText;
  for (const [name, value] of fetchResponse.headers) response.setHeader(name, value);
  response.end(Buffer.from(await fetchResponse.arrayBuffer()));
}

async function handleNodeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  handler: (request: Request) => Promise<Response>,
): Promise<void> {
  try {
    await sendNodeResponse(response, await handler(await toFetchRequest(request)));
  } catch (error) {
    await sendNodeResponse(response, errorResponse(error));
  }
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
  const server = createServer((request, response) => {
    void handleNodeRequest(request, response, handler);
  });
  server.keepAliveTimeout = 120_000;
  server.listen(config.port, config.host);
  console.log(
    `translation-gateway listening on ${config.host}:${config.port} profile=${provider.name}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startGateway();
}
