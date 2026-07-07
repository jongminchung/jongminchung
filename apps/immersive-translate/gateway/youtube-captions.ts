import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GatewayError } from "./errors";
import type { YouTubeCaptionPayload, YouTubeCaptionRequest } from "./types";

const YOUTUBE_CAPTION_CACHE_TTL_MS = 10 * 60 * 1000;
const youtubeCaptionCache = new Map<
  string,
  { readonly expiresAt: number; readonly value: YouTubeCaptionPayload }
>();

function readYouTubeCaptionCommand(): string {
  return process.env.YOUTUBE_CAPTION_UVX?.trim() || process.env.UVX?.trim() || "uvx";
}

export function normalizeYouTubeVideoId(value: string | null): string {
  const videoId = value?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
    throw GatewayError.badRequest("Invalid YouTube videoId.");
  }
  return videoId;
}

export function normalizeYouTubeLanguageCode(value: string | null): string {
  const languageCode = value?.trim() || "en";
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(languageCode)) {
    throw GatewayError.badRequest("Invalid YouTube caption language.");
  }
  return languageCode;
}

function youtubeCaptionCacheKey(request: YouTubeCaptionRequest): string {
  return `${request.videoId}:${request.languageCode}`;
}

export function preferredYouTubeSubtitleLanguages(languageCode: string): string {
  const normalized = languageCode.toLowerCase();
  if (normalized === "en") return "en-orig,en,en.*";
  return `${normalized}-orig,${normalized},${normalized}.*,en-orig,en,en.*,zh-Hans.*,zh.*`;
}

async function runProcess(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(GatewayError.upstream(504, "YouTube caption fallback timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(
        GatewayError.upstream(502, `Could not start YouTube caption fallback: ${error.message}`),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function captionLanguageFromFileName(file: string): string {
  const lower = file.toLowerCase();
  if (!lower.endsWith(".json3")) return "";
  const withoutExtension = lower.slice(0, -".json3".length);
  return withoutExtension.split(".").at(-1) ?? "";
}

function captionLanguageMatches(file: string, languageCode: string): boolean {
  const language = captionLanguageFromFileName(file);
  const normalized = languageCode.toLowerCase();
  return language === normalized || language.startsWith(`${normalized}-`);
}

export function pickYouTubeCaptionFile(
  files: readonly string[],
  languageCode: string,
): string | null {
  const jsonFiles = files.filter((file) => file.endsWith(".json3"));
  const priorities =
    languageCode.toLowerCase() === "en"
      ? [".en-orig.json3", ".en.json3"]
      : [
          `.${languageCode.toLowerCase()}-orig.json3`,
          `.${languageCode.toLowerCase()}.json3`,
          ".en-orig.json3",
          ".en.json3",
        ];
  for (const suffix of priorities) {
    const match = jsonFiles.find((file) => file.toLowerCase().endsWith(suffix));
    if (match) return match;
  }
  const languageMatch = jsonFiles.find((file) => captionLanguageMatches(file, languageCode));
  if (languageMatch) return languageMatch;
  const englishMatch = jsonFiles.find((file) => captionLanguageMatches(file, "en"));
  if (englishMatch) return englishMatch;
  const koreanMatch = jsonFiles.find((file) => captionLanguageMatches(file, "ko"));
  if (koreanMatch) return koreanMatch;
  return jsonFiles[0] ?? null;
}

export function buildYouTubeCaptionArgs(input: {
  readonly request: YouTubeCaptionRequest;
  readonly outputTemplate: string;
}): readonly string[] {
  return [
    "yt-dlp",
    "--ignore-errors",
    "--no-check-certificate",
    "--skip-download",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs",
    preferredYouTubeSubtitleLanguages(input.request.languageCode),
    "--sub-format",
    "json3",
    "-o",
    input.outputTemplate,
    `https://www.youtube.com/watch?v=${input.request.videoId}`,
  ];
}

export async function fetchYouTubeCaptionsWithYtDlp(
  request: YouTubeCaptionRequest,
): Promise<YouTubeCaptionPayload> {
  const cacheKey = youtubeCaptionCacheKey(request);
  const cached = youtubeCaptionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const workdir = await mkdtemp(path.join(tmpdir(), "immersive-youtube-captions-"));
  try {
    const outputTemplate = path.join(workdir, "%(id)s.%(ext)s");
    const result = await runProcess(
      readYouTubeCaptionCommand(),
      buildYouTubeCaptionArgs({ request, outputTemplate }),
      90_000,
    );
    const captionFile = pickYouTubeCaptionFile(await readdir(workdir), request.languageCode);
    if (result.code !== 0 && !captionFile) {
      throw GatewayError.upstream(
        502,
        result.stderr.trim() || result.stdout.trim() || "YouTube caption fallback failed.",
      );
    }
    if (!captionFile)
      throw GatewayError.invalidResponse("YouTube caption fallback found no json3 captions.");
    const payload = await readFile(path.join(workdir, captionFile), "utf8");
    if (!payload.trim())
      throw GatewayError.invalidResponse("YouTube caption fallback returned an empty payload.");

    const value: YouTubeCaptionPayload = {
      videoId: request.videoId,
      languageCode: request.languageCode,
      label: `YouTube ${request.languageCode} captions`,
      source: "yt-dlp",
      payload,
    };
    youtubeCaptionCache.set(cacheKey, {
      expiresAt: Date.now() + YOUTUBE_CAPTION_CACHE_TTL_MS,
      value,
    });
    return value;
  } finally {
    await rm(workdir, { force: true, recursive: true });
  }
}
