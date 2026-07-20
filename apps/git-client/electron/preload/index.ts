import { contextBridge, ipcRenderer } from "electron";
import { z } from "zod";
import type {
  GitCloneOptions,
  GitCloneRepositoryRequest,
  GitCreationEvent,
  GitCreationEventListener,
  GitEventListener,
  GitExecutionRequest,
  GitRequestEvent,
  GitRequestId,
  GitTerminalEvent,
  GitInitializeRepositoryRequest,
  RepositoryChangedListener,
  RepositoryId,
  RepositoryRecord,
} from "../../src/shared/contracts/git-utility";
import {
  GitCloneRepositoryRequestSchema,
  FileContentSchema,
  FilePreviewSchema,
  GitReadFileRequestSchema,
  GitRepositoryServiceRequestSchema,
  GitRepositoryServiceResultSchema,
  GitCreationEventSchema,
  GitInitializeRepositoryRequestSchema,
  GitExecutionRequestSchema,
  GitRequestEventSchema,
  OpenRepositoryRequestSchema,
  RepositoryRecordSchema,
  RepositorySnapshotSchema,
  GitWatchRepositoryRequestSchema,
  GitWorkingTreeFileRequestSchema,
  GitWriteWorkingTreeFileRequestSchema,
  RepositoryChangedEventSchema,
  type GitRepositoryServiceResult,
} from "../../src/shared/contracts/git-utility";
import { QA_FIXTURE_RENDERER_ARGUMENT } from "../../src/shared/contracts/ipc";
import type {
  DesktopApi,
  JsonValue,
  NativeCommand,
  NativeCommandState,
} from "../../src/shared/contracts/ipc";
import {
  DialogSelectionSchema,
  ClipboardTextSchema,
  CommandLineLauncherInfoSchema,
  DiagnosticConfigurationKindSchema,
  DiagnosticConfigurationWriteRequestSchema,
  DiagnosticDeleteLeftoverDirectoriesRequestSchema,
  DiagnosticDeletedLeftoverDirectoryIdsSchema,
  DiagnosticLeftoverDirectoriesSchema,
  DiagnosticPathKindSchema,
  DiagnosticSnapshotSchema,
  ExternalUrlSchema,
  GitCancelQueryRequestSchema,
  GitCloseRepositoryRequestSchema,
  GitRepositoryRequestSchema,
  GitTerminalResultSchema,
  HtmlExportRequestSchema,
  HostingDeleteAccountRequestSchema,
  HostingExecuteRequestSchema,
  HostingRestoreAccountsRequestSchema,
  HostingSaveAccountRequestSchema,
  IPC_CHANNELS,
  JsonValueSchema,
  MaintenanceRelaunchRequestSchema,
  NativeCommandSchema,
  OfflineInspectionFilesSchema,
  PatchTextExportRequestSchema,
  RuntimeInfoSchema,
  WindowPresentationModeSchema,
} from "../../src/shared/contracts/ipc";
import type {
  TerminalClientEvent,
  TerminalEventListener,
  TerminalRequestId,
} from "../../src/shared/contracts/terminal";
import {
  TerminalCloseRepositoryRequestSchema,
  TerminalCloseRequestSchema,
  TerminalCreateRequestSchema,
  TerminalCreateResultSchema,
  TerminalEventEnvelopeSchema,
  TerminalLaunchTargetsSchema,
  TerminalListLaunchTargetsRequestSchema,
  TerminalResizeRequestSchema,
  TerminalWriteRequestSchema,
} from "../../src/shared/contracts/terminal";
import {
  HostingAccountSchema,
  HostingResponseKindByRequest,
  HostingResponseSchema,
} from "../hosting/hosting-contract";

const BooleanResultSchema = z.boolean();
const DiagnosticConfigurationTextSchema = z.string().max(1_048_576);
const DiagnosticPathResultSchema = z.string().min(1).max(32_768);
const gitQueryListeners = new Map<GitRequestId, GitEventListener>();
const gitQueryTerminalWaiters = new Map<GitRequestId, () => void>();
const gitCreationListeners = new Map<GitRequestId, GitCreationEventListener>();
const repositoryChangedListeners = new Map<RepositoryId, RepositoryChangedListener>();
const terminalListeners = new Map<TerminalRequestId, TerminalEventListener>();
const terminalRequests = new Map<string, TerminalRequestId>();

function deliverGitEvent(listener: GitEventListener, event: GitRequestEvent): void {
  try {
    listener(event);
  } catch {
    // A renderer callback cannot be allowed to interrupt IPC cleanup or later query events.
  }
}

ipcRenderer.on(IPC_CHANNELS.gitQueryEvent, (_event, raw: unknown): void => {
  const gitEvent = GitRequestEventSchema.parse(raw);
  const listener = gitQueryListeners.get(gitEvent.requestId);
  if (listener === undefined) return;
  deliverGitEvent(listener, gitEvent);
  if (
    gitEvent.kind === "completed" ||
    gitEvent.kind === "failed" ||
    gitEvent.kind === "cancelled"
  ) {
    gitQueryTerminalWaiters.get(gitEvent.requestId)?.();
    gitQueryTerminalWaiters.delete(gitEvent.requestId);
    gitQueryListeners.delete(gitEvent.requestId);
  }
});

async function waitForGitTerminalEvent(terminalEvent: Promise<void>): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    terminalEvent,
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, 100);
    }),
  ]);
  if (timeout !== undefined) clearTimeout(timeout);
}

function deliverGitCreationEvent(
  listener: GitCreationEventListener,
  event: GitCreationEvent,
): void {
  try {
    listener(event);
  } catch {
    // A renderer callback cannot interrupt IPC cleanup or later creation events.
  }
}

ipcRenderer.on(IPC_CHANNELS.gitCreationEvent, (_event, raw: unknown): void => {
  const creationEvent = GitCreationEventSchema.parse(raw);
  const listener = gitCreationListeners.get(creationEvent.requestId);
  if (listener === undefined) return;
  deliverGitCreationEvent(listener, creationEvent);
  if (
    creationEvent.kind === "completed" ||
    creationEvent.kind === "failed" ||
    creationEvent.kind === "cancelled"
  ) {
    gitCreationListeners.delete(creationEvent.requestId);
  }
});

ipcRenderer.on(IPC_CHANNELS.gitRepositoryChanged, (_event, raw: unknown): void => {
  const repositoryEvent = RepositoryChangedEventSchema.parse(raw);
  const listener = repositoryChangedListeners.get(repositoryEvent.repositoryId);
  if (listener === undefined) return;
  try {
    listener(repositoryEvent);
  } catch {
    // A renderer callback cannot interrupt watcher cleanup or future repository events.
  }
});

async function invokeRepositoryCreation(
  channel: typeof IPC_CHANNELS.gitInitializeRepository | typeof IPC_CHANNELS.gitCloneRepository,
  request: GitInitializeRepositoryRequest | GitCloneRepositoryRequest,
  listener: GitCreationEventListener | undefined,
): Promise<RepositoryRecord> {
  if (listener !== undefined) {
    if (gitCreationListeners.has(request.requestId)) {
      throw new Error(`Git request ${request.requestId} is already running in this renderer`);
    }
    gitCreationListeners.set(request.requestId, listener);
  }
  try {
    const raw: unknown = await ipcRenderer.invoke(channel, request);
    return RepositoryRecordSchema.parse(raw);
  } finally {
    if (listener !== undefined && gitCreationListeners.get(request.requestId) === listener) {
      gitCreationListeners.delete(request.requestId);
    }
  }
}

async function invokeRepositoryService(
  untrustedRequest: unknown,
): Promise<GitRepositoryServiceResult> {
  const request = GitRepositoryServiceRequestSchema.parse(untrustedRequest);
  const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.gitRepositoryService, request);
  const result = GitRepositoryServiceResultSchema.parse(raw);
  if (result.operation !== request.operation) {
    throw new Error("Repository service result did not match its request");
  }
  return result;
}

function terminalClientEvent(
  event: ReturnType<typeof TerminalEventEnvelopeSchema.parse>,
): TerminalClientEvent {
  switch (event.kind) {
    case "output":
      return {
        kind: "output",
        sequence: event.sequence,
        data: [...event.data],
      };
    case "exited":
      return {
        kind: "exited",
        exitCode: event.exitCode,
        signal: event.signal,
      };
    case "failed":
      return { kind: "failed", message: event.message };
  }
}

ipcRenderer.on(IPC_CHANNELS.terminalEvent, (_event, raw: unknown): void => {
  const event = TerminalEventEnvelopeSchema.parse(raw);
  const listener = terminalListeners.get(event.requestId);
  if (listener === undefined) return;
  try {
    listener(terminalClientEvent(event));
  } catch {
    // Renderer callbacks cannot interrupt terminal lifecycle cleanup or future events.
  }
  if (event.kind === "exited" || event.kind === "failed") {
    terminalListeners.delete(event.requestId);
    terminalRequests.delete(event.terminalId);
  }
});

const api: DesktopApi = {
  runtime: {
    qaFixture: process.argv.includes(QA_FIXTURE_RENDERER_ARGUMENT),
    async getInfo() {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.runtimeInfo);
      return RuntimeInfoSchema.parse(raw);
    },
    async getCommandLineLauncherInfo() {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.runtimeLauncherInfo);
      return CommandLineLauncherInfoSchema.parse(raw);
    },
  },
  window: {
    async getFullScreen(): Promise<boolean> {
      return (await ipcRenderer.invoke(IPC_CHANNELS.windowGetFullScreen)) === true;
    },
    async setFullScreen(value: boolean): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.windowSetFullScreen, value === true);
    },
    async setPresentationMode(mode): Promise<void> {
      await ipcRenderer.invoke(
        IPC_CHANNELS.windowSetPresentationMode,
        WindowPresentationModeSchema.parse(mode),
      );
    },
  },
  maintenance: {
    async relaunch(invalidateCaches: boolean): Promise<void> {
      await ipcRenderer.invoke(
        IPC_CHANNELS.maintenanceRelaunch,
        MaintenanceRelaunchRequestSchema.parse({ invalidateCaches }),
      );
    },
  },
  diagnostics: {
    async snapshot() {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.diagnosticsSnapshot);
      return DiagnosticSnapshotSchema.parse(raw);
    },
    async reveal(kind): Promise<void> {
      await ipcRenderer.invoke(
        IPC_CHANNELS.diagnosticsReveal,
        DiagnosticPathKindSchema.parse(kind),
      );
    },
    async collectLogs(): Promise<boolean> {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.diagnosticsCollectLogs);
      return BooleanResultSchema.parse(raw);
    },
    async dumpThreads(): Promise<string> {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.diagnosticsDumpThreads);
      return DiagnosticPathResultSchema.parse(raw);
    },
    async readConfiguration(kind) {
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.diagnosticsReadConfiguration,
        DiagnosticConfigurationKindSchema.parse(kind),
      );
      return DiagnosticConfigurationTextSchema.parse(raw);
    },
    async writeConfiguration(kind, content): Promise<void> {
      await ipcRenderer.invoke(
        IPC_CHANNELS.diagnosticsWriteConfiguration,
        DiagnosticConfigurationWriteRequestSchema.parse({
          kind,
          content,
        }),
      );
    },
    async openKeyboardShortcutsPdf(): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.diagnosticsKeyboardShortcutsPdf);
    },
    async listLeftoverDirectories() {
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.diagnosticsListLeftoverDirectories,
      );
      return DiagnosticLeftoverDirectoriesSchema.parse(raw);
    },
    async deleteLeftoverDirectories(ids) {
      const request = DiagnosticDeleteLeftoverDirectoriesRequestSchema.parse({ ids });
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.diagnosticsDeleteLeftoverDirectories,
        request,
      );
      return DiagnosticDeletedLeftoverDirectoryIdsSchema.parse(raw);
    },
  },
  export: {
    async html(request): Promise<boolean> {
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.exportHtml,
        HtmlExportRequestSchema.parse(request),
      );
      return BooleanResultSchema.parse(raw);
    },
    async patchText(request): Promise<boolean> {
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.exportPatchText,
        PatchTextExportRequestSchema.parse(request),
      );
      return BooleanResultSchema.parse(raw);
    },
  },
  analysis: {
    async openOfflineInspection() {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.analysisOpenOfflineInspection);
      return raw === null ? null : OfflineInspectionFilesSchema.parse(raw);
    },
  },
  settings: {
    async get(key: string): Promise<JsonValue | null> {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.settingsGet, { key });
      if (raw === null) return null;
      return JsonValueSchema.parse(raw);
    },
    async set(key: string, value: JsonValue): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.settingsSet, { key, value });
    },
    async delete(key: string): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.settingsDelete, { key });
    },
    async exportArchive(): Promise<boolean> {
      return (await ipcRenderer.invoke(IPC_CHANNELS.settingsExport)) === true;
    },
    async importArchive(): Promise<boolean> {
      return (await ipcRenderer.invoke(IPC_CHANNELS.settingsImport)) === true;
    },
  },
  dialog: {
    async openDirectory(request) {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.dialogOpenDirectory, request);
      return DialogSelectionSchema.parse(raw);
    },
    async openFile(request) {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.dialogOpenFile, request);
      return DialogSelectionSchema.parse(raw);
    },
    async saveFile(request) {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.dialogSaveFile, request);
      return DialogSelectionSchema.parse(raw);
    },
  },
  shell: {
    async openExternal(url: string): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.shellOpenExternal, ExternalUrlSchema.parse(url));
    },
  },
  clipboard: {
    async readText(): Promise<string> {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.clipboardReadText);
      return ClipboardTextSchema.parse(raw);
    },
    async writeText(text: string): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.clipboardWriteText, { text });
    },
  },
  menu: {
    onCommand(listener: (command: NativeCommand) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
        listener(NativeCommandSchema.parse(raw));
      };
      ipcRenderer.on(IPC_CHANNELS.menuCommand, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.menuCommand, handler);
    },
    async syncState(states: readonly NativeCommandState[]): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.menuSyncState, states);
    },
  },
  git: {
    async openRepository(path: string): Promise<RepositoryRecord> {
      const request = OpenRepositoryRequestSchema.parse({ path });
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.gitOpenRepository, request);
      return RepositoryRecordSchema.parse(raw);
    },
    async initializeRepository(
      path: string,
      bare: boolean,
      listener?: GitCreationEventListener,
    ): Promise<RepositoryRecord> {
      const request = GitInitializeRepositoryRequestSchema.parse({
        requestId: globalThis.crypto.randomUUID(),
        path,
        bare,
      });
      return invokeRepositoryCreation(IPC_CHANNELS.gitInitializeRepository, request, listener);
    },
    async cloneRepository(
      url: string,
      path: string,
      options: GitCloneOptions,
      listener?: GitCreationEventListener,
    ): Promise<RepositoryRecord> {
      const request = GitCloneRepositoryRequestSchema.parse({
        requestId: globalThis.crypto.randomUUID(),
        url,
        path,
        options,
      });
      return invokeRepositoryCreation(IPC_CHANNELS.gitCloneRepository, request, listener);
    },
    async closeRepository(repositoryId: RepositoryId): Promise<boolean> {
      const request = GitCloseRepositoryRequestSchema.parse({
        repositoryId,
      });
      try {
        const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.gitCloseRepository, request);
        return BooleanResultSchema.parse(raw);
      } finally {
        repositoryChangedListeners.delete(request.repositoryId);
      }
    },
    async inspectSnapshot(repositoryId) {
      const request = GitRepositoryRequestSchema.parse({ repositoryId });
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.gitInspectSnapshot, request);
      return RepositorySnapshotSchema.parse(raw);
    },
    async compareBranches(repositoryId, left, right) {
      const result = await invokeRepositoryService({
        operation: "compareBranches",
        repositoryId,
        left,
        right,
      });
      if (result.operation !== "compareBranches") throw new Error("Unexpected repository result");
      return result.value;
    },
    async preCommitCheck(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "preCommitCheck",
        repositoryId,
      });
      if (result.operation !== "preCommitCheck") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listGitConfig(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listGitConfig",
        repositoryId,
      });
      if (result.operation !== "listGitConfig") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listSubmodules(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listSubmodules",
        repositoryId,
      });
      if (result.operation !== "listSubmodules") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listMergedBranches(repositoryId, target) {
      const result = await invokeRepositoryService({
        operation: "listMergedBranches",
        repositoryId,
        target,
      });
      if (result.operation !== "listMergedBranches") {
        throw new Error("Unexpected repository result");
      }
      return result.value;
    },
    async loadCommitSignature(repositoryId, revision) {
      const result = await invokeRepositoryService({
        operation: "loadCommitSignature",
        repositoryId,
        revision,
      });
      if (result.operation !== "loadCommitSignature") {
        throw new Error("Unexpected repository result");
      }
      return result.value;
    },
    async listRemotes(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listRemotes",
        repositoryId,
      });
      if (result.operation !== "listRemotes") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listWorktrees(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listWorktrees",
        repositoryId,
      });
      if (result.operation !== "listWorktrees") throw new Error("Unexpected repository result");
      return result.value;
    },
    async readIgnoreRules(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "readIgnoreRules",
        repositoryId,
      });
      if (result.operation !== "readIgnoreRules") throw new Error("Unexpected repository result");
      return result.value;
    },
    async writeIgnoreRules(repositoryId, rules): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "writeIgnoreRules",
        repositoryId,
        rules,
      });
      if (result.operation !== "writeIgnoreRules") {
        throw new Error("Unexpected repository result");
      }
    },
    async loadPushPreview(repositoryId, remote, remoteRef, localRevision) {
      const result = await invokeRepositoryService({
        operation: "pushPreview",
        repositoryId,
        remote,
        remoteRef,
        localRevision,
      });
      if (result.operation !== "pushPreview") {
        throw new Error("Unexpected repository result");
      }
      return result.value;
    },
    async loadHistoryRewritePreview(repositoryId, fromRevision) {
      const result = await invokeRepositoryService({
        operation: "historyRewritePreview",
        repositoryId,
        fromRevision,
      });
      if (result.operation !== "historyRewritePreview") {
        throw new Error("Unexpected repository result");
      }
      return result.value;
    },
    async exportPatch(repositoryId, revisions, targetPath) {
      const result = await invokeRepositoryService({
        operation: "exportPatch",
        repositoryId,
        revisions,
        targetPath,
      });
      if (result.operation !== "exportPatch") throw new Error("Unexpected repository result");
      return result.value;
    },
    async createPatchText(repositoryId, revisions) {
      const result = await invokeRepositoryService({
        operation: "createPatchText",
        repositoryId,
        revisions,
      });
      if (result.operation !== "createPatchText") throw new Error("Unexpected repository result");
      return result.value;
    },
    async importPatch(repositoryId, path): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "importPatch",
        repositoryId,
        path,
      });
      if (result.operation !== "importPatch") throw new Error("Unexpected repository result");
    },
    async createShelf(repositoryId, message, paths) {
      const result = await invokeRepositoryService({
        operation: "createShelf",
        repositoryId,
        message,
        paths,
      });
      if (result.operation !== "createShelf") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listShelves(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listShelves",
        repositoryId,
      });
      if (result.operation !== "listShelves") throw new Error("Unexpected repository result");
      return result.value;
    },
    async applyShelf(repositoryId, shelfId, dropAfterApply): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "applyShelf",
        repositoryId,
        shelfId,
        dropAfterApply,
      });
      if (result.operation !== "applyShelf") throw new Error("Unexpected repository result");
    },
    async deleteShelf(repositoryId, shelfId): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "deleteShelf",
        repositoryId,
        shelfId,
      });
      if (result.operation !== "deleteShelf") throw new Error("Unexpected repository result");
    },
    async listChangelists(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listChangelists",
        repositoryId,
      });
      if (result.operation !== "listChangelists") throw new Error("Unexpected repository result");
      return result.value;
    },
    async saveChangelist(repositoryId, id, name, paths) {
      const result = await invokeRepositoryService({
        operation: "saveChangelist",
        repositoryId,
        id,
        name,
        paths,
      });
      if (result.operation !== "saveChangelist") throw new Error("Unexpected repository result");
      return result.value;
    },
    async deleteChangelist(repositoryId, changelistId): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "deleteChangelist",
        repositoryId,
        changelistId,
      });
      if (result.operation !== "deleteChangelist") throw new Error("Unexpected repository result");
    },
    async commitChangelist(repositoryId, changelistId, message, amend, signOff, gpgSign) {
      const result = await invokeRepositoryService({
        operation: "commitChangelist",
        repositoryId,
        changelistId,
        message,
        amend,
        signOff,
        gpgSign,
      });
      if (result.operation !== "commitChangelist") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listRecoveryEntries(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listRecoveryEntries",
        repositoryId,
      });
      if (result.operation !== "listRecoveryEntries")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async restoreRecoveryEntry(repositoryId, entryId) {
      const result = await invokeRepositoryService({
        operation: "restoreRecoveryEntry",
        repositoryId,
        entryId,
      });
      if (result.operation !== "restoreRecoveryEntry")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async listLocalHistoryActivities(scope, cursor, limit, query, showSystemEvents) {
      const result = await invokeRepositoryService({
        operation: "listLocalHistoryActivities",
        scope,
        cursor,
        limit,
        query,
        showSystemEvents,
      });
      if (result.operation !== "listLocalHistoryActivities")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async readLocalHistoryActivity(repositoryId, activityId) {
      const result = await invokeRepositoryService({
        operation: "readLocalHistoryActivity",
        repositoryId,
        activityId,
      });
      if (result.operation !== "readLocalHistoryActivity")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async readLocalHistoryDiff(repositoryId, activityId, path) {
      const result = await invokeRepositoryService({
        operation: "readLocalHistoryDiff",
        repositoryId,
        activityId,
        path,
      });
      if (result.operation !== "readLocalHistoryDiff")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async revertLocalHistory(repositoryId, activityId, paths, includeLater) {
      const result = await invokeRepositoryService({
        operation: "revertLocalHistory",
        repositoryId,
        activityId,
        paths,
        includeLater,
      });
      if (result.operation !== "revertLocalHistory")
        throw new Error("Unexpected repository result");
    },
    async createLocalHistoryPatch(repositoryId, activityId, paths) {
      const result = await invokeRepositoryService({
        operation: "createLocalHistoryPatch",
        repositoryId,
        activityId,
        paths,
      });
      if (result.operation !== "createLocalHistoryPatch")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async putLocalHistoryLabel(repositoryId, label) {
      const result = await invokeRepositoryService({
        operation: "putLocalHistoryLabel",
        repositoryId,
        label,
      });
      if (result.operation !== "putLocalHistoryLabel")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async listConflicts(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listConflicts",
        repositoryId,
      });
      if (result.operation !== "listConflicts") throw new Error("Unexpected repository result");
      return result.value;
    },
    async readConflict(repositoryId, path) {
      const result = await invokeRepositoryService({
        operation: "readConflict",
        repositoryId,
        path,
      });
      if (result.operation !== "readConflict") throw new Error("Unexpected repository result");
      return result.value;
    },
    async writeConflictResult(repositoryId, path, conflictResult, stage): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "writeConflictResult",
        repositoryId,
        path,
        result: conflictResult,
        stage,
      });
      if (result.operation !== "writeConflictResult")
        throw new Error("Unexpected repository result");
    },
    async resolveBinaryConflict(repositoryId, path, side): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "resolveBinaryConflict",
        repositoryId,
        path,
        side,
      });
      if (result.operation !== "resolveBinaryConflict")
        throw new Error("Unexpected repository result");
    },
    async executeQuery(
      untrustedRequest: GitExecutionRequest,
      listener: GitEventListener,
    ): Promise<GitTerminalEvent> {
      const request = GitExecutionRequestSchema.parse(untrustedRequest);
      if (gitQueryListeners.has(request.requestId)) {
        throw new Error(`Git request ${request.requestId} is already running in this renderer`);
      }
      let resolveTerminalEvent = (): void => undefined;
      const terminalEvent = new Promise<void>((resolve) => {
        resolveTerminalEvent = resolve;
      });
      gitQueryListeners.set(request.requestId, listener);
      gitQueryTerminalWaiters.set(request.requestId, resolveTerminalEvent);
      try {
        const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.gitQuery, request);
        const terminal = GitTerminalResultSchema.parse(raw);
        if (terminal.requestId !== request.requestId) {
          throw new Error("Git query result did not match its request");
        }
        await waitForGitTerminalEvent(terminalEvent);
        if (gitQueryListeners.get(request.requestId) === listener) {
          deliverGitEvent(listener, terminal);
        }
        return terminal;
      } finally {
        gitQueryTerminalWaiters.delete(request.requestId);
        if (gitQueryListeners.get(request.requestId) === listener) {
          gitQueryListeners.delete(request.requestId);
        }
      }
    },
    async cancelQuery(requestId: GitRequestId): Promise<boolean> {
      const request = GitCancelQueryRequestSchema.parse({ requestId });
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.gitCancelQuery, request);
      return BooleanResultSchema.parse(raw);
    },
    async readFile(repositoryId, source, path) {
      const request = GitReadFileRequestSchema.parse({
        repositoryId,
        source,
        path,
      });
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.gitReadFile, request);
      return FileContentSchema.parse(raw);
    },
    async readFilePreview(repositoryId, source, path) {
      const request = GitReadFileRequestSchema.parse({
        repositoryId,
        source,
        path,
      });
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.gitReadFilePreview, request);
      return FilePreviewSchema.parse(raw);
    },
    async writeWorkingTreeFile(repositoryId, path, content, activityName): Promise<void> {
      const request = GitWriteWorkingTreeFileRequestSchema.parse({
        repositoryId,
        path,
        content,
        activityName: activityName ?? null,
      });
      await ipcRenderer.invoke(IPC_CHANNELS.gitWriteWorkingTreeFile, request);
    },
    async loadSubmoduleDiff(repositoryId, before, after, path) {
      const result = await invokeRepositoryService({
        operation: "loadSubmoduleDiff",
        repositoryId,
        before,
        after,
        path,
      });
      if (result.operation !== "loadSubmoduleDiff") throw new Error("Unexpected repository result");
      return result.value;
    },
    async openWorkingTreeFile(repositoryId, path): Promise<void> {
      const request = GitWorkingTreeFileRequestSchema.parse({
        repositoryId,
        path,
      });
      await ipcRenderer.invoke(IPC_CHANNELS.gitOpenWorkingTreeFile, request);
    },
    async executeSynchronizedBranchOperation(repositoryIds, gitOperation) {
      const result = await invokeRepositoryService({
        operation: "executeSynchronizedBranchOperation",
        repositoryIds,
        gitOperation,
      });
      if (result.operation !== "executeSynchronizedBranchOperation")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async applyMultiRootRollback(steps) {
      const result = await invokeRepositoryService({
        operation: "applyMultiRootRollback",
        steps,
      });
      if (result.operation !== "applyMultiRootRollback")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async watchRepository(repositoryId, listener): Promise<void> {
      const request = GitWatchRepositoryRequestSchema.parse({
        repositoryId,
      });
      if (repositoryChangedListeners.has(request.repositoryId)) {
        repositoryChangedListeners.set(request.repositoryId, listener);
        return;
      }
      repositoryChangedListeners.set(request.repositoryId, listener);
      try {
        await ipcRenderer.invoke(IPC_CHANNELS.gitWatchRepository, request);
      } catch (error) {
        if (repositoryChangedListeners.get(request.repositoryId) === listener) {
          repositoryChangedListeners.delete(request.repositoryId);
        }
        throw error;
      }
    },
    async unwatchRepository(repositoryId): Promise<void> {
      const request = GitWatchRepositoryRequestSchema.parse({
        repositoryId,
      });
      try {
        await ipcRenderer.invoke(IPC_CHANNELS.gitUnwatchRepository, request);
      } finally {
        repositoryChangedListeners.delete(request.repositoryId);
      }
    },
  },
  terminal: {
    async listLaunchTargets() {
      const request = TerminalListLaunchTargetsRequestSchema.parse({});
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.terminalListLaunchTargets,
        request,
      );
      return TerminalLaunchTargetsSchema.parse(raw);
    },
    async create(repositoryId, cols, rows, target, listener) {
      const request = TerminalCreateRequestSchema.parse({
        requestId: globalThis.crypto.randomUUID(),
        repositoryId,
        cols,
        rows,
        target,
      });
      terminalListeners.set(request.requestId, listener);
      try {
        const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.terminalCreate, request);
        const result = TerminalCreateResultSchema.parse(raw);
        if (result.requestId !== request.requestId) {
          throw new Error("Terminal create result did not match its request");
        }
        if (terminalListeners.has(request.requestId)) {
          terminalRequests.set(result.terminalId, request.requestId);
        }
        return result.terminalId;
      } catch (error) {
        terminalListeners.delete(request.requestId);
        throw error;
      }
    },
    async write(terminalId, data): Promise<void> {
      const request = TerminalWriteRequestSchema.parse({
        terminalId,
        data,
      });
      await ipcRenderer.invoke(IPC_CHANNELS.terminalWrite, request);
    },
    async resize(terminalId, cols, rows): Promise<void> {
      const request = TerminalResizeRequestSchema.parse({
        terminalId,
        cols,
        rows,
      });
      await ipcRenderer.invoke(IPC_CHANNELS.terminalResize, request);
    },
    async close(terminalId): Promise<void> {
      const request = TerminalCloseRequestSchema.parse({ terminalId });
      try {
        await ipcRenderer.invoke(IPC_CHANNELS.terminalClose, request);
      } finally {
        const requestId = terminalRequests.get(request.terminalId);
        terminalRequests.delete(request.terminalId);
        if (requestId !== undefined) terminalListeners.delete(requestId);
      }
    },
    async closeRepository(repositoryId): Promise<void> {
      const request = TerminalCloseRepositoryRequestSchema.parse({
        repositoryId,
      });
      await ipcRenderer.invoke(IPC_CHANNELS.terminalCloseRepository, request);
    },
  },
  hosting: {
    async saveAccount(provider, baseUrl, token) {
      const request = HostingSaveAccountRequestSchema.parse({
        provider,
        baseUrl,
        token,
      });
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.hostingSaveAccount, request);
      const account = HostingAccountSchema.parse(raw);
      if (account.provider !== request.provider || account.baseUrl !== request.baseUrl) {
        throw new Error("Hosting account response did not match its request");
      }
      return account;
    },
    async restoreAccounts(accounts): Promise<void> {
      const request = HostingRestoreAccountsRequestSchema.parse({
        accounts,
      });
      await ipcRenderer.invoke(IPC_CHANNELS.hostingRestoreAccounts, request);
    },
    async deleteAccount(accountId): Promise<void> {
      const request = HostingDeleteAccountRequestSchema.parse({
        accountId,
      });
      await ipcRenderer.invoke(IPC_CHANNELS.hostingDeleteAccount, request);
    },
    async execute(accountId, untrustedRequest) {
      const request = HostingExecuteRequestSchema.parse({
        accountId,
        request: untrustedRequest,
      });
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.hostingExecute, request);
      const response = HostingResponseSchema.parse(raw);
      if (response.kind !== HostingResponseKindByRequest[request.request.kind]) {
        throw new Error("Hosting response did not match its request");
      }
      return response;
    },
  },
};

contextBridge.exposeInMainWorld("gitClient", api);
