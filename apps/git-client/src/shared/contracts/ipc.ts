import { z } from "zod";

export const QA_FIXTURE_RENDERER_ARGUMENT = "--git-client-qa-fixture";
import type {
  HostingAccount,
  HostingProviderKind,
  HostingRequest,
  HostingResponse,
} from "../../../electron/hosting/hosting-contract";
import {
  HostingAccountIdSchema,
  HostingAccountsSchema,
  HostingRequestSchema,
  SaveHostingAccountSchema,
} from "../../../electron/hosting/hosting-contract";
import type { GitOperation } from "../../shared/contracts/model";
import type {
  GitCloneOptions,
  GitCreationEventListener,
  GitEventListener,
  FileContent,
  FilePreview,
  FileSource,
  GitExecutionRequest,
  GitRequestId,
  GitBranchComparison,
  GitPreCommitCheck,
  GitConfigEntry,
  GitSubmoduleInfo,
  GitSubmoduleDiff,
  GitCommitSignature,
  GitRemoteInfo,
  GitWorktreeInfo,
  GitIgnoreRules,
  GitPushPreview,
  GitHistoryRewritePreview,
  GitMultiRootOutcome,
  GitMultiRootResult,
  GitMultiRootRollbackStep,
  GitPatchExportResult,
  GitShelfEntry,
  GitChangelist,
  GitChangelistCommitResult,
  GitRecoveryEntry,
  GitRecoveryRestoreResult,
  GitLocalHistoryScope,
  GitLocalHistoryActivitiesPage,
  GitLocalHistoryActivityDetail,
  GitLocalHistoryActivity,
  GitConflictFile,
  GitConflictContent,
  GitTerminalEvent,
  RepositoryId,
  RepositoryChangedListener,
  RepositoryRecord,
  RepositorySnapshot,
} from "./git-utility";
import {
  GitCancelledEventSchema,
  GitCompletedEventSchema,
  GitFailedEventSchema,
  GitRequestIdSchema,
  RepositoryIdSchema,
} from "./git-utility";
import type {
  TerminalEventListener,
  TerminalId,
  TerminalLaunchTarget,
  TerminalLaunchTargets,
} from "./terminal";

export const IPC_CHANNELS = {
  runtimeInfo: "git-client:runtime:info",
  runtimeLauncherInfo: "git-client:runtime:launcher-info",
  windowGetFullScreen: "git-client:window:get-full-screen",
  windowSetFullScreen: "git-client:window:set-full-screen",
  windowSetPresentationMode: "git-client:window:set-presentation-mode",
  maintenanceRelaunch: "git-client:maintenance:relaunch",
  diagnosticsSnapshot: "git-client:diagnostics:snapshot",
  diagnosticsReveal: "git-client:diagnostics:reveal",
  diagnosticsCollectLogs: "git-client:diagnostics:collect-logs",
  diagnosticsDumpThreads: "git-client:diagnostics:dump-threads",
  diagnosticsReadConfiguration: "git-client:diagnostics:read-configuration",
  diagnosticsWriteConfiguration: "git-client:diagnostics:write-configuration",
  diagnosticsKeyboardShortcutsPdf: "git-client:diagnostics:keyboard-shortcuts-pdf",
  diagnosticsListLeftoverDirectories: "git-client:diagnostics:list-leftover-directories",
  diagnosticsDeleteLeftoverDirectories: "git-client:diagnostics:delete-leftover-directories",
  exportHtml: "git-client:export:html",
  exportPatchText: "git-client:export:patch-text",
  analysisOpenOfflineInspection: "git-client:analysis:open-offline-inspection",
  settingsGet: "git-client:settings:get",
  settingsSet: "git-client:settings:set",
  settingsDelete: "git-client:settings:delete",
  settingsExport: "git-client:settings:export",
  settingsImport: "git-client:settings:import",
  dialogOpenDirectory: "git-client:dialog:open-directory",
  dialogOpenFile: "git-client:dialog:open-file",
  dialogSaveFile: "git-client:dialog:save-file",
  shellOpenExternal: "git-client:shell:open-external",
  clipboardWriteText: "git-client:clipboard:write-text",
  clipboardReadText: "git-client:clipboard:read-text",
  menuCommand: "git-client:menu:command",
  menuSyncState: "git-client:menu:sync-state",
  gitOpenRepository: "git-client:git:open-repository",
  gitInitializeRepository: "git-client:git:initialize-repository",
  gitCloneRepository: "git-client:git:clone-repository",
  gitCreationEvent: "git-client:git:creation-event",
  gitCloseRepository: "git-client:git:close-repository",
  gitInspectSnapshot: "git-client:git:inspect-snapshot",
  gitRepositoryService: "git-client:git:repository-service",
  gitQuery: "git-client:git:query",
  gitQueryEvent: "git-client:git:query-event",
  gitCancelQuery: "git-client:git:cancel-query",
  gitReadFile: "git-client:git:read-file",
  gitReadFilePreview: "git-client:git:read-file-preview",
  gitWriteWorkingTreeFile: "git-client:git:write-working-tree-file",
  gitOpenWorkingTreeFile: "git-client:git:open-working-tree-file",
  gitWatchRepository: "git-client:git:watch-repository",
  gitUnwatchRepository: "git-client:git:unwatch-repository",
  gitRepositoryChanged: "git-client:git:repository-changed",
  terminalCreate: "git-client:terminal:create",
  terminalListLaunchTargets: "git-client:terminal:list-launch-targets",
  terminalEvent: "git-client:terminal:event",
  terminalWrite: "git-client:terminal:write",
  terminalResize: "git-client:terminal:resize",
  terminalClose: "git-client:terminal:close",
  terminalCloseRepository: "git-client:terminal:close-repository",
  hostingSaveAccount: "git-client:hosting:save-account",
  hostingRestoreAccounts: "git-client:hosting:restore-accounts",
  hostingDeleteAccount: "git-client:hosting:delete-account",
  hostingExecute: "git-client:hosting:execute",
} as const;

export const WindowPresentationModeSchema = z.enum(["welcome", "workspace"]);
export type WindowPresentationMode = z.infer<typeof WindowPresentationModeSchema>;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export const JsonValueSchema = z.json();
export type JsonValue = z.infer<typeof JsonValueSchema>;

export const RuntimeInfoSchema = z.object({
  kind: z.literal("electron"),
  appVersion: z.string().min(1),
  electronVersion: z.string().min(1),
  platform: z.string().min(1),
  architecture: z.string().min(1),
  qaFixture: z.boolean(),
});
export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;

export const CommandLineLauncherInfoSchema = z
  .object({
    directory: z.string().min(1).max(32_768),
    command: z.string().min(1).max(256),
  })
  .strict()
  .readonly();
export type CommandLineLauncherInfo = z.infer<typeof CommandLineLauncherInfoSchema>;

export const SettingsKeySchema = z.string().min(1).max(256);
export const SettingsGetRequestSchema = z.object({ key: SettingsKeySchema });
export const SettingsSetRequestSchema = z.object({
  key: SettingsKeySchema,
  value: JsonValueSchema,
});
export const SettingsDeleteRequestSchema = z.object({ key: SettingsKeySchema });

export const DialogRequestSchema = z.object({
  title: z.string().min(1).max(256),
  defaultPath: z.string().min(1).nullable(),
  filters: z
    .array(
      z.object({
        name: z.string().min(1).max(128),
        extensions: z.array(z.string().min(1).max(32)).max(32),
      }),
    )
    .max(32),
});
export type DialogRequest = z.infer<typeof DialogRequestSchema>;

export const DialogSelectionSchema = z.string().min(1).nullable();
export type DialogSelection = z.infer<typeof DialogSelectionSchema>;

export const ExternalUrlSchema = z
  .url()
  .max(2_048)
  .refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === ""
    );
  }, "Only credential-free HTTP or HTTPS URLs are allowed");

export const ClipboardWriteRequestSchema = z.object({
  text: z.string().max(1_000_000),
});

export const MaintenanceRelaunchRequestSchema = z
  .object({ invalidateCaches: z.boolean() })
  .strict()
  .readonly();

export const DiagnosticPathKindSchema = z.enum([
  "logs",
  "settings",
  "caches",
  "crashDumps",
  "customProperties",
  "vmOptions",
]);
export type DiagnosticPathKind = z.infer<typeof DiagnosticPathKindSchema>;

export const DiagnosticConfigurationKindSchema = z.enum([
  "debugLog",
  "customProperties",
  "vmOptions",
]);
export type DiagnosticConfigurationKind = z.infer<typeof DiagnosticConfigurationKindSchema>;

export const DiagnosticConfigurationWriteRequestSchema = z
  .object({
    kind: DiagnosticConfigurationKindSchema,
    content: z.string().max(1_048_576),
  })
  .strict()
  .readonly();

export const DiagnosticProcessSchema = z
  .object({
    pid: z.number().int().positive(),
    type: z.string().min(1).max(128),
    cpuPercent: z.number().finite().nonnegative(),
    memoryBytes: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
export type DiagnosticProcess = z.infer<typeof DiagnosticProcessSchema>;

export const DiagnosticSnapshotSchema = z
  .object({
    capturedAt: z.string().datetime(),
    uptimeSeconds: z.number().finite().nonnegative(),
    processes: z.array(DiagnosticProcessSchema).max(128).readonly(),
  })
  .strict()
  .readonly();
export type DiagnosticSnapshot = z.infer<typeof DiagnosticSnapshotSchema>;

export const DiagnosticLeftoverDirectoryIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^Git Client Electron(?:$|[ -][A-Za-z0-9 ._-]+)$/u,
    "Leftover directory IDs must identify a Git Client Electron profile",
  );

export const DiagnosticLeftoverDirectorySchema = z
  .object({
    id: DiagnosticLeftoverDirectoryIdSchema,
    name: z.string().min(1).max(128),
    lastModifiedMs: z.number().int().nonnegative(),
    sizeBytes: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
export type DiagnosticLeftoverDirectory = z.infer<typeof DiagnosticLeftoverDirectorySchema>;

export const DiagnosticLeftoverDirectoriesSchema = z
  .array(DiagnosticLeftoverDirectorySchema)
  .max(32)
  .readonly();

export const DiagnosticDeleteLeftoverDirectoriesRequestSchema = z
  .object({
    ids: z
      .array(DiagnosticLeftoverDirectoryIdSchema)
      .min(1)
      .max(32)
      .refine((ids) => new Set(ids).size === ids.length, "Leftover directory IDs must be unique"),
  })
  .strict()
  .readonly();

export const DiagnosticDeletedLeftoverDirectoryIdsSchema = z
  .array(DiagnosticLeftoverDirectoryIdSchema)
  .max(32)
  .readonly();

const HtmlExportPathSchema = z
  .string()
  .min(1)
  .max(1_024)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    "HTML export paths must be safe relative POSIX paths",
  );

export const HtmlExportRequestSchema = z
  .object({
    files: z
      .array(
        z
          .object({
            path: HtmlExportPathSchema,
            content: z.string().max(5_242_880),
          })
          .strict()
          .readonly(),
      )
      .min(1)
      .max(1_000),
    includeLineNumbers: z.boolean(),
    openInBrowser: z.boolean(),
  })
  .strict()
  .readonly()
  .refine(
    (value) => value.files.reduce((total, file) => total + file.content.length, 0) <= 20_971_520,
    "HTML export content exceeds 20 MiB",
  );
export type HtmlExportRequest = z.infer<typeof HtmlExportRequestSchema>;

export const PatchTextExportRequestSchema = z
  .object({
    defaultName: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => !value.includes("/") && !value.includes("\\") && !value.includes("\0")),
    content: z.string().min(1).max(16_777_216),
  })
  .strict()
  .readonly();
export type PatchTextExportRequest = z.infer<typeof PatchTextExportRequestSchema>;

export const ClipboardTextSchema = z.string().max(16_777_216);

export const OfflineInspectionFilesSchema = z
  .array(
    z
      .object({
        name: z.string().min(1).max(512),
        content: z.string().max(5_242_880),
      })
      .strict()
      .readonly(),
  )
  .max(100)
  .refine(
    (files) => files.reduce((total, file) => total + file.content.length, 0) <= 20_971_520,
    "Offline inspection results exceed 20 MiB",
  );
export type OfflineInspectionFile = z.infer<typeof OfflineInspectionFilesSchema>[number];

export const NativeCommandSchema = z.object({
  id: z.string().min(1).max(256),
});
export type NativeCommand = z.infer<typeof NativeCommandSchema>;

export const NativeCommandStateSchema = z.object({
  id: z.string().min(1).max(256),
  label: z.string().min(1).max(256).optional(),
  enabled: z.boolean(),
  visible: z.boolean(),
  checked: z.boolean().nullable(),
  accelerator: z.string().min(1).max(128).nullable(),
});
export type NativeCommandState = z.infer<typeof NativeCommandStateSchema>;

export const NativeCommandStatesSchema = z.array(NativeCommandStateSchema).max(1_000);

export const GitRepositoryRequestSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
  })
  .strict()
  .readonly();

export const GitCloseRepositoryRequestSchema = GitRepositoryRequestSchema;

export const GitCancelQueryRequestSchema = z
  .object({
    requestId: GitRequestIdSchema,
  })
  .strict()
  .readonly();

export const GitTerminalResultSchema = z
  .discriminatedUnion("kind", [
    GitCompletedEventSchema,
    GitFailedEventSchema,
    GitCancelledEventSchema,
  ])
  .readonly();

export const HostingSaveAccountRequestSchema = SaveHostingAccountSchema;

export const HostingRestoreAccountsRequestSchema = z
  .object({ accounts: HostingAccountsSchema })
  .strict()
  .readonly();

export const HostingDeleteAccountRequestSchema = z
  .object({ accountId: HostingAccountIdSchema })
  .strict()
  .readonly();

export const HostingExecuteRequestSchema = z
  .object({
    accountId: HostingAccountIdSchema,
    request: HostingRequestSchema,
  })
  .strict()
  .readonly();

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
