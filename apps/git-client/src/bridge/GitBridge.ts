import type {
    Changelist,
    ChangelistCommitResult,
    BranchComparison,
    CloneOptions,
    ConflictContent,
    ConflictFile,
    FileContent,
    FilePreview,
    FileSource,
    GitEvent,
    GitConfig,
    GitOperation,
    IgnoreRules,
    GitRequest,
    MultiRootOutcome,
    MultiRootResult,
    MultiRootRollbackStep,
    PatchExportResult,
    PreCommitCheck,
    PushPreview,
    HistoryRewritePreview,
    RecoveryEntry,
    RecoveryRestoreResult,
    RemoteInfo,
    RepositoryChangedEvent,
    RepositorySnapshot,
    RequestId,
    ShelfEntry,
    SubmoduleInfo,
    SubmoduleDiff,
    CommitSignature,
    WorktreeInfo,
} from "../generated";
import type { GitCreationEventListener } from "../shared/contracts/git-utility";
import type { GitLocalHistoryEntry } from "../shared/contracts/git-utility";

export interface GitBridge {
    openRepository(path: string): Promise<RepositorySnapshot>;
    initializeRepository(
        path: string,
        bare: boolean,
        onEvent?: GitCreationEventListener,
    ): Promise<RepositorySnapshot>;
    cloneRepository(
        url: string,
        path: string,
        options: CloneOptions,
        onEvent?: GitCreationEventListener,
    ): Promise<RepositorySnapshot>;
    refreshRepository(repositoryId: string): Promise<RepositorySnapshot>;
    loadPushPreview(
        repositoryId: string,
        remote: string | null,
        remoteRef: string | null,
        localRevision: string,
    ): Promise<PushPreview>;
    loadHistoryRewritePreview(
        repositoryId: string,
        fromRevision: string,
    ): Promise<HistoryRewritePreview>;
    preCommitCheck(repositoryId: string): Promise<PreCommitCheck>;
    compareBranches(
        repositoryId: string,
        left: string,
        right: string,
    ): Promise<BranchComparison>;
    loadCommitSignature(
        repositoryId: string,
        revision: string,
    ): Promise<CommitSignature>;
    listGitConfig(repositoryId: string): Promise<readonly GitConfig[]>;
    listSubmodules(repositoryId: string): Promise<readonly SubmoduleInfo[]>;
    listMergedBranches(
        repositoryId: string,
        target: string,
    ): Promise<readonly string[]>;
    readIgnoreRules(repositoryId: string): Promise<IgnoreRules>;
    writeIgnoreRules(repositoryId: string, rules: IgnoreRules): Promise<void>;
    exportPatch(
        repositoryId: string,
        revisions: readonly string[],
        targetPath: string,
    ): Promise<PatchExportResult>;
    createPatchText(
        repositoryId: string,
        revisions: readonly string[],
    ): Promise<string>;
    importPatch(repositoryId: string, path: string): Promise<void>;
    readFile(
        repositoryId: string,
        source: FileSource,
        path: string,
    ): Promise<FileContent>;
    readFilePreview(
        repositoryId: string,
        source: FileSource,
        path: string,
    ): Promise<FilePreview>;
    writeWorkingTreeFile?(
        repositoryId: string,
        path: string,
        content: string,
    ): Promise<void>;
    loadSubmoduleDiff(
        repositoryId: string,
        before: FileSource,
        after: FileSource,
        path: string,
    ): Promise<SubmoduleDiff>;
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
    captureLocalHistory?(
        repositoryId: string,
        label: string | null,
    ): Promise<GitLocalHistoryEntry>;
    listLocalHistory?(
        repositoryId: string,
        path: string | null,
    ): Promise<readonly GitLocalHistoryEntry[]>;
    readLocalHistoryDiff?(
        repositoryId: string,
        entryId: string,
        path: string,
    ): Promise<string>;
    restoreLocalHistory?(
        repositoryId: string,
        entryId: string,
        path: string,
    ): Promise<void>;
    labelLocalHistory?(
        repositoryId: string,
        entryId: string,
        label: string,
    ): Promise<GitLocalHistoryEntry>;
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
