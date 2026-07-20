export type CodeInspectionId =
  | "conflictMarkers"
  | "trailingWhitespace"
  | "longLines"
  | "todoComments";

export interface CodeInspectionDefinition {
  readonly id: CodeInspectionId;
  readonly name: string;
  readonly description: string;
  readonly severity: CodeIssueSeverity;
  readonly cleanup: boolean;
}

export type CodeIssueSeverity = "error" | "warning" | "info";

export interface CodeIssue {
  readonly inspectionId: CodeInspectionId | "offline";
  readonly severity: CodeIssueSeverity;
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly content: string;
}

export const CODE_INSPECTIONS: readonly CodeInspectionDefinition[] = [
  {
    id: "conflictMarkers",
    name: "Unresolved merge conflict markers",
    description: "Reports Git merge markers left in source files.",
    severity: "error",
    cleanup: false,
  },
  {
    id: "trailingWhitespace",
    name: "Trailing whitespace",
    description: "Reports spaces or tabs after the final visible character.",
    severity: "warning",
    cleanup: true,
  },
  {
    id: "longLines",
    name: "Long lines",
    description: "Reports lines longer than 120 characters.",
    severity: "warning",
    cleanup: false,
  },
  {
    id: "todoComments",
    name: "TODO comments",
    description: "Reports TODO and FIXME markers.",
    severity: "info",
    cleanup: false,
  },
];

function issue(
  inspectionId: CodeIssue["inspectionId"],
  severity: CodeIssueSeverity,
  path: string,
  line: number,
  column: number,
  message: string,
  content: string,
): CodeIssue {
  return { inspectionId, severity, path, line, column, message, content };
}

export function inspectText(
  path: string,
  text: string,
  enabled: ReadonlySet<CodeInspectionId> = new Set(CODE_INSPECTIONS.map(({ id }) => id)),
): readonly CodeIssue[] {
  const issues: CodeIssue[] = [];
  for (const [index, content] of text.split("\n").entries()) {
    const line = index + 1;
    if (enabled.has("conflictMarkers") && /^(?:<{7}|={7}|>{7})(?:\s|$)/u.test(content)) {
      issues.push(
        issue(
          "conflictMarkers",
          "error",
          path,
          line,
          1,
          "Unresolved merge conflict marker",
          content,
        ),
      );
    }
    const trailing = /[\t ]+$/u.exec(content);
    if (enabled.has("trailingWhitespace") && trailing) {
      issues.push(
        issue(
          "trailingWhitespace",
          "warning",
          path,
          line,
          trailing.index + 1,
          "Trailing whitespace",
          content,
        ),
      );
    }
    if (enabled.has("longLines") && content.length > 120) {
      issues.push(
        issue(
          "longLines",
          "warning",
          path,
          line,
          121,
          `Line is ${content.length} characters long`,
          content,
        ),
      );
    }
    const todo = /\b(?:TODO|FIXME)\b/u.exec(content);
    if (enabled.has("todoComments") && todo) {
      issues.push(
        issue("todoComments", "info", path, line, todo.index + 1, `${todo[0]} comment`, content),
      );
    }
  }
  return issues;
}

export function cleanupText(text: string): string {
  const normalized = text
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/u, ""))
    .join("\n");
  if (normalized === "" || normalized.endsWith("\n")) return normalized;
  return `${normalized}\n`;
}

export interface StackTraceFrame {
  readonly text: string;
  readonly path: string | null;
  readonly line: number | null;
}

export function stackTraceFrames(value: string): readonly StackTraceFrame[] {
  return value.split(/\r?\n/u).flatMap((text): readonly StackTraceFrame[] => {
    if (text.trim() === "") return [];
    const parenthesized = /\(([^()]+):(\d+)(?::\d+)?\)\s*$/u.exec(text);
    const direct = /(?:^|\s)([^\s():]+):(\d+)(?::\d+)?\s*$/u.exec(text);
    const match = parenthesized ?? direct;
    return [
      {
        text,
        path: match?.[1] ?? null,
        line: match?.[2] ? Number(match[2]) : null,
      },
    ];
  });
}

function decodedXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function xmlTag(block: string, name: string): string {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "iu").exec(block);
  return decodedXml(match?.[1]?.trim() ?? "");
}

export function parseOfflineInspectionXml(name: string, content: string): readonly CodeIssue[] {
  const issues: CodeIssue[] = [];
  for (const match of content.matchAll(/<problem(?:\s[^>]*)?>([\s\S]*?)<\/problem>/giu)) {
    const block = match[1] ?? "";
    const path = xmlTag(block, "file").replace(/^file:\/\//u, "") || name;
    const line = Number(xmlTag(block, "line")) || 1;
    const description =
      xmlTag(block, "description") || xmlTag(block, "problem_class") || "Inspection problem";
    issues.push(issue("offline", "warning", path, line, 1, description, ""));
  }
  return issues;
}
