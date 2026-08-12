import type { GitActivity } from "../../../domain/gitActivity";
import type { GitConsoleEntry } from "../../../domain/gitConsole";
import type {
    ProjectSearchOptions,
    ProjectTextMatch,
} from "../../../domain/projectSearch";
import type { RepositoryAccessMode } from "../../../domain/repositoryAccess";
import type {
    BlameLine,
    Commit,
    FileChange,
    RepositoryView,
    StashEntry,
    TreeEntry,
} from "../../../domain/types";
import type {
    GitLocalHistoryActivitiesPage,
    GitLocalHistoryActivity,
    GitLocalHistoryActivityDetail,
    GitLocalHistoryScope,
} from "../../../shared/contracts/git-utility";
import type {
    AbortableOperation,
    BranchComparison,
    Changelist,
    ChangelistCommitResult,
    CommitSignature,
    ConflictContent,
    ConflictFile,
    DiffOptions,
    FileContent,
    FilePreview,
    FileSource,
    GitConfig,
    GitOperation,
    HistoryRewritePreview,
    IgnoreRules,
    LogFilters,
    LogOrder,
    MultiRootOutcome,
    MultiRootResult,
    MultiRootRollbackStep,
    PatchExportResult,
    PreCommitCheck,
    PushPreview,
    RecoveryEntry,
    RemoteInfo,
    ShelfEntry,
    SubmoduleDiff,
    SubmoduleInfo,
    WorktreeInfo,
} from "../../../shared/contracts/model";
import type { TerminalAvailability } from "../../terminal/ports/TerminalAvailability";
import type {
    RepositoryErrorSession,
    WorkspaceRepositorySession,
    WorkspaceTab,
} from "../state/GitSessionState";

export interface GitSessionCapabilities {
    readonly terminal: TerminalAvailability;
    readonly workspace: {
        readonly sessions: readonly WorkspaceRepositorySession[];
        readonly activeTab: WorkspaceTab;
        readonly restoring: boolean;
        readonly error: string | null;
    };
    readonly repository: {
        readonly fixture: boolean;
        readonly accessMode: RepositoryAccessMode;
        readonly repository: RepositoryView | null;
        readonly repositoryError: RepositoryErrorSession | null;
        readonly loading: boolean;
        readonly stale: boolean;
        readonly hasMoreCommits: boolean;
        readonly logLoading: boolean;
        readonly logError: string | null;
        readonly shelves: readonly ShelfEntry[];
        readonly stashes: readonly StashEntry[];
        readonly changelists: readonly Changelist[];
        readonly recoveryEntries: readonly RecoveryEntry[];
        readonly conflicts: readonly ConflictFile[];
        readonly remotes: readonly RemoteInfo[];
        readonly worktrees: readonly WorktreeInfo[];
    };
    readonly queries: {
        readonly reload: () => Promise<void>;
        readonly loadLog: (
            filters: LogFilters,
            order: LogOrder,
            append: boolean,
        ) => Promise<void>;
        readonly indexLog: (
            filters: LogFilters,
            order: LogOrder,
        ) => Promise<void>;
        readonly loadCommitFiles: (
            revision: string,
        ) => Promise<readonly FileChange[]>;
        readonly loadCommitDiff: (
            commit: Commit,
            path: string,
            options: DiffOptions,
            parentRevision?: string,
        ) => Promise<string>;
        readonly loadWorkingDiff: (
            path: string,
            staged: boolean,
            options: DiffOptions,
        ) => Promise<string>;
        readonly loadLocalChangesPatch: () => Promise<string>;
        readonly loadRevisionDiff: (
            from: string,
            to: string | null,
            options: DiffOptions,
            paths?: readonly string[],
        ) => Promise<string>;
        readonly listLocalHistoryActivities: (
            scope: GitLocalHistoryScope,
            cursor: string | null,
            limit: number,
            query: string,
            showSystemEvents: boolean,
        ) => Promise<GitLocalHistoryActivitiesPage>;
        readonly readLocalHistoryActivity: (
            activityId: string,
        ) => Promise<GitLocalHistoryActivityDetail>;
        readonly loadLocalHistoryDiff: (
            activityId: string,
            path: string,
        ) => Promise<string>;
        readonly createLocalHistoryPatch: (
            activityId: string,
            paths: readonly string[],
        ) => Promise<string>;
        readonly exportPatch: (
            revisions: readonly string[],
            targetPath: string,
        ) => Promise<PatchExportResult>;
        readonly createPatchText: (
            revisions: readonly string[],
        ) => Promise<string>;
        readonly loadFiles: () => Promise<readonly string[]>;
        readonly searchProjectText: (
            query: string,
            options: ProjectSearchOptions,
        ) => Promise<readonly ProjectTextMatch[]>;
        readonly loadTree: (
            revision: string,
            path?: string,
        ) => Promise<readonly TreeEntry[]>;
        readonly loadFileHistory: (path: string) => Promise<readonly Commit[]>;
        readonly loadBlame: (
            path: string,
            revision?: string,
        ) => Promise<readonly BlameLine[]>;
        readonly readFile: (
            source: FileSource,
            path: string,
        ) => Promise<FileContent>;
        readonly readFilePreview: (
            source: FileSource,
            path: string,
        ) => Promise<FilePreview>;
        readonly loadSubmoduleDiff: (
            before: FileSource,
            after: FileSource,
            path: string,
        ) => Promise<SubmoduleDiff>;
        readonly openWorkingTreeFile: (path: string) => Promise<void>;
        readonly loadStashFiles: (
            stash: string,
        ) => Promise<readonly FileChange[]>;
        readonly loadStashPatch: (stash: string) => Promise<string>;
        readonly loadPushPreview: (
            remote?: string | null,
            remoteRef?: string | null,
            localRevision?: string,
        ) => Promise<PushPreview>;
        readonly loadHistoryRewritePreview: (
            fromRevision: string,
        ) => Promise<HistoryRewritePreview>;
        readonly preCommitCheck: () => Promise<PreCommitCheck>;
        readonly loadGitConfig: () => Promise<readonly GitConfig[]>;
        readonly loadSubmodules: () => Promise<readonly SubmoduleInfo[]>;
        readonly loadMergedBranches: (
            target: string,
        ) => Promise<readonly string[]>;
        readonly readIgnoreRules: () => Promise<IgnoreRules>;
        readonly compareBranches: (
            left: string,
            right: string,
        ) => Promise<BranchComparison>;
        readonly loadCommitSignature: (
            revision: string,
        ) => Promise<CommitSignature>;
        readonly readConflict: (path: string) => Promise<ConflictContent>;
    };
    readonly mutations: {
        readonly revertLocalHistory: (
            activityId: string,
            paths: readonly string[],
            includeLater: boolean,
        ) => Promise<void>;
        readonly putLocalHistoryLabel: (
            label: string,
        ) => Promise<GitLocalHistoryActivity>;
        readonly importPatch: (path: string) => Promise<void>;
        readonly writeWorkingTreeFile: (
            path: string,
            content: string,
            activityName?: string,
        ) => Promise<void>;
        readonly executeOperation: (
            operation: GitOperation,
            throwOnError?: boolean,
        ) => Promise<void>;
        readonly abortOperation: (
            operation: AbortableOperation,
        ) => Promise<void>;
        readonly createShelf: (
            message: string,
            paths: readonly string[],
        ) => Promise<void>;
        readonly applyShelf: (
            shelfId: string,
            dropAfterApply: boolean,
        ) => Promise<void>;
        readonly deleteShelf: (shelfId: string) => Promise<void>;
        readonly saveChangelist: (
            id: string | null,
            name: string,
            paths: readonly string[],
        ) => Promise<Changelist>;
        readonly deleteChangelist: (changelistId: string) => Promise<void>;
        readonly commitChangelist: (
            changelistId: string,
            message: string,
            amend: boolean,
            signOff: boolean,
            gpgSign: boolean,
        ) => Promise<ChangelistCommitResult>;
        readonly writeIgnoreRules: (rules: IgnoreRules) => Promise<void>;
        readonly restoreRecoveryEntry: (entryId: string) => Promise<void>;
        readonly saveConflictResult: (
            path: string,
            result: string,
            stage: boolean,
        ) => Promise<void>;
        readonly resolveBinaryConflict: (
            path: string,
            side: "ours" | "theirs",
        ) => Promise<void>;
        readonly executeSynchronizedBranchOperation: (
            repositoryIds: readonly string[],
            operation: GitOperation,
        ) => Promise<MultiRootResult>;
        readonly applyMultiRootRollback: (
            steps: readonly MultiRootRollbackStep[],
        ) => Promise<readonly MultiRootOutcome[]>;
    };
    readonly activity: {
        readonly current: GitActivity | null;
        readonly gitConsoleEntries: readonly GitConsoleEntry[];
        readonly cancel: () => Promise<void>;
        readonly retry: () => Promise<void>;
        readonly dismiss: (activityId?: string) => void;
        readonly clearConsole: (repositoryId?: string) => void;
    };
}
