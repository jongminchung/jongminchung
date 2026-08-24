import type { GitExecutionRequest } from "../shared/contracts/git-request";
import type {
  GitChangelist as ElectronChangelist,
  GitChangelistCommitResult as ElectronChangelistCommitResult,
  GitConflictContent as ElectronConflictContent,
  GitConflictFile as ElectronConflictFile,
  GitCreationEventListener,
  GitEventListener,
  GitLocalHistoryActivitiesPage as ElectronLocalHistoryActivitiesPage,
  GitLocalHistoryActivity as ElectronLocalHistoryActivity,
  GitLocalHistoryActivityDetail as ElectronLocalHistoryActivityDetail,
  GitLocalHistoryScope as ElectronLocalHistoryScope,
  GitMultiRootOutcome as ElectronMultiRootOutcome,
  GitMultiRootResult as ElectronMultiRootResult,
  GitPatchExportResult as ElectronPatchExportResult,
  GitRecoveryEntry as ElectronRecoveryEntry,
  GitRecoveryRestoreResult as ElectronRecoveryRestoreResult,
  GitRequestId,
  GitShelfEntry as ElectronShelfEntry,
  GitSubmoduleDiff as ElectronSubmoduleDiff,
  GitTerminalEvent,
  RepositoryRecord,
} from "../shared/contracts/git-utility";
import type {
  BranchComparison,
  CloneOptions,
  CommitSignature,
  FileContent,
  FilePreview,
  FileSource,
  GitConfig,
  GitOperation,
  HistoryRewritePreview,
  IgnoreRules,
  MultiRootRollbackStep,
  PreCommitCheck,
  PushPreview,
  RemoteInfo,
  RepositoryChangedEvent,
  RepositorySnapshot,
  SubmoduleInfo,
  WorktreeInfo,
} from "../shared/contracts/model/index";

export interface ElectronGitApi {
  openRepository(path: string): Promise<RepositoryRecord>;
  initializeRepository(
    path: string,
    bare: boolean,
    listener?: GitCreationEventListener,
  ): Promise<RepositoryRecord>;
  cloneRepository(
    url: string,
    path: string,
    options: CloneOptions,
    listener?: GitCreationEventListener,
  ): Promise<RepositoryRecord>;
  inspectSnapshot(repositoryId: string): Promise<RepositorySnapshot>;
  compareBranches(
    repositoryId: string,
    left: string,
    right: string,
  ): Promise<BranchComparison>;
  preCommitCheck(repositoryId: string): Promise<PreCommitCheck>;
  listGitConfig(repositoryId: string): Promise<readonly GitConfig[]>;
  listSubmodules(repositoryId: string): Promise<readonly SubmoduleInfo[]>;
  listMergedBranches(
    repositoryId: string,
    target: string,
  ): Promise<readonly string[]>;
  loadCommitSignature(
    repositoryId: string,
    revision: string,
  ): Promise<CommitSignature>;
  listRemotes(repositoryId: string): Promise<readonly RemoteInfo[]>;
  listWorktrees(repositoryId: string): Promise<readonly WorktreeInfo[]>;
  readIgnoreRules(repositoryId: string): Promise<IgnoreRules>;
  writeIgnoreRules(repositoryId: string, rules: IgnoreRules): Promise<void>;
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
  exportPatch(
    repositoryId: string,
    revisions: readonly string[],
    targetPath: string,
  ): Promise<ElectronPatchExportResult>;
  createPatchText(
    repositoryId: string,
    revisions: readonly string[],
  ): Promise<string>;
  importPatch(repositoryId: string, path: string): Promise<void>;
  createShelf(
    repositoryId: string,
    message: string,
    paths: readonly string[],
  ): Promise<ElectronShelfEntry>;
  listShelves(repositoryId: string): Promise<readonly ElectronShelfEntry[]>;
  applyShelf(
    repositoryId: string,
    shelfId: string,
    dropAfterApply: boolean,
  ): Promise<void>;
  deleteShelf(repositoryId: string, shelfId: string): Promise<void>;
  listChangelists(repositoryId: string): Promise<readonly ElectronChangelist[]>;
  saveChangelist(
    repositoryId: string,
    id: string | null,
    name: string,
    paths: readonly string[],
  ): Promise<ElectronChangelist>;
  deleteChangelist(repositoryId: string, changelistId: string): Promise<void>;
  commitChangelist(
    repositoryId: string,
    changelistId: string,
    message: string,
    amend: boolean,
    signOff: boolean,
    gpgSign: boolean,
  ): Promise<ElectronChangelistCommitResult>;
  listRecoveryEntries(
    repositoryId: string,
  ): Promise<readonly ElectronRecoveryEntry[]>;
  restoreRecoveryEntry(
    repositoryId: string,
    entryId: string,
  ): Promise<ElectronRecoveryRestoreResult>;
  listLocalHistoryActivities?(
    scope: ElectronLocalHistoryScope,
    cursor: string | null,
    limit: number,
    query: string,
    showSystemEvents: boolean,
  ): Promise<ElectronLocalHistoryActivitiesPage>;
  readLocalHistoryActivity?(
    repositoryId: string,
    activityId: string,
  ): Promise<ElectronLocalHistoryActivityDetail>;
  readLocalHistoryDiff?(
    repositoryId: string,
    activityId: string,
    path: string,
  ): Promise<string>;
  revertLocalHistory?(
    repositoryId: string,
    activityId: string,
    paths: readonly string[],
    includeLater: boolean,
  ): Promise<void>;
  createLocalHistoryPatch?(
    repositoryId: string,
    activityId: string,
    paths: readonly string[],
  ): Promise<string>;
  putLocalHistoryLabel?(
    repositoryId: string,
    label: string,
  ): Promise<ElectronLocalHistoryActivity>;
  listConflicts(repositoryId: string): Promise<readonly ElectronConflictFile[]>;
  readConflict(
    repositoryId: string,
    path: string,
  ): Promise<ElectronConflictContent>;
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
    activityName?: string,
  ): Promise<void>;
  loadSubmoduleDiff(
    repositoryId: string,
    before: FileSource,
    after: FileSource,
    path: string,
  ): Promise<ElectronSubmoduleDiff>;
  openWorkingTreeFile(repositoryId: string, path: string): Promise<void>;
  executeSynchronizedBranchOperation(
    repositoryIds: readonly string[],
    gitOperation: GitOperation,
  ): Promise<ElectronMultiRootResult>;
  applyMultiRootRollback(
    steps: readonly MultiRootRollbackStep[],
  ): Promise<readonly ElectronMultiRootOutcome[]>;
  watchRepository(
    repositoryId: string,
    listener: (event: RepositoryChangedEvent) => void,
  ): Promise<void>;
  unwatchRepository(repositoryId: string): Promise<void>;
  closeRepository(repositoryId: string): Promise<boolean>;
  executeQuery(
    request: GitExecutionRequest,
    listener: GitEventListener,
  ): Promise<GitTerminalEvent>;
  cancelQuery(requestId: GitRequestId): Promise<boolean>;
}
