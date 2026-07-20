import type { FileChange, StatusModel } from "./types";

export type ChangeLayer = "index" | "worktree";
export type RepositoryViewMode = "history" | "changes";
export type DiffViewMode = "auto" | "split" | "unified";
export type DiffWhitespace = "show" | "ignoreAll";
export type DiffContextLines = 3 | 5 | 10 | "full";

export interface ChangeSelection {
  readonly path: string;
  readonly layer: ChangeLayer;
}

export interface ChangeEntry {
  readonly selection: ChangeSelection;
  readonly file: FileChange;
}

export interface RevisionDiffEntry {
  readonly file: FileChange;
  readonly patch: string;
}

export interface DiffPreferences {
  readonly viewMode: DiffViewMode;
  readonly whitespace: DiffWhitespace;
  readonly contextLines: DiffContextLines;
  readonly wordWrap: boolean;
  readonly collapseUnchanged: boolean;
  readonly synchronizedScroll: boolean;
}

export interface CommitDraft {
  readonly message: string;
  readonly amend: boolean;
  readonly signOff: boolean;
  readonly gpgSign: boolean;
  readonly runHooks: boolean;
  readonly commitAll: boolean;
  readonly changelistId: string | null;
}

export const DEFAULT_DIFF_PREFERENCES: DiffPreferences = {
  viewMode: "auto",
  whitespace: "show",
  contextLines: 3,
  wordWrap: false,
  collapseUnchanged: true,
  synchronizedScroll: true,
};

export const EMPTY_COMMIT_DRAFT: CommitDraft = {
  message: "",
  amend: false,
  signOff: false,
  gpgSign: false,
  runHooks: true,
  commitAll: false,
  changelistId: null,
};

export function changeEntries(status: StatusModel): readonly ChangeEntry[] {
  return status.changes.flatMap((file) => {
    const entries: ChangeEntry[] = [];
    if (file.staged) {
      entries.push({ selection: { path: file.path, layer: "index" }, file });
    }
    if (file.worktree) {
      entries.push({ selection: { path: file.path, layer: "worktree" }, file });
    }
    return entries;
  });
}

export function hasSameChangeSelection(left: ChangeSelection, right: ChangeSelection): boolean {
  return left.path === right.path && left.layer === right.layer;
}

export function reconcileChangeSelection(
  previous: ChangeSelection | null,
  entries: readonly ChangeEntry[],
): ChangeSelection | null {
  if (entries.length === 0) return null;
  if (previous === null) return entries[0]?.selection ?? null;

  const exact = entries.find((entry) => hasSameChangeSelection(entry.selection, previous));
  if (exact) return exact.selection;

  const otherLayer = entries.find((entry) => entry.selection.path === previous.path);
  if (otherLayer) return otherLayer.selection;

  const previousPathIndex = entries.findIndex(
    (entry) => entry.selection.path.localeCompare(previous.path) >= 0,
  );
  if (previousPathIndex >= 0) return entries[previousPathIndex]?.selection ?? null;
  return entries[entries.length - 1]?.selection ?? null;
}

function pathFromDiffHeader(header: string): string {
  const match = header.match(/\s"?b\/(.+?)"?$/);
  return match?.[1] ?? header.replace(/^diff --git\s+/, "");
}

export function revisionDiffEntries(patch: string): readonly RevisionDiffEntry[] {
  const starts = [...patch.matchAll(/^diff --git /gm)].map((match) => match.index);
  return starts.flatMap((start, index) => {
    const end = starts[index + 1] ?? patch.length;
    const filePatch = patch.slice(start, end).trimEnd();
    const newline = filePatch.indexOf("\n");
    const header = filePatch.slice(0, newline < 0 ? undefined : newline);
    const path = pathFromDiffHeader(header);
    if (!path) return [];
    const status: FileChange["status"] = filePatch.includes("\nnew file mode ")
      ? "added"
      : filePatch.includes("\ndeleted file mode ")
        ? "deleted"
        : filePatch.includes("\nrename from ")
          ? "renamed"
          : "modified";
    const binary = /\n(?:Binary files .* differ|GIT binary patch)(?:\n|$)/.test(filePatch);
    const submodule =
      /(?:old mode 160000|new mode 160000|index [0-9a-f]+\.\.[0-9a-f]+ 160000)/.test(filePatch);
    return [
      {
        file: {
          path,
          status,
          staged: false,
          worktree: false,
          binary,
          submodule,
        },
        patch: `${filePatch}\n`,
      },
    ];
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRepositoryViewMode(value: unknown): RepositoryViewMode {
  return value === "changes" ? "changes" : "history";
}

export function parseChangeSelection(value: unknown): ChangeSelection | null {
  if (!isRecord(value)) return null;
  if (typeof value.path !== "string" || value.path.length === 0) return null;
  if (value.layer !== "index" && value.layer !== "worktree") return null;
  return { path: value.path, layer: value.layer };
}

export function parseDiffPreferences(value: unknown): DiffPreferences {
  if (!isRecord(value)) return DEFAULT_DIFF_PREFERENCES;
  const viewMode: DiffViewMode =
    value.viewMode === "split" || value.viewMode === "unified" ? value.viewMode : "auto";
  const whitespace: DiffWhitespace = value.whitespace === "ignoreAll" ? "ignoreAll" : "show";
  const contextLines: DiffContextLines =
    value.contextLines === 5 || value.contextLines === 10 || value.contextLines === "full"
      ? value.contextLines
      : 3;
  return {
    viewMode,
    whitespace,
    contextLines,
    wordWrap: value.wordWrap === true,
    collapseUnchanged: value.collapseUnchanged !== false,
    synchronizedScroll: value.synchronizedScroll !== false,
  };
}

export function parseCommitDraft(value: unknown): CommitDraft {
  if (!isRecord(value)) return EMPTY_COMMIT_DRAFT;
  return {
    message: typeof value.message === "string" ? value.message : "",
    amend: value.amend === true,
    signOff: value.signOff === true,
    gpgSign: value.gpgSign === true,
    runHooks: value.runHooks !== false,
    commitAll: value.commitAll === true,
    changelistId: typeof value.changelistId === "string" ? value.changelistId : null,
  };
}
