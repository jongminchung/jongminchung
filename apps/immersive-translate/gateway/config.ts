import type { TranslationGatewayConfig, TranslationProfile } from "./types.ts";

const DEFAULT_LIBRETRANSLATE_URL = "http://libretranslate:5000/translate";
const DEFAULT_MLX_BASE_URL = "http://host.docker.internal:8000/v1";
const DEFAULT_MLX_MODEL = "mlx-community/Qwen3-1.7B-4bit";
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 5000;

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

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return fallback;
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
    logRequests: readBooleanEnv("GATEWAY_LOG_REQUESTS", false),
  };
}
