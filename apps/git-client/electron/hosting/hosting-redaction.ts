const REDACTED = "[redacted]";

function replaceSecret(value: string, secret: string): string {
  if (secret.length === 0) return value;
  return value.split(secret).join(REDACTED);
}

export function redactHostingCredentials(value: string, secrets: readonly string[] = []): string {
  let redacted = value;
  for (const secret of [...secrets].sort((left, right) => right.length - left.length)) {
    redacted = replaceSecret(redacted, secret);
  }
  return redacted
    .replace(/\b(https?:\/\/)([^\s/@]+)@/giu, `$1${REDACTED}@`)
    .replace(
      /\b(authorization|private-token|password|token)(\s*["']?\s*[:=]\s*["']?)([^\s"',}]+)/giu,
      `$1$2${REDACTED}`,
    )
    .replace(/\b(bearer\s+)[^\s"',}]+/giu, `$1${REDACTED}`)
    .replace(/\b(?:gh[opurs]_[A-Za-z0-9_]+|glpat-[A-Za-z0-9_-]+)\b/gu, REDACTED);
}

export function safeHostingErrorMessage(value: string, secrets: readonly string[] = []): string {
  const redacted = redactHostingCredentials(value, secrets).trim();
  return (redacted || "Hosting request failed").slice(0, 4_096);
}
