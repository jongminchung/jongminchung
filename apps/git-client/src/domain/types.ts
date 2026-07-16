import type { OutputStream, RepositorySnapshot } from "../generated";

export type RefKind = "local" | "remote" | "tag";

export interface Ref {
  readonly name: string;
  readonly shortName: string;
  readonly oid: string;
  readonly kind: RefKind;
  readonly current: boolean;
  readonly upstream?: string;
  readonly tracking?: string;
  readonly subject: string;
  readonly author: string;
  readonly timestamp: number;
  readonly favorite: boolean;
}

export interface Commit {
  readonly oid: string;
  readonly parents: readonly string[];
  readonly author: string;
  readonly email: string;
  readonly authoredAt: number;
  readonly committedAt: number;
  readonly refs: readonly string[];
  readonly subject: string;
  readonly body: string;
}

export type ChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflicted";

export interface FileChange {
  readonly path: string;
  readonly oldPath?: string;
  readonly status: ChangeStatus;
  readonly staged: boolean;
  readonly worktree: boolean;
  readonly additions?: number;
  readonly deletions?: number;
  readonly submodule?: boolean;
  readonly sizeBytes?: number;
  readonly lineCount?: number;
  readonly binary?: boolean;
  readonly utf8?: boolean;
}

export interface Conflict {
  readonly path: string;
  readonly baseOid?: string;
  readonly localOid?: string;
  readonly remoteOid?: string;
  readonly binary: boolean;
}

export interface TreeEntry {
  readonly mode: string;
  readonly kind: "blob" | "tree" | "commit";
  readonly oid: string;
  readonly size?: number;
  readonly path: string;
}

export interface BlameLine {
  readonly oid: string;
  readonly originalLine: number;
  readonly finalLine: number;
  readonly author: string;
  readonly email: string;
  readonly authoredAt: number;
  readonly summary: string;
  readonly content: string;
}

export interface StatusModel {
  readonly branchOid?: string;
  readonly branch?: string;
  readonly upstream?: string;
  readonly ahead: number;
  readonly behind: number;
  readonly stashCount: number;
  readonly changes: readonly FileChange[];
}

export interface StashEntry {
  readonly selector: string;
  readonly oid: string;
  readonly subject: string;
  readonly author: string;
  readonly email: string;
  readonly createdAt: number;
  readonly files: readonly FileChange[];
}

export interface SelectionContext {
  readonly selectedCommits: readonly Commit[];
  readonly currentBranch?: string;
  readonly headOid?: string;
  readonly upstream?: string;
  readonly selectedIsAncestorOfHead: boolean;
  readonly selectedIsAheadOfUpstream: boolean;
  readonly hasChild: boolean;
  readonly repositoryHasCommits: boolean;
  readonly operationInProgress: boolean;
}

export interface ActionAvailability {
  readonly copyRevision: boolean;
  readonly createPatch: boolean;
  readonly cherryPick: boolean;
  readonly showRepositoryAtRevision: boolean;
  readonly compareVersions: boolean;
  readonly reset: boolean;
  readonly revert: boolean;
  readonly drop: boolean;
  readonly squash: boolean;
  readonly pushUpTo: boolean;
  readonly newBranch: boolean;
  readonly newTag: boolean;
  readonly goToChild: boolean;
  readonly goToParent: boolean;
  readonly viewInBrowser: boolean;
}

export type OperationPhase = "idle" | "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface OperationState {
  readonly requestId?: string;
  readonly phase: OperationPhase;
  readonly label?: string;
  readonly progress?: number;
  readonly error?: string;
}

export interface ConsoleEntry {
  readonly id: string;
  readonly requestId: string | null;
  readonly command: string;
  readonly startedAt: number;
  readonly duration?: number;
  readonly exitCode?: number;
  readonly status: "running" | "success" | "failure" | "cancelled";
  readonly chunks: readonly ConsoleChunk[];
}

export interface ConsoleChunk {
  readonly sequence: number;
  readonly stream: OutputStream;
  readonly data: string;
}

export interface RepositoryView {
  readonly snapshot: RepositorySnapshot;
  readonly refs: readonly Ref[];
  readonly commits: readonly Commit[];
  readonly status: StatusModel;
}
