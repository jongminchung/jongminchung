import { appendFile } from "node:fs/promises";

const GATEWAY_LOG_FILE = process.env.GATEWAY_LOG_FILE?.trim() ?? "";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readErrorMessage(response: Response): Promise<string> {
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

export function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return new Response(JSON.stringify(value), {
    ...init,
    headers,
  });
}

export function textResponse(value: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return new Response(value, { ...init, headers });
}

export function previewText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 177)}...`;
}

export function logGatewayEvent(event: string, payload: Record<string, unknown>): void {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), event, ...payload });
  console.log(line);
  if (!GATEWAY_LOG_FILE) return;
  void appendFile(GATEWAY_LOG_FILE, `${line}\n`).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`failed to append gateway log: ${message}`);
  });
}
