import type { GitOperation } from "../generated";

export type ActivityStatus = "running" | "succeeded" | "failed" | "cancelled";

export interface GitActivity {
    readonly id: string;
    readonly repositoryId: string;
    readonly label: string;
    readonly status: ActivityStatus;
    readonly startedAt: number;
    readonly requestIds: readonly string[];
    readonly error: string | null;
    readonly canRetry: boolean;
}

const OPERATION_LABELS = {
    stage: "Staging files",
    stageAll: "Staging all changes",
    stageTracked: "Staging tracked changes",
    addIntent: "Adding intent to stage",
    unstage: "Unstaging files",
    removeCached: "Removing files from the index",
    discard: "Discarding changes",
    applyPatch: "Applying patch",
    partialPatch: "Applying selected changes",
    commit: "Creating commit",
    commitAdvanced: "Creating commit",
    fetch: "Fetching",
    pull: "Pulling",
    push: "Pushing",
    createBranch: "Creating branch",
    renameBranch: "Renaming branch",
    deleteBranch: "Deleting branch",
    setUpstream: "Updating tracking branch",
    deleteRemoteBranch: "Deleting remote branch",
    checkout: "Checking out reference",
    createTag: "Creating tag",
    deleteTag: "Deleting tag",
    pushTag: "Pushing tag",
    reset: "Resetting branch",
    revert: "Reverting commits",
    cherryPick: "Cherry-picking commits",
    merge: "Merging",
    rebase: "Rebasing",
    interactiveRebase: "Rewriting history",
    dropCommits: "Dropping commits",
    squashCommits: "Squashing commits",
    rewordCommit: "Rewording commit",
    undoCommit: "Undoing commit",
    createFixupCommit: "Creating fixup commit",
    createSquashCommit: "Creating squash commit",
    continue: "Continuing operation",
    skip: "Skipping commit",
    abort: "Aborting operation",
    stashPush: "Stashing changes",
    stashApply: "Applying stash",
    stashDrop: "Dropping stash",
    stashClear: "Clearing stashes",
    stashBranch: "Creating branch from stash",
    unshallow: "Downloading full history",
    updateSubmodules: "Updating submodules",
    setConfig: "Updating Git config",
    worktreeAdd: "Adding worktree",
    worktreeRemove: "Removing worktree",
    remoteAdd: "Adding remote",
    remoteRemove: "Removing remote",
    remoteSetUrl: "Updating remote",
} as const satisfies Record<GitOperation["kind"], string>;

export class GitRequestCancelledError extends Error {
    constructor() {
        super("Git request cancelled");
        this.name = "GitRequestCancelledError";
    }
}

export function operationActivityLabel(operation: GitOperation): string {
    return OPERATION_LABELS[operation.kind];
}

export function isRetryableOperation(operation: GitOperation): boolean {
    return operation.kind === "fetch";
}

export function isGitRequestCancelled(error: unknown): boolean {
    return error instanceof GitRequestCancelledError;
}

function replaceAsciiControlCharacters(value: string): string {
    return Array.from(value, (character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 0x1f || codePoint === 0x7f ? " " : character;
    }).join("");
}

export function sanitizeGitError(value: unknown): string {
    const message = value instanceof Error ? value.message : String(value);
    return replaceAsciiControlCharacters(message)
        .replace(/([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+)@/gi, "$1[redacted]@")
        .replace(
            /\b(?:gh[pousr]_[A-Za-z0-9_]+|glpat-[A-Za-z0-9_-]+)\b/g,
            "[redacted]",
        )
        .replace(
            /\b(Bearer|token|password|authorization|private-token)(\s*[:=]?\s*)\S+/gi,
            "$1$2[redacted]",
        )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2_000);
}
