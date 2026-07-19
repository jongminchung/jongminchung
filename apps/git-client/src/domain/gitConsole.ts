import type { GitEvent, GitRequest, RequestId } from "../generated";
import { operationActivityLabel } from "./gitActivity";

export type GitConsoleStatus = "running" | "completed" | "failed" | "cancelled";

export interface GitConsoleEntry {
  readonly requestId: RequestId;
  readonly repositoryId: string;
  readonly command: string;
  readonly status: GitConsoleStatus;
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly output: string;
}

const MAX_CONSOLE_ENTRIES = 500;
const MAX_ENTRY_OUTPUT = 64 * 1024;

export function describeGitRequest(request: GitRequest): string {
  switch (request.kind) {
    case "status": return "git status --porcelain=v2 --branch -z";
    case "refs": return "git for-each-ref";
    case "files": return "git ls-files --cached --others --exclude-standard -z";
    case "searchText": return "git grep [search] --untracked --exclude-standard";
    case "log": return `git log --max-count=${request.limit} --skip=${request.skip}`;
    case "commitDetails": return `git show --format= ${request.revision.slice(0, 12)}`;
    case "diff": return `git diff${request.staged ? " --cached" : ""}${request.paths.length > 0 ? ` -- ${request.paths.length} path(s)` : ""}`;
    case "tree": return `git ls-tree ${request.revision.slice(0, 12)}`;
    case "fileHistory": return `git log -- ${request.path}`;
    case "blame": return `git blame ${request.revision?.slice(0, 12) ?? "HEAD"} -- ${request.path}`;
    case "stashList": return "git stash list";
    case "stashShow": return `git stash show ${request.stash}`;
    case "configList": return "git config --list --show-origin --show-scope";
    case "submoduleStatus": return "git submodule status --recursive";
    case "signature": return `git show --show-signature ${request.revision.slice(0, 12)}`;
    case "checkIgnored": return `git check-ignore -- ${request.paths.length} path(s)`;
    case "mergedBranches": return `git branch --merged ${request.target}`;
    case "pushPreview": return `git rev-list ${request.localRevision} --not ${request.remote}/${request.remoteRef}`;
    case "historyRewritePreview": return `git log ${request.fromRevision.slice(0, 12)}..HEAD`;
    case "operation": return `git ${request.operation.kind}  # ${operationActivityLabel(request.operation)}`;
  }
}

export function redactGitConsoleText(value: string): string {
  return value
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+)@/gi, "$1[redacted]@")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|glpat-[A-Za-z0-9_-]+)\b/g, "[redacted]")
    .replace(/\b(Bearer|token|password|authorization|private-token)(\s*[:=]?\s*)\S+/gi, "$1$2[redacted]");
}

function appendOutput(current: string, value: string): string {
  return `${current}${redactGitConsoleText(value)}`.slice(-MAX_ENTRY_OUTPUT);
}

export function recordGitConsoleEvent(
  entries: readonly GitConsoleEntry[],
  request: GitRequest,
  event: GitEvent,
  now: number,
): readonly GitConsoleEntry[] {
  const index = entries.findIndex((entry) => entry.requestId === event.requestId);
  const current = index >= 0 ? entries[index] : undefined;
  const base: GitConsoleEntry = current ?? {
    requestId: event.requestId,
    repositoryId: request.repositoryId,
    command: event.kind === "started"
      ? redactGitConsoleText(event.displayCommand)
      : describeGitRequest(request),
    status: "running",
    startedAt: event.kind === "started" ? event.startedAtMs : now,
    completedAt: null,
    output: "",
  };
  const next = event.kind === "started"
    ? { ...base, command: request.kind === "searchText" ? describeGitRequest(request) : redactGitConsoleText(event.displayCommand), startedAt: event.startedAtMs }
    : event.kind === "output"
      ? request.kind === "searchText"
        ? base
        : { ...base, output: appendOutput(base.output, event.data) }
      : event.kind === "completed"
        ? { ...base, status: "completed" as const, completedAt: now }
        : event.kind === "failed"
          ? { ...base, status: "failed" as const, completedAt: now, output: appendOutput(base.output, `${base.output ? "\n" : ""}${event.message}`) }
          : { ...base, status: "cancelled" as const, completedAt: now };
  const updated = index >= 0
    ? entries.map((entry, entryIndex) => entryIndex === index ? next : entry)
    : [...entries, next];
  return updated.slice(-MAX_CONSOLE_ENTRIES);
}
