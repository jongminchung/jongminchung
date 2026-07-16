import { Channel, invoke } from "@tauri-apps/api/core";
import type {
    Changelist,
    ChangelistCommitResult,
    ConflictContent,
    ConflictFile,
    FileContent,
    FileSource,
    GitEvent,
    GitOperation,
    GitRequest,
    MultiRootOutcome,
    MultiRootResult,
    MultiRootRollbackStep,
    RecoveryEntry,
    RecoveryRestoreResult,
    RemoteInfo,
    RepositoryChangedEvent,
    RepositorySnapshot,
    RequestId,
    ShelfEntry,
    WorktreeInfo,
} from "../generated";

export interface GitBridge {
    openRepository(path: string): Promise<RepositorySnapshot>;
    initializeRepository(
        path: string,
        bare: boolean,
    ): Promise<RepositorySnapshot>;
    cloneRepository(
        url: string,
        path: string,
        depth: number | null,
    ): Promise<RepositorySnapshot>;
    refreshRepository(repositoryId: string): Promise<RepositorySnapshot>;
    readFile(
        repositoryId: string,
        source: FileSource,
        path: string,
    ): Promise<FileContent>;
    openWorkingTreeFile(repositoryId: string, path: string): Promise<void>;
    execute(
        request: GitRequest,
        onEvent: (event: GitEvent) => void,
    ): Promise<RequestId>;
    cancel(requestId: RequestId): Promise<void>;
    createShelf(
        repositoryId: string,
        message: string,
        paths: readonly string[],
    ): Promise<ShelfEntry>;
    listShelves(repositoryId: string): Promise<readonly ShelfEntry[]>;
    applyShelf(
        repositoryId: string,
        shelfId: string,
        dropAfterApply: boolean,
    ): Promise<void>;
    deleteShelf(repositoryId: string, shelfId: string): Promise<void>;
    watchRepository(
        repositoryId: string,
        onEvent: (event: RepositoryChangedEvent) => void,
    ): Promise<void>;
    unwatchRepository(repositoryId: string): Promise<void>;
    listChangelists(repositoryId: string): Promise<readonly Changelist[]>;
    saveChangelist(
        repositoryId: string,
        id: string | null,
        name: string,
        paths: readonly string[],
    ): Promise<Changelist>;
    deleteChangelist(repositoryId: string, changelistId: string): Promise<void>;
    commitChangelist(
        repositoryId: string,
        changelistId: string,
        message: string,
        amend: boolean,
        signOff: boolean,
        gpgSign: boolean,
    ): Promise<ChangelistCommitResult>;
    listRecoveryEntries(
        repositoryId: string,
    ): Promise<readonly RecoveryEntry[]>;
    restoreRecoveryEntry(
        repositoryId: string,
        entryId: string,
    ): Promise<RecoveryRestoreResult>;
    listConflicts(repositoryId: string): Promise<readonly ConflictFile[]>;
    readConflict(repositoryId: string, path: string): Promise<ConflictContent>;
    writeConflictResult(
        repositoryId: string,
        path: string,
        result: string,
        stage: boolean,
    ): Promise<void>;
    resolveBinaryConflict(
        repositoryId: string,
        path: string,
        side: "ours" | "theirs",
    ): Promise<void>;
    listRemotes(repositoryId: string): Promise<readonly RemoteInfo[]>;
    listWorktrees(repositoryId: string): Promise<readonly WorktreeInfo[]>;
    executeSynchronizedBranchOperation(
        repositoryIds: readonly string[],
        operation: GitOperation,
    ): Promise<MultiRootResult>;
    applyMultiRootRollback(
        steps: readonly MultiRootRollbackStep[],
    ): Promise<readonly MultiRootOutcome[]>;
}

export class TauriGitBridge implements GitBridge {
    readonly #watchChannels = new Map<
        string,
        Channel<RepositoryChangedEvent>
    >();

    openRepository(path: string): Promise<RepositorySnapshot> {
        return invoke("open_repository", { path });
    }

    initializeRepository(
        path: string,
        bare: boolean,
    ): Promise<RepositorySnapshot> {
        return invoke("initialize_repository", { path, bare });
    }

    cloneRepository(
        url: string,
        path: string,
        depth: number | null,
    ): Promise<RepositorySnapshot> {
        return invoke("clone_repository", { url, path, depth });
    }

    refreshRepository(repositoryId: string): Promise<RepositorySnapshot> {
        return invoke("refresh_repository", { repositoryId });
    }

    readFile(
        repositoryId: string,
        source: FileSource,
        path: string,
    ): Promise<FileContent> {
        return invoke("read_file", { repositoryId, source, path });
    }

    openWorkingTreeFile(repositoryId: string, path: string): Promise<void> {
        return invoke("open_working_tree_file", { repositoryId, path });
    }

    execute(
        request: GitRequest,
        onEvent: (event: GitEvent) => void,
    ): Promise<RequestId> {
        const channel = new Channel<GitEvent>();
        channel.onmessage = onEvent;
        return invoke("execute", { request, onEvent: channel });
    }

    cancel(requestId: RequestId): Promise<void> {
        return invoke("cancel", { requestId });
    }

    createShelf(
        repositoryId: string,
        message: string,
        paths: readonly string[],
    ): Promise<ShelfEntry> {
        return invoke("create_shelf", { repositoryId, message, paths });
    }

    listShelves(repositoryId: string): Promise<readonly ShelfEntry[]> {
        return invoke("list_shelves", { repositoryId });
    }

    applyShelf(
        repositoryId: string,
        shelfId: string,
        dropAfterApply: boolean,
    ): Promise<void> {
        return invoke("apply_shelf", { repositoryId, shelfId, dropAfterApply });
    }

    deleteShelf(repositoryId: string, shelfId: string): Promise<void> {
        return invoke("delete_shelf", { repositoryId, shelfId });
    }

    async watchRepository(
        repositoryId: string,
        onEvent: (event: RepositoryChangedEvent) => void,
    ): Promise<void> {
        const channel = new Channel<RepositoryChangedEvent>();
        channel.onmessage = onEvent;
        this.#watchChannels.set(repositoryId, channel);
        await invoke("watch_repository", { repositoryId, onEvent: channel });
    }

    async unwatchRepository(repositoryId: string): Promise<void> {
        await invoke("unwatch_repository", { repositoryId });
        this.#watchChannels.delete(repositoryId);
    }

    listChangelists(repositoryId: string): Promise<readonly Changelist[]> {
        return invoke("list_changelists", { repositoryId });
    }

    saveChangelist(
        repositoryId: string,
        id: string | null,
        name: string,
        paths: readonly string[],
    ): Promise<Changelist> {
        return invoke("save_changelist", { repositoryId, id, name, paths });
    }

    deleteChangelist(
        repositoryId: string,
        changelistId: string,
    ): Promise<void> {
        return invoke("delete_changelist", { repositoryId, changelistId });
    }

    commitChangelist(
        repositoryId: string,
        changelistId: string,
        message: string,
        amend: boolean,
        signOff: boolean,
        gpgSign: boolean,
    ): Promise<ChangelistCommitResult> {
        return invoke("commit_changelist", {
            repositoryId,
            changelistId,
            options: { message, amend, signOff, gpgSign },
        });
    }

    listRecoveryEntries(
        repositoryId: string,
    ): Promise<readonly RecoveryEntry[]> {
        return invoke("list_recovery_entries", { repositoryId });
    }

    restoreRecoveryEntry(
        repositoryId: string,
        entryId: string,
    ): Promise<RecoveryRestoreResult> {
        return invoke("restore_recovery_entry", { repositoryId, entryId });
    }

    listConflicts(repositoryId: string): Promise<readonly ConflictFile[]> {
        return invoke("list_conflicts", { repositoryId });
    }

    readConflict(repositoryId: string, path: string): Promise<ConflictContent> {
        return invoke("read_conflict", { repositoryId, path });
    }

    writeConflictResult(
        repositoryId: string,
        path: string,
        result: string,
        stage: boolean,
    ): Promise<void> {
        return invoke("write_conflict_result", {
            repositoryId,
            path,
            result,
            stage,
        });
    }

    resolveBinaryConflict(
        repositoryId: string,
        path: string,
        side: "ours" | "theirs",
    ): Promise<void> {
        return invoke("resolve_binary_conflict", { repositoryId, path, side });
    }

    listRemotes(repositoryId: string): Promise<readonly RemoteInfo[]> {
        return invoke("list_remotes", { repositoryId });
    }

    listWorktrees(repositoryId: string): Promise<readonly WorktreeInfo[]> {
        return invoke("list_worktrees", { repositoryId });
    }

    executeSynchronizedBranchOperation(
        repositoryIds: readonly string[],
        operation: GitOperation,
    ): Promise<MultiRootResult> {
        return invoke("execute_synchronized_branch_operation", {
            repositoryIds,
            operation,
        });
    }

    applyMultiRootRollback(
        steps: readonly MultiRootRollbackStep[],
    ): Promise<readonly MultiRootOutcome[]> {
        return invoke("apply_multi_root_rollback", { steps });
    }
}

export function isTauriRuntime(): boolean {
    return "__TAURI_INTERNALS__" in window;
}
