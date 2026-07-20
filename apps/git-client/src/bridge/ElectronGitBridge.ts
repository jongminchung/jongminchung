import {
  GitExecutionRequestSchema,
  type GitExecutionRequest,
} from "../shared/contracts/git-request";
import type {
  GitEventListener,
  GitCreationEventListener,
  GitRequestEvent,
  GitRequestId,
  GitTerminalEvent,
  GitPatchExportResult as ElectronPatchExportResult,
  GitShelfEntry as ElectronShelfEntry,
  GitChangelist as ElectronChangelist,
  GitChangelistCommitResult as ElectronChangelistCommitResult,
  GitRecoveryEntry as ElectronRecoveryEntry,
  GitRecoveryRestoreResult as ElectronRecoveryRestoreResult,
  GitLocalHistoryScope as ElectronLocalHistoryScope,
  GitLocalHistoryActivitiesPage as ElectronLocalHistoryActivitiesPage,
  GitLocalHistoryActivityDetail as ElectronLocalHistoryActivityDetail,
  GitLocalHistoryActivity as ElectronLocalHistoryActivity,
  GitConflictFile as ElectronConflictFile,
  GitConflictContent as ElectronConflictContent,
  GitSubmoduleDiff as ElectronSubmoduleDiff,
  GitMultiRootOutcome as ElectronMultiRootOutcome,
  GitMultiRootResult as ElectronMultiRootResult,
  RepositoryRecord,
} from "../shared/contracts/git-utility";
import {
  GitLocalHistoryActivitiesPageSchema,
  GitLocalHistoryActivityDetailSchema,
  GitLocalHistoryActivitySchema,
} from "../shared/contracts/git-utility";
import type {
  BranchComparison,
  Changelist,
  ChangelistCommitResult,
  CloneOptions,
  CommitSignature,
  ConflictContent,
  ConflictFile,
  FileContent,
  FilePreview,
  FileSource,
  GitConfig,
  GitEvent,
  GitOperation,
  GitRequest,
  HistoryRewritePreview,
  IgnoreRules,
  MultiRootOutcome,
  MultiRootResult,
  MultiRootRollbackStep,
  PatchExportResult,
  PreCommitCheck,
  PushPreview,
  RecoveryEntry,
  RecoveryRestoreResult,
  RemoteInfo,
  RepositoryChangedEvent,
  RepositorySnapshot,
  RequestId,
  ShelfEntry,
  SubmoduleDiff,
  SubmoduleInfo,
  WorktreeInfo,
} from "../shared/contracts/model";
import type { GitBridge } from "./GitBridge";

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
  compareBranches(repositoryId: string, left: string, right: string): Promise<BranchComparison>;
  preCommitCheck(repositoryId: string): Promise<PreCommitCheck>;
  listGitConfig(repositoryId: string): Promise<readonly GitConfig[]>;
  listSubmodules(repositoryId: string): Promise<readonly SubmoduleInfo[]>;
  listMergedBranches(repositoryId: string, target: string): Promise<readonly string[]>;
  loadCommitSignature(repositoryId: string, revision: string): Promise<CommitSignature>;
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
  createPatchText(repositoryId: string, revisions: readonly string[]): Promise<string>;
  importPatch(repositoryId: string, path: string): Promise<void>;
  createShelf(
    repositoryId: string,
    message: string,
    paths: readonly string[],
  ): Promise<ElectronShelfEntry>;
  listShelves(repositoryId: string): Promise<readonly ElectronShelfEntry[]>;
  applyShelf(repositoryId: string, shelfId: string, dropAfterApply: boolean): Promise<void>;
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
  listRecoveryEntries(repositoryId: string): Promise<readonly ElectronRecoveryEntry[]>;
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
  readLocalHistoryDiff?(repositoryId: string, activityId: string, path: string): Promise<string>;
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
  putLocalHistoryLabel?(repositoryId: string, label: string): Promise<ElectronLocalHistoryActivity>;
  listConflicts(repositoryId: string): Promise<readonly ElectronConflictFile[]>;
  readConflict(repositoryId: string, path: string): Promise<ElectronConflictContent>;
  writeConflictResult(
    repositoryId: string,
    path: string,
    result: string,
    stage: boolean,
  ): Promise<void>;
  resolveBinaryConflict(repositoryId: string, path: string, side: "ours" | "theirs"): Promise<void>;
  readFile(repositoryId: string, source: FileSource, path: string): Promise<FileContent>;
  readFilePreview(repositoryId: string, source: FileSource, path: string): Promise<FilePreview>;
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
  executeQuery(request: GitExecutionRequest, listener: GitEventListener): Promise<GitTerminalEvent>;
  cancelQuery(requestId: GitRequestId): Promise<boolean>;
}

export function translateGitRequest(
  request: GitRequest,
  requestId: GitRequestId,
): GitExecutionRequest {
  return GitExecutionRequestSchema.parse({ ...request, requestId });
}

function asGeneratedEvent(event: GitRequestEvent): GitEvent {
  switch (event.kind) {
    case "started":
    case "output":
    case "completed":
      return event;
    case "failed":
      return {
        kind: "failed",
        requestId: event.requestId,
        message: event.message,
        exitCode: event.exitCode,
        durationMs: event.durationMs,
      };
    case "cancelled":
      return {
        kind: "cancelled",
        requestId: event.requestId,
        durationMs: event.durationMs,
      };
  }
}

function asPatchExportResult(result: ElectronPatchExportResult): PatchExportResult {
  return { ...result };
}

function asShelfEntry(entry: ElectronShelfEntry): ShelfEntry {
  return {
    ...entry,
    files: entry.files.map((file) => ({ ...file })),
  };
}

function asChangelist(changelist: ElectronChangelist): Changelist {
  return { ...changelist, paths: [...changelist.paths] };
}

function asChangelistCommitResult(result: ElectronChangelistCommitResult): ChangelistCommitResult {
  return { ...result };
}

function asRecoveryEntry(entry: ElectronRecoveryEntry): RecoveryEntry {
  return {
    ...entry,
    refs: entry.refs.map((reference) => ({ ...reference })),
  };
}

function asRecoveryRestoreResult(result: ElectronRecoveryRestoreResult): RecoveryRestoreResult {
  return { ...result, restoredRefs: [...result.restoredRefs] };
}

function asConflictFile(file: ElectronConflictFile): ConflictFile {
  return { ...file };
}

function asConflictContent(content: ElectronConflictContent): ConflictContent {
  return { ...content };
}

function asSubmoduleDiff(diff: ElectronSubmoduleDiff): SubmoduleDiff {
  return { ...diff };
}

function asMultiRootOutcome(outcome: ElectronMultiRootOutcome): MultiRootOutcome {
  return { ...outcome };
}

function asRollbackOperation(
  operation: ElectronMultiRootResult["rollbackPlan"][number]["operations"][number],
): GitOperation {
  if (operation.kind === "checkout") return { ...operation };
  return { ...operation };
}

function asMultiRootResult(result: ElectronMultiRootResult): MultiRootResult {
  return {
    outcomes: result.outcomes.map(asMultiRootOutcome),
    rollbackPlan: result.rollbackPlan.map((step) => ({
      ...step,
      operations: step.operations.map(asRollbackOperation),
    })),
  };
}

export class ElectronGitBridge implements GitBridge {
  readonly #api: ElectronGitApi;
  readonly #records = new Map<string, RepositoryRecord>();

  constructor(api: ElectronGitApi) {
    this.#api = api;
  }

  async openRepository(path: string): Promise<RepositorySnapshot> {
    const record = await this.#api.openRepository(path);
    return this.#openRecord(record);
  }

  async initializeRepository(
    path: string,
    bare: boolean,
    onEvent?: GitCreationEventListener,
  ): Promise<RepositorySnapshot> {
    const record = await this.#api.initializeRepository(path, bare, onEvent);
    return this.#openRecord(record);
  }

  async cloneRepository(
    url: string,
    path: string,
    options: CloneOptions,
    onEvent?: GitCreationEventListener,
  ): Promise<RepositorySnapshot> {
    const record = await this.#api.cloneRepository(url, path, options, onEvent);
    return this.#openRecord(record);
  }

  async #openRecord(record: RepositoryRecord): Promise<RepositorySnapshot> {
    this.#records.set(record.id, record);
    try {
      return await this.#api.inspectSnapshot(record.id);
    } catch (error) {
      await this.#api.closeRepository(record.id).catch(() => false);
      this.#records.delete(record.id);
      throw error;
    }
  }

  async refreshRepository(repositoryId: string): Promise<RepositorySnapshot> {
    this.#record(repositoryId);
    return this.#api.inspectSnapshot(repositoryId);
  }

  loadPushPreview(
    repositoryId: string,
    remote: string | null,
    remoteRef: string | null,
    localRevision: string,
  ): Promise<PushPreview> {
    return this.#api.loadPushPreview(repositoryId, remote, remoteRef, localRevision);
  }

  loadHistoryRewritePreview(
    repositoryId: string,
    fromRevision: string,
  ): Promise<HistoryRewritePreview> {
    return this.#api.loadHistoryRewritePreview(repositoryId, fromRevision);
  }

  preCommitCheck(repositoryId: string): Promise<PreCommitCheck> {
    return this.#api.preCommitCheck(repositoryId);
  }

  compareBranches(repositoryId: string, left: string, right: string): Promise<BranchComparison> {
    return this.#api.compareBranches(repositoryId, left, right);
  }

  loadCommitSignature(repositoryId: string, revision: string): Promise<CommitSignature> {
    return this.#api.loadCommitSignature(repositoryId, revision);
  }

  listGitConfig(repositoryId: string): Promise<readonly GitConfig[]> {
    return this.#api.listGitConfig(repositoryId);
  }

  listSubmodules(repositoryId: string): Promise<readonly SubmoduleInfo[]> {
    return this.#api.listSubmodules(repositoryId);
  }

  listMergedBranches(repositoryId: string, target: string): Promise<readonly string[]> {
    return this.#api.listMergedBranches(repositoryId, target);
  }

  readIgnoreRules(repositoryId: string): Promise<IgnoreRules> {
    return this.#api.readIgnoreRules(repositoryId);
  }

  writeIgnoreRules(repositoryId: string, rules: IgnoreRules): Promise<void> {
    return this.#api.writeIgnoreRules(repositoryId, rules);
  }

  async exportPatch(
    repositoryId: string,
    revisions: readonly string[],
    targetPath: string,
  ): Promise<PatchExportResult> {
    return asPatchExportResult(await this.#api.exportPatch(repositoryId, revisions, targetPath));
  }

  createPatchText(repositoryId: string, revisions: readonly string[]): Promise<string> {
    return this.#api.createPatchText(repositoryId, revisions);
  }

  importPatch(repositoryId: string, path: string): Promise<void> {
    return this.#api.importPatch(repositoryId, path);
  }

  readFile(repositoryId: string, source: FileSource, path: string): Promise<FileContent> {
    return this.#api.readFile(repositoryId, source, path);
  }

  readFilePreview(repositoryId: string, source: FileSource, path: string): Promise<FilePreview> {
    return this.#api.readFilePreview(repositoryId, source, path);
  }

  writeWorkingTreeFile(
    repositoryId: string,
    path: string,
    content: string,
    activityName?: string,
  ): Promise<void> {
    if (this.#api.writeWorkingTreeFile === undefined)
      return Promise.reject(new Error("File editing is unavailable"));
    return this.#api.writeWorkingTreeFile(repositoryId, path, content, activityName);
  }

  async loadSubmoduleDiff(
    repositoryId: string,
    before: FileSource,
    after: FileSource,
    path: string,
  ): Promise<SubmoduleDiff> {
    return asSubmoduleDiff(await this.#api.loadSubmoduleDiff(repositoryId, before, after, path));
  }

  openWorkingTreeFile(repositoryId: string, path: string): Promise<void> {
    return this.#api.openWorkingTreeFile(repositoryId, path);
  }

  async execute(request: GitRequest, onEvent: (event: GitEvent) => void): Promise<RequestId> {
    const requestId = crypto.randomUUID() as GitRequestId;
    const translated = translateGitRequest(request, requestId);
    let startedDelivered = false;
    let terminalDelivered = false;
    const ensureStarted = (): void => {
      if (startedDelivered || terminalDelivered) return;
      startedDelivered = true;
      onEvent({
        kind: "started",
        requestId,
        displayCommand: `git ${request.kind}`,
        startedAtMs: Date.now(),
      });
    };
    const deliver = (event: GitRequestEvent): void => {
      if (terminalDelivered) return;
      if (event.kind === "started") {
        if (startedDelivered) return;
        startedDelivered = true;
        onEvent(asGeneratedEvent(event));
        return;
      }
      ensureStarted();
      if (event.kind === "completed" || event.kind === "failed" || event.kind === "cancelled") {
        terminalDelivered = true;
      }
      onEvent(asGeneratedEvent(event));
    };
    const failTransport = (error: unknown): void => {
      deliver({
        kind: "failed",
        requestId,
        code: "spawnFailed",
        message: error instanceof Error ? error.message : String(error),
        exitCode: null,
        durationMs: 0,
      });
    };
    try {
      void this.#api.executeQuery(translated, deliver).then(deliver, failTransport);
    } catch (error) {
      failTransport(error);
    }
    return requestId as RequestId;
  }

  async cancel(requestId: RequestId): Promise<void> {
    await this.#api.cancelQuery(requestId as GitRequestId);
  }

  async createShelf(
    repositoryId: string,
    message: string,
    paths: readonly string[],
  ): Promise<ShelfEntry> {
    return asShelfEntry(await this.#api.createShelf(repositoryId, message, paths));
  }

  async listShelves(repositoryId: string): Promise<readonly ShelfEntry[]> {
    const entries = await this.#api.listShelves(repositoryId);
    return entries.map(asShelfEntry);
  }

  applyShelf(repositoryId: string, shelfId: string, dropAfterApply: boolean): Promise<void> {
    return this.#api.applyShelf(repositoryId, shelfId, dropAfterApply);
  }

  deleteShelf(repositoryId: string, shelfId: string): Promise<void> {
    return this.#api.deleteShelf(repositoryId, shelfId);
  }

  async watchRepository(
    repositoryId: string,
    onEvent: (event: RepositoryChangedEvent) => void,
  ): Promise<void> {
    await this.#api.watchRepository(repositoryId, onEvent);
  }

  async unwatchRepository(repositoryId: string): Promise<void> {
    await this.#api.unwatchRepository(repositoryId);
    this.#records.delete(repositoryId);
    await this.#api.closeRepository(repositoryId);
  }

  async listChangelists(repositoryId: string): Promise<readonly Changelist[]> {
    const changelists = await this.#api.listChangelists(repositoryId);
    return changelists.map(asChangelist);
  }

  async saveChangelist(
    repositoryId: string,
    id: string | null,
    name: string,
    paths: readonly string[],
  ): Promise<Changelist> {
    return asChangelist(await this.#api.saveChangelist(repositoryId, id, name, paths));
  }

  deleteChangelist(repositoryId: string, changelistId: string): Promise<void> {
    return this.#api.deleteChangelist(repositoryId, changelistId);
  }

  async commitChangelist(
    repositoryId: string,
    changelistId: string,
    message: string,
    amend: boolean,
    signOff: boolean,
    gpgSign: boolean,
  ): Promise<ChangelistCommitResult> {
    return asChangelistCommitResult(
      await this.#api.commitChangelist(
        repositoryId,
        changelistId,
        message,
        amend,
        signOff,
        gpgSign,
      ),
    );
  }

  async listRecoveryEntries(repositoryId: string): Promise<readonly RecoveryEntry[]> {
    const entries = await this.#api.listRecoveryEntries(repositoryId);
    return entries.map(asRecoveryEntry);
  }

  async restoreRecoveryEntry(
    repositoryId: string,
    entryId: string,
  ): Promise<RecoveryRestoreResult> {
    return asRecoveryRestoreResult(await this.#api.restoreRecoveryEntry(repositoryId, entryId));
  }

  async listLocalHistoryActivities(
    scope: ElectronLocalHistoryScope,
    cursor: string | null,
    limit: number,
    query: string,
    showSystemEvents: boolean,
  ): Promise<ElectronLocalHistoryActivitiesPage> {
    if (this.#api.listLocalHistoryActivities === undefined)
      throw new Error("Electron Local History API is unavailable");
    return GitLocalHistoryActivitiesPageSchema.parse(
      await this.#api.listLocalHistoryActivities(scope, cursor, limit, query, showSystemEvents),
    );
  }

  async readLocalHistoryActivity(
    repositoryId: string,
    activityId: string,
  ): Promise<ElectronLocalHistoryActivityDetail> {
    if (this.#api.readLocalHistoryActivity === undefined)
      throw new Error("Electron Local History API is unavailable");
    return GitLocalHistoryActivityDetailSchema.parse(
      await this.#api.readLocalHistoryActivity(repositoryId, activityId),
    );
  }

  async readLocalHistoryDiff(
    repositoryId: string,
    activityId: string,
    path: string,
  ): Promise<string> {
    if (this.#api.readLocalHistoryDiff === undefined)
      throw new Error("Electron Local History API is unavailable");
    return this.#api.readLocalHistoryDiff(repositoryId, activityId, path);
  }

  async revertLocalHistory(
    repositoryId: string,
    activityId: string,
    paths: readonly string[],
    includeLater: boolean,
  ): Promise<void> {
    if (this.#api.revertLocalHistory === undefined)
      throw new Error("Electron Local History API is unavailable");
    await this.#api.revertLocalHistory(repositoryId, activityId, paths, includeLater);
  }

  async createLocalHistoryPatch(
    repositoryId: string,
    activityId: string,
    paths: readonly string[],
  ): Promise<string> {
    if (this.#api.createLocalHistoryPatch === undefined)
      throw new Error("Electron Local History API is unavailable");
    return this.#api.createLocalHistoryPatch(repositoryId, activityId, paths);
  }

  async putLocalHistoryLabel(
    repositoryId: string,
    label: string,
  ): Promise<ElectronLocalHistoryActivity> {
    if (this.#api.putLocalHistoryLabel === undefined)
      throw new Error("Electron Local History API is unavailable");
    return GitLocalHistoryActivitySchema.parse(
      await this.#api.putLocalHistoryLabel(repositoryId, label),
    );
  }

  async listConflicts(repositoryId: string): Promise<readonly ConflictFile[]> {
    const files = await this.#api.listConflicts(repositoryId);
    return files.map(asConflictFile);
  }

  async readConflict(repositoryId: string, path: string): Promise<ConflictContent> {
    return asConflictContent(await this.#api.readConflict(repositoryId, path));
  }

  writeConflictResult(
    repositoryId: string,
    path: string,
    result: string,
    stage: boolean,
  ): Promise<void> {
    return this.#api.writeConflictResult(repositoryId, path, result, stage);
  }

  resolveBinaryConflict(
    repositoryId: string,
    path: string,
    side: "ours" | "theirs",
  ): Promise<void> {
    return this.#api.resolveBinaryConflict(repositoryId, path, side);
  }

  listRemotes(repositoryId: string): Promise<readonly RemoteInfo[]> {
    return this.#api.listRemotes(repositoryId);
  }

  listWorktrees(repositoryId: string): Promise<readonly WorktreeInfo[]> {
    return this.#api.listWorktrees(repositoryId);
  }

  async executeSynchronizedBranchOperation(
    repositoryIds: readonly string[],
    operation: GitOperation,
  ): Promise<MultiRootResult> {
    return asMultiRootResult(
      await this.#api.executeSynchronizedBranchOperation(repositoryIds, operation),
    );
  }

  async applyMultiRootRollback(
    steps: readonly MultiRootRollbackStep[],
  ): Promise<readonly MultiRootOutcome[]> {
    const outcomes = await this.#api.applyMultiRootRollback(steps);
    return outcomes.map(asMultiRootOutcome);
  }

  #record(repositoryId: string): RepositoryRecord {
    const record = this.#records.get(repositoryId);
    if (record === undefined) throw new Error("Repository is not open");
    return record;
  }
}
