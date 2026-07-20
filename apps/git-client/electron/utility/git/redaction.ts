const REDACTED = "[redacted]";

interface RedactionRule {
  readonly pattern: RegExp;
  readonly replacement: (match: RegExpExecArray) => string;
}

// oxlint-disable eslint/no-control-regex -- Git emits NUL-delimited fields, so secrets must stop at NUL.
const REDACTION_RULES: readonly RedactionRule[] = [
  {
    pattern: /\b(https?:\/\/)([^\s\0/@:]+):([^\s\0/@]+)@/giu,
    replacement: (match) => `${match[1] ?? ""}${REDACTED}@`,
  },
  {
    pattern: /\b(authorization[ \t]*:[ \t]*(?:basic|bearer)[ \t]+)[^\s\0\r\n]+/giu,
    replacement: (match) => `${match[1] ?? ""}${REDACTED}`,
  },
  {
    pattern: /\b(password|passwd|token|access_token|refresh_token)=([^\s&\0\r\n]+)/giu,
    replacement: (match) => `${match[1] ?? "token"}=${REDACTED}`,
  },
  {
    pattern: /\b(?:gh[opurs]_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,})\b/gu,
    replacement: () => REDACTED,
  },
];
// oxlint-enable eslint/no-control-regex

function redactChunksWithRule(chunks: readonly string[], rule: RedactionRule): readonly string[] {
  const source = chunks.join("");
  const matcher = new RegExp(rule.pattern.source, rule.pattern.flags);
  const matches: RegExpExecArray[] = [];
  for (let match = matcher.exec(source); match !== null; match = matcher.exec(source)) {
    matches.push(match);
    if (match[0].length === 0) matcher.lastIndex += 1;
  }
  if (matches.length === 0) return chunks;

  const starts: number[] = [];
  const ends: number[] = [];
  let totalLength = 0;
  for (const chunk of chunks) {
    starts.push(totalLength);
    totalLength += chunk.length;
    ends.push(totalLength);
  }
  const output = chunks.map(() => "");
  const chunkIndexAt = (offset: number): number => {
    const index = ends.findIndex((end) => offset < end);
    return index >= 0 ? index : Math.max(0, chunks.length - 1);
  };
  const appendSourceRange = (from: number, to: number): void => {
    let offset = from;
    while (offset < to) {
      const index = chunkIndexAt(offset);
      const chunkEnd = Math.min(to, ends[index] ?? to);
      output[index] += (chunks[index] ?? "").slice(
        offset - (starts[index] ?? 0),
        chunkEnd - (starts[index] ?? 0),
      );
      offset = chunkEnd;
    }
  };

  let cursor = 0;
  for (const match of matches) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    appendSourceRange(cursor, matchStart);
    output[chunkIndexAt(matchStart)] += rule.replacement(match);
    cursor = matchEnd;
  }
  appendSourceRange(cursor, totalLength);
  return output;
}

export function redactCredentialChunks(chunks: readonly string[]): readonly string[] {
  return REDACTION_RULES.reduce<readonly string[]>(
    (redacted, rule) => redactChunksWithRule(redacted, rule),
    chunks,
  );
}

export function redactCredentials(value: string): string {
  return redactCredentialChunks([value])[0] ?? "";
}

export function safeErrorMessage(value: string): string {
  const redacted = redactCredentials(value).trim();
  return (redacted || "Git command failed").slice(0, 4_096);
}
