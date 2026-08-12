import type {
  HostingAccount,
  HostingProviderKind,
  HostingRequest,
  HostingResponse,
} from "../../../electron/hosting/hosting-contract";
import type {
  FileContent,
  FilePreview,
  FileSource,
  GitBranchComparison,
  GitChangelist,
  GitChangelistCommitResult,
  GitCloneOptions,
  GitCommitSignature,
  GitConfigEntry,
  GitConflictContent,
  GitConflictFile,
  GitCreationEventListener,
  GitEventListener,
  GitExecutionRequest,
  GitHistoryRewritePreview,
  GitIgnoreRules,
  GitLocalHistoryActivitiesPage,
  GitLocalHistoryActivity,
  GitLocalHistoryActivityDetail,
  GitLocalHistoryScope,
  GitMultiRootOutcome,
  GitMultiRootResult,
  GitMultiRootRollbackStep,
  GitPatchExportResult,
  GitPreCommitCheck,
  GitPushPreview,
  GitRecoveryEntry,
  GitRecoveryRestoreResult,
  GitRemoteInfo,
  GitRequestId,
  GitShelfEntry,
  GitSubmoduleDiff,
  GitSubmoduleInfo,
  GitTerminalEvent,
  GitWorktreeInfo,
  RepositoryChangedListener,
  RepositoryId,
  RepositoryRecord,
  RepositorySnapshot,
} from "./git-utility";
import type {
  CommandLineLauncherInfo,
  DiagnosticConfigurationKind,
  DiagnosticLeftoverDirectory,
  DiagnosticPathKind,
  DiagnosticSnapshot,
  DialogRequest,
  DialogSelection,
  HtmlExportRequest,
  JsonValue,
  NativeCommand,
  NativeCommandState,
  OfflineInspectionFile,
  PatchTextExportRequest,
  RuntimeInfo,
  WindowPresentationMode,
} from "./ipc";
import type { GitOperation } from "./model";
import type {
  TerminalEventListener,
  TerminalId,
  TerminalLaunchTarget,
  TerminalLaunchTargets,
} from "./terminal";

export interface DesktopApi {
  readonly runtime: {
    readonly qaFixture: boolean;
    getInfo(): Promise<RuntimeInfo>;
    getCommandLineLauncherInfo(): Promise<CommandLineLauncherInfo>;
  };
  readonly window: {
    getFullScreen(): Promise<boolean>;
    setFullScreen(value: boolean): Promise<void>;
    setPresentationMode(mode: WindowPresentationMode): Promise<void>;
  };
  readonly maintenance: {
    relaunch(invalidateCaches: boolean): Promise<void>;
  };
  readonly diagnostics: {
    snapshot(): Promise<DiagnosticSnapshot>;
    reveal(kind: DiagnosticPathKind): Promise<void>;
    collectLogs(): Promise<boolean>;
    dumpThreads(): Promise<string>;
    readConfiguration(kind: DiagnosticConfigurationKind): Promise<string>;
    writeConfiguration(kind: DiagnosticConfigurationKind, content: string): Promise<void>;
    openKeyboardShortcutsPdf(): Promise<void>;
    listLeftoverDirectories(): Promise<readonly DiagnosticLeftoverDirectory[]>;
    deleteLeftoverDirectories(ids: readonly string[]): Promise<readonly string[]>;
  };
  readonly export: {
    html(request: HtmlExportRequest): Promise<boolean>;
    patchText(request: PatchTextExportRequest): Promise<boolean>;
  };
  readonly analysis: {
    openOfflineInspection(): Promise<readonly OfflineInspectionFile[] | null>;
  };
  readonly settings: {
    get(key: string): Promise<JsonValue | null>;
    set(key: string, value: JsonValue): Promise<void>;
    delete(key: string): Promise<void>;
    exportArchive?(): Promise<boolean>;
    importArchive?(): Promise<boolean>;
  };
  readonly dialog: {
    openDirectory(request: DialogRequest): Promise<DialogSelection>;
    openFile(request: DialogRequest): Promise<DialogSelection>;
    saveFile(request: DialogRequest): Promise<DialogSelection>;
  };
  readonly shell: {
    openExternal(url: string): Promise<void>;
  };
  readonly clipboard: {
    readText(): Promise<string>;
    writeText(text: string): Promise<void>;
  };
  readonly menu: {
    onCommand(listener: (command: NativeCommand) => void): () => void;
    syncState(states: readonly NativeCommandState[]): Promise<void>;
  };
  readonly git: {
    openRepository(path: string): Promise<RepositoryRecord>;
    initializeRepository(
      path: string,
      bare: boolean,
      listener?: GitCreationEventListener,
    ): Promise<RepositoryRecord>;
    cloneRepository(
      url: string,
      path: string,
      options: GitCloneOptions,
      listener?: GitCreationEventListener,
    ): Promise<RepositoryRecord>;
    closeRepository(repositoryId: RepositoryId): Promise<boolean>;
    inspectSnapshot(repositoryId: RepositoryId): Promise<RepositorySnapshot>;
    compareBranches(
      repositoryId: RepositoryId,
      left: string,
      right: string,
    ): Promise<GitBranchComparison>;
    preCommitCheck(repositoryId: RepositoryId): Promise<GitPreCommitCheck>;
    listGitConfig(repositoryId: RepositoryId): Promise<readonly GitConfigEntry[]>;
    listSubmodules(repositoryId: RepositoryId): Promise<readonly GitSubmoduleInfo[]>;
    listMergedBranches(repositoryId: RepositoryId, target: string): Promise<readonly string[]>;
    loadCommitSignature(repositoryId: RepositoryId, revision: string): Promise<GitCommitSignature>;
    listRemotes(repositoryId: RepositoryId): Promise<readonly GitRemoteInfo[]>;
    listWorktrees(repositoryId: RepositoryId): Promise<readonly GitWorktreeInfo[]>;
    readIgnoreRules(repositoryId: RepositoryId): Promise<GitIgnoreRules>;
    writeIgnoreRules(repositoryId: RepositoryId, rules: GitIgnoreRules): Promise<void>;
    loadPushPreview(
      repositoryId: RepositoryId,
      remote: string | null,
      remoteRef: string | null,
      localRevision: string,
    ): Promise<GitPushPreview>;
    loadHistoryRewritePreview(
      repositoryId: RepositoryId,
      fromRevision: string,
    ): Promise<GitHistoryRewritePreview>;
    exportPatch(
      repositoryId: RepositoryId,
      revisions: readonly string[],
      targetPath: string,
    ): Promise<GitPatchExportResult>;
    createPatchText(repositoryId: RepositoryId, revisions: readonly string[]): Promise<string>;
    importPatch(repositoryId: RepositoryId, path: string): Promise<void>;
    createShelf(
      repositoryId: RepositoryId,
      message: string,
      paths: readonly string[],
    ): Promise<GitShelfEntry>;
    listShelves(repositoryId: RepositoryId): Promise<readonly GitShelfEntry[]>;
    applyShelf(repositoryId: RepositoryId, shelfId: string, dropAfterApply: boolean): Promise<void>;
    deleteShelf(repositoryId: RepositoryId, shelfId: string): Promise<void>;
    listChangelists(repositoryId: RepositoryId): Promise<readonly GitChangelist[]>;
    saveChangelist(
      repositoryId: RepositoryId,
      id: string | null,
      name: string,
      paths: readonly string[],
    ): Promise<GitChangelist>;
    deleteChangelist(repositoryId: RepositoryId, changelistId: string): Promise<void>;
    commitChangelist(
      repositoryId: RepositoryId,
      changelistId: string,
      message: string,
      amend: boolean,
      signOff: boolean,
      gpgSign: boolean,
    ): Promise<GitChangelistCommitResult>;
    listRecoveryEntries(repositoryId: RepositoryId): Promise<readonly GitRecoveryEntry[]>;
    restoreRecoveryEntry(
      repositoryId: RepositoryId,
      entryId: string,
    ): Promise<GitRecoveryRestoreResult>;
    listLocalHistoryActivities(
      scope: GitLocalHistoryScope,
      cursor: string | null,
      limit: number,
      query: string,
      showSystemEvents: boolean,
    ): Promise<GitLocalHistoryActivitiesPage>;
    readLocalHistoryActivity(
      repositoryId: RepositoryId,
      activityId: string,
    ): Promise<GitLocalHistoryActivityDetail>;
    readLocalHistoryDiff(
      repositoryId: RepositoryId,
      activityId: string,
      path: string,
    ): Promise<string>;
    revertLocalHistory(
      repositoryId: RepositoryId,
      activityId: string,
      paths: readonly string[],
      includeLater: boolean,
    ): Promise<void>;
    createLocalHistoryPatch(
      repositoryId: RepositoryId,
      activityId: string,
      paths: readonly string[],
    ): Promise<string>;
    putLocalHistoryLabel(
      repositoryId: RepositoryId,
      label: string,
    ): Promise<GitLocalHistoryActivity>;
    listConflicts(repositoryId: RepositoryId): Promise<readonly GitConflictFile[]>;
    readConflict(repositoryId: RepositoryId, path: string): Promise<GitConflictContent>;
    writeConflictResult(
      repositoryId: RepositoryId,
      path: string,
      result: string,
      stage: boolean,
    ): Promise<void>;
    resolveBinaryConflict(
      repositoryId: RepositoryId,
      path: string,
      side: "ours" | "theirs",
    ): Promise<void>;
    executeQuery(
      request: GitExecutionRequest,
      listener: GitEventListener,
    ): Promise<GitTerminalEvent>;
    cancelQuery(requestId: GitRequestId): Promise<boolean>;
    readFile(repositoryId: RepositoryId, source: FileSource, path: string): Promise<FileContent>;
    readFilePreview(
      repositoryId: RepositoryId,
      source: FileSource,
      path: string,
    ): Promise<FilePreview>;
    writeWorkingTreeFile(
      repositoryId: RepositoryId,
      path: string,
      content: string,
      activityName?: string,
    ): Promise<void>;
    loadSubmoduleDiff(
      repositoryId: RepositoryId,
      before: FileSource,
      after: FileSource,
      path: string,
    ): Promise<GitSubmoduleDiff>;
    openWorkingTreeFile(repositoryId: RepositoryId, path: string): Promise<void>;
    executeSynchronizedBranchOperation(
      repositoryIds: readonly RepositoryId[],
      gitOperation: GitOperation,
    ): Promise<GitMultiRootResult>;
    applyMultiRootRollback(
      steps: readonly GitMultiRootRollbackStep[],
    ): Promise<readonly GitMultiRootOutcome[]>;
    watchRepository(repositoryId: RepositoryId, listener: RepositoryChangedListener): Promise<void>;
    unwatchRepository(repositoryId: RepositoryId): Promise<void>;
  };
  readonly terminal: {
    listLaunchTargets(): Promise<TerminalLaunchTargets>;
    create(
      repositoryId: RepositoryId,
      cols: number,
      rows: number,
      target: TerminalLaunchTarget,
      listener: TerminalEventListener,
    ): Promise<TerminalId>;
    write(terminalId: TerminalId, data: string): Promise<void>;
    resize(terminalId: TerminalId, cols: number, rows: number): Promise<void>;
    close(terminalId: TerminalId): Promise<void>;
    closeRepository(repositoryId: RepositoryId): Promise<void>;
  };
  readonly hosting: {
    saveAccount(
      provider: HostingProviderKind,
      baseUrl: string,
      token: string,
    ): Promise<HostingAccount>;
    restoreAccounts(accounts: readonly HostingAccount[]): Promise<void>;
    deleteAccount(accountId: string): Promise<void>;
    execute(accountId: string, request: HostingRequest): Promise<HostingResponse>;
  };
}
