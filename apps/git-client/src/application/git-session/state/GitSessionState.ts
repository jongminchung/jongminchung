import type { RecentProject } from "../../../domain/recentProjects";
import type { RepositoryView, StashEntry } from "../../../domain/types";
import type {
    Changelist,
    ConflictFile,
    RecoveryEntry,
    RemoteInfo,
    ShelfEntry,
    WorktreeInfo,
} from "../../../shared/contracts/model";

export type WorkspaceTab =
    | { readonly kind: "welcome" }
    | { readonly kind: "repository"; readonly repositoryId: string }
    | { readonly kind: "error"; readonly sessionId: string };

export interface RepositorySession {
    readonly kind: "repository";
    readonly status: "loading" | "ready";
    readonly repository: RepositoryView;
    readonly shelves: readonly ShelfEntry[];
    readonly stashes: readonly StashEntry[];
    readonly changelists: readonly Changelist[];
    readonly recoveryEntries: readonly RecoveryEntry[];
    readonly conflicts: readonly ConflictFile[];
    readonly remotes: readonly RemoteInfo[];
    readonly worktrees: readonly WorktreeInfo[];
    readonly stale: boolean;
    readonly hasMoreCommits: boolean;
    readonly logLoading: boolean;
    readonly logError: string | null;
    readonly error: string | null;
}

export interface RepositoryErrorSession {
    readonly kind: "error";
    readonly status: "error";
    readonly id: string;
    readonly path: string;
    readonly message: string;
}

export type WorkspaceRepositorySession =
    | RepositorySession
    | RepositoryErrorSession;

export interface WorkspaceState {
    readonly sessions: readonly WorkspaceRepositorySession[];
    readonly activeTab: WorkspaceTab;
    readonly recentProjects: readonly RecentProject[];
    readonly restoring: boolean;
    readonly error: string | null;
    readonly notice?: string | null;
}
