import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import {
  GitCloneRepositoryRequestSchema,
  GitReadFileRequestSchema,
  GitWriteWorkingTreeFileRequestSchema,
  GitRepositoryServiceRequestSchema,
  GitInitializeRepositoryRequestSchema,
  GitExecutionRequestSchema,
  GitRequestIdSchema,
  OpenRepositoryRequestSchema,
  RepositoryIdSchema,
  type GitCloneRepositoryRequest,
  type GitCreationEventListener,
  type GitCreationTerminalEvent,
  type GitEventListener,
  type GitRepositoryServiceRequest,
  type GitRepositoryServiceResult,
  type GitBranchComparison,
  type GitPreCommitCheck,
  type GitConfigEntry,
  type GitSubmoduleInfo,
  type GitCommitSignature,
  type GitRemoteInfo,
  type GitWorktreeInfo,
  type GitIgnoreRules,
  type GitPushPreview,
  type GitHistoryRewritePreview,
  type GitMultiRootOutcome,
  type GitMultiRootResult,
  type GitMultiRootRollbackStep,
  type GitPatchExportResult,
  type GitShelfEntry,
  type GitChangelist,
  type GitChangelistCommitResult,
  type GitRecoveryEntry,
  type GitRecoveryRestoreResult,
  type GitConflictFile,
  type GitConflictContent,
  type GitTerminalEvent,
  type FileContent,
  type FilePreview,
  type FileSource,
  type GitSubmoduleDiff,
  type RepositoryChangedListener,
  type RepositoryId,
  type RepositoryRecord,
  type RepositorySnapshot,
} from "../../src/shared/contracts/git-utility";
import {
  GIT_UTILITY_STORAGE_ROOT_ARGUMENT,
  GitUtilityStorageRootSchema,
} from "../../src/shared/contracts/git-utility-process";
import type { GitOperation } from "../../src/shared/contracts/model";
import {
  GitUtilityProtocolRuntime,
  type GitUtilityClientState,
} from "./git-utility-protocol-runtime";
import {
  GitUtilityTransportError,
  createElectronTransport,
  type GitUtilityClientConnectOptions,
  type GitUtilityClientForkOptions,
  type GitUtilityProcessTransport,
} from "./git-utility-transport";

export {
  GitUtilityTransportError,
  type GitUtilityClientConnectOptions,
  type GitUtilityClientForkOptions,
  type GitUtilityProcessTransport,
  type GitUtilityTransportErrorCode,
} from "./git-utility-transport";

export class GitUtilityClient {
  readonly #runtime: GitUtilityProtocolRuntime;

  private constructor(runtime: GitUtilityProtocolRuntime) {
    this.#runtime = runtime;
  }

  static async fork(
    entryModulePath: string,
    options: GitUtilityClientForkOptions,
  ): Promise<GitUtilityClient> {
    if (!isAbsolute(entryModulePath) || entryModulePath.includes("\0")) {
      throw new GitUtilityTransportError(
        "invalidRequest",
        "Git utility entry path must be absolute",
      );
    }
    const storageRoot = GitUtilityStorageRootSchema.parse(options.storageRoot);
    const { utilityProcess } = await import("electron");
    const child = utilityProcess.fork(
      entryModulePath,
      [GIT_UTILITY_STORAGE_ROOT_ARGUMENT, storageRoot],
      {
        serviceName: "Git Client Git Utility",
        stdio: "ignore",
        allowLoadingUnsignedLibraries: false,
      },
    );
    return GitUtilityClient.connect(createElectronTransport(child), {
      handshakeTimeoutMs: options.handshakeTimeoutMs,
      onCrash: options.onCrash,
    });
  }

  static async connect(
    transport: GitUtilityProcessTransport,
    options: GitUtilityClientConnectOptions = {},
  ): Promise<GitUtilityClient> {
    const runtime = new GitUtilityProtocolRuntime(transport, options);
    await runtime.ready();
    return new GitUtilityClient(runtime);
  }

  async openRepository(path: string): Promise<RepositoryRecord> {
    this.#runtime.assertReady();
    const request = OpenRepositoryRequestSchema.parse({ path });
    const response = await this.#runtime.request(
      { kind: "openRepository", correlationId: randomUUID(), request },
      "openRepositoryResult",
    );
    if (response.kind !== "openRepositoryResult")
      throw this.#runtime.unexpected(response.kind);
    return response.repository;
  }

  initializeRepository(
    untrustedRequest: unknown,
    listener: GitCreationEventListener,
  ): Promise<GitCreationTerminalEvent> {
    this.#runtime.assertReady();
    const request =
      GitInitializeRepositoryRequestSchema.parse(untrustedRequest);
    return this.#runtime.executeCreation(
      {
        kind: "initializeRepository",
        correlationId: randomUUID(),
        request,
      },
      "initialize",
      listener,
    );
  }

  cloneRepository(
    untrustedRequest: GitCloneRepositoryRequest,
    listener: GitCreationEventListener,
  ): Promise<GitCreationTerminalEvent> {
    this.#runtime.assertReady();
    const request = GitCloneRepositoryRequestSchema.parse(untrustedRequest);
    return this.#runtime.executeCreation(
      { kind: "cloneRepository", correlationId: randomUUID(), request },
      "clone",
      listener,
    );
  }

  async closeRepository(repositoryId: RepositoryId): Promise<boolean> {
    this.#runtime.assertReady();
    const id = RepositoryIdSchema.parse(repositoryId);
    const response = await this.#runtime.request(
      {
        kind: "closeRepository",
        correlationId: randomUUID(),
        repositoryId: id,
      },
      "closeRepositoryResult",
    );
    if (response.kind !== "closeRepositoryResult")
      throw this.#runtime.unexpected(response.kind);
    this.#runtime.clearWatchListener(id);
    return response.closed;
  }

  async inspectSnapshot(
    repositoryId: RepositoryId,
  ): Promise<RepositorySnapshot> {
    this.#runtime.assertReady();
    const id = RepositoryIdSchema.parse(repositoryId);
    const response = await this.#runtime.request(
      {
        kind: "inspectSnapshot",
        correlationId: randomUUID(),
        repositoryId: id,
      },
      "inspectSnapshotResult",
    );
    if (response.kind !== "inspectSnapshotResult")
      throw this.#runtime.unexpected(response.kind);
    return response.snapshot;
  }

  async compareBranches(
    repositoryId: RepositoryId,
    left: string,
    right: string,
  ): Promise<GitBranchComparison> {
    const result = await this.#repositoryService({
      operation: "compareBranches",
      repositoryId,
      left,
      right,
    });
    if (result.operation !== "compareBranches")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async preCommitCheck(repositoryId: RepositoryId): Promise<GitPreCommitCheck> {
    const result = await this.#repositoryService({
      operation: "preCommitCheck",
      repositoryId,
    });
    if (result.operation !== "preCommitCheck")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async listGitConfig(
    repositoryId: RepositoryId,
  ): Promise<readonly GitConfigEntry[]> {
    const result = await this.#repositoryService({
      operation: "listGitConfig",
      repositoryId,
    });
    if (result.operation !== "listGitConfig")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async listSubmodules(
    repositoryId: RepositoryId,
  ): Promise<readonly GitSubmoduleInfo[]> {
    const result = await this.#repositoryService({
      operation: "listSubmodules",
      repositoryId,
    });
    if (result.operation !== "listSubmodules")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async listMergedBranches(
    repositoryId: RepositoryId,
    target: string,
  ): Promise<readonly string[]> {
    const result = await this.#repositoryService({
      operation: "listMergedBranches",
      repositoryId,
      target,
    });
    if (result.operation !== "listMergedBranches")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async loadCommitSignature(
    repositoryId: RepositoryId,
    revision: string,
  ): Promise<GitCommitSignature> {
    const result = await this.#repositoryService({
      operation: "loadCommitSignature",
      repositoryId,
      revision,
    });
    if (result.operation !== "loadCommitSignature")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async listRemotes(
    repositoryId: RepositoryId,
  ): Promise<readonly GitRemoteInfo[]> {
    const result = await this.#repositoryService({
      operation: "listRemotes",
      repositoryId,
    });
    if (result.operation !== "listRemotes")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async listWorktrees(
    repositoryId: RepositoryId,
  ): Promise<readonly GitWorktreeInfo[]> {
    const result = await this.#repositoryService({
      operation: "listWorktrees",
      repositoryId,
    });
    if (result.operation !== "listWorktrees")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async readIgnoreRules(repositoryId: RepositoryId): Promise<GitIgnoreRules> {
    const result = await this.#repositoryService({
      operation: "readIgnoreRules",
      repositoryId,
    });
    if (result.operation !== "readIgnoreRules")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async writeIgnoreRules(
    repositoryId: RepositoryId,
    rules: GitIgnoreRules,
  ): Promise<void> {
    const result = await this.#repositoryService({
      operation: "writeIgnoreRules",
      repositoryId,
      rules,
    });
    if (result.operation !== "writeIgnoreRules")
      throw this.#runtime.unexpected(result.operation);
  }

  async loadPushPreview(
    repositoryId: RepositoryId,
    remote: string | null,
    remoteRef: string | null,
    localRevision: string,
  ): Promise<GitPushPreview> {
    const result = await this.#repositoryService({
      operation: "pushPreview",
      repositoryId,
      remote,
      remoteRef,
      localRevision,
    });
    if (result.operation !== "pushPreview")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async loadHistoryRewritePreview(
    repositoryId: RepositoryId,
    fromRevision: string,
  ): Promise<GitHistoryRewritePreview> {
    const result = await this.#repositoryService({
      operation: "historyRewritePreview",
      repositoryId,
      fromRevision,
    });
    if (result.operation !== "historyRewritePreview")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  executeRepositoryService(
    request: GitRepositoryServiceRequest,
  ): Promise<GitRepositoryServiceResult> {
    return this.#repositoryService(request);
  }

  async loadSubmoduleDiff(
    repositoryId: RepositoryId,
    before: FileSource,
    after: FileSource,
    path: string,
  ): Promise<GitSubmoduleDiff> {
    const result = await this.#repositoryService({
      operation: "loadSubmoduleDiff",
      repositoryId,
      before,
      after,
      path,
    });
    if (result.operation !== "loadSubmoduleDiff")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async resolveWorkingTreeFile(
    repositoryId: RepositoryId,
    path: string,
  ): Promise<string> {
    const result = await this.#repositoryService({
      operation: "resolveWorkingTreeFile",
      repositoryId,
      path,
    });
    if (result.operation !== "resolveWorkingTreeFile")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async executeSynchronizedBranchOperation(
    repositoryIds: readonly RepositoryId[],
    gitOperation: GitOperation,
  ): Promise<GitMultiRootResult> {
    const result = await this.#repositoryService({
      operation: "executeSynchronizedBranchOperation",
      repositoryIds,
      gitOperation,
    });
    if (result.operation !== "executeSynchronizedBranchOperation")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async applyMultiRootRollback(
    steps: readonly GitMultiRootRollbackStep[],
  ): Promise<readonly GitMultiRootOutcome[]> {
    const result = await this.#repositoryService({
      operation: "applyMultiRootRollback",
      steps,
    });
    if (result.operation !== "applyMultiRootRollback")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async exportPatch(
    repositoryId: RepositoryId,
    revisions: readonly string[],
    targetPath: string,
  ): Promise<GitPatchExportResult> {
    const result = await this.#repositoryService({
      operation: "exportPatch",
      repositoryId,
      revisions,
      targetPath,
    });
    if (result.operation !== "exportPatch")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async createPatchText(
    repositoryId: RepositoryId,
    revisions: readonly string[],
  ): Promise<string> {
    const result = await this.#repositoryService({
      operation: "createPatchText",
      repositoryId,
      revisions,
    });
    if (result.operation !== "createPatchText")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async importPatch(repositoryId: RepositoryId, path: string): Promise<void> {
    const result = await this.#repositoryService({
      operation: "importPatch",
      repositoryId,
      path,
    });
    if (result.operation !== "importPatch")
      throw this.#runtime.unexpected(result.operation);
  }

  async createShelf(
    repositoryId: RepositoryId,
    message: string,
    paths: readonly string[],
  ): Promise<GitShelfEntry> {
    const result = await this.#repositoryService({
      operation: "createShelf",
      repositoryId,
      message,
      paths,
    });
    if (result.operation !== "createShelf")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async listShelves(
    repositoryId: RepositoryId,
  ): Promise<readonly GitShelfEntry[]> {
    const result = await this.#repositoryService({
      operation: "listShelves",
      repositoryId,
    });
    if (result.operation !== "listShelves")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async applyShelf(
    repositoryId: RepositoryId,
    shelfId: string,
    dropAfterApply: boolean,
  ): Promise<void> {
    const result = await this.#repositoryService({
      operation: "applyShelf",
      repositoryId,
      shelfId,
      dropAfterApply,
    });
    if (result.operation !== "applyShelf")
      throw this.#runtime.unexpected(result.operation);
  }

  async deleteShelf(
    repositoryId: RepositoryId,
    shelfId: string,
  ): Promise<void> {
    const result = await this.#repositoryService({
      operation: "deleteShelf",
      repositoryId,
      shelfId,
    });
    if (result.operation !== "deleteShelf")
      throw this.#runtime.unexpected(result.operation);
  }

  async listChangelists(
    repositoryId: RepositoryId,
  ): Promise<readonly GitChangelist[]> {
    const result = await this.#repositoryService({
      operation: "listChangelists",
      repositoryId,
    });
    if (result.operation !== "listChangelists")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async saveChangelist(
    repositoryId: RepositoryId,
    id: string | null,
    name: string,
    paths: readonly string[],
  ): Promise<GitChangelist> {
    const result = await this.#repositoryService({
      operation: "saveChangelist",
      repositoryId,
      id,
      name,
      paths,
    });
    if (result.operation !== "saveChangelist")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async deleteChangelist(
    repositoryId: RepositoryId,
    changelistId: string,
  ): Promise<void> {
    const result = await this.#repositoryService({
      operation: "deleteChangelist",
      repositoryId,
      changelistId,
    });
    if (result.operation !== "deleteChangelist")
      throw this.#runtime.unexpected(result.operation);
  }

  async commitChangelist(
    repositoryId: RepositoryId,
    changelistId: string,
    message: string,
    amend: boolean,
    signOff: boolean,
    gpgSign: boolean,
  ): Promise<GitChangelistCommitResult> {
    const result = await this.#repositoryService({
      operation: "commitChangelist",
      repositoryId,
      changelistId,
      message,
      amend,
      signOff,
      gpgSign,
    });
    if (result.operation !== "commitChangelist")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async listRecoveryEntries(
    repositoryId: RepositoryId,
  ): Promise<readonly GitRecoveryEntry[]> {
    const result = await this.#repositoryService({
      operation: "listRecoveryEntries",
      repositoryId,
    });
    if (result.operation !== "listRecoveryEntries")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async restoreRecoveryEntry(
    repositoryId: RepositoryId,
    entryId: string,
  ): Promise<GitRecoveryRestoreResult> {
    const result = await this.#repositoryService({
      operation: "restoreRecoveryEntry",
      repositoryId,
      entryId,
    });
    if (result.operation !== "restoreRecoveryEntry")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async listConflicts(
    repositoryId: RepositoryId,
  ): Promise<readonly GitConflictFile[]> {
    const result = await this.#repositoryService({
      operation: "listConflicts",
      repositoryId,
    });
    if (result.operation !== "listConflicts")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async readConflict(
    repositoryId: RepositoryId,
    path: string,
  ): Promise<GitConflictContent> {
    const result = await this.#repositoryService({
      operation: "readConflict",
      repositoryId,
      path,
    });
    if (result.operation !== "readConflict")
      throw this.#runtime.unexpected(result.operation);
    return result.value;
  }

  async writeConflictResult(
    repositoryId: RepositoryId,
    path: string,
    conflictResult: string,
    stage: boolean,
  ): Promise<void> {
    const result = await this.#repositoryService({
      operation: "writeConflictResult",
      repositoryId,
      path,
      result: conflictResult,
      stage,
    });
    if (result.operation !== "writeConflictResult")
      throw this.#runtime.unexpected(result.operation);
  }

  async resolveBinaryConflict(
    repositoryId: RepositoryId,
    path: string,
    side: "ours" | "theirs",
  ): Promise<void> {
    const result = await this.#repositoryService({
      operation: "resolveBinaryConflict",
      repositoryId,
      path,
      side,
    });
    if (result.operation !== "resolveBinaryConflict")
      throw this.#runtime.unexpected(result.operation);
  }

  async readFile(
    repositoryId: RepositoryId,
    source: FileSource,
    path: string,
  ): Promise<FileContent> {
    this.#runtime.assertReady();
    const request = GitReadFileRequestSchema.parse({
      repositoryId,
      source,
      path,
    });
    const response = await this.#runtime.request(
      { kind: "readFile", correlationId: randomUUID(), request },
      "readFileResult",
    );
    if (response.kind !== "readFileResult")
      throw this.#runtime.unexpected(response.kind);
    return response.content;
  }

  async readFilePreview(
    repositoryId: RepositoryId,
    source: FileSource,
    path: string,
  ): Promise<FilePreview> {
    this.#runtime.assertReady();
    const request = GitReadFileRequestSchema.parse({
      repositoryId,
      source,
      path,
    });
    const response = await this.#runtime.request(
      { kind: "readFilePreview", correlationId: randomUUID(), request },
      "readFilePreviewResult",
    );
    if (response.kind !== "readFilePreviewResult")
      throw this.#runtime.unexpected(response.kind);
    return response.preview;
  }

  async writeWorkingTreeFile(
    repositoryId: RepositoryId,
    path: string,
    content: string,
    activityName?: string,
  ): Promise<void> {
    this.#runtime.assertReady();
    const request = GitWriteWorkingTreeFileRequestSchema.parse({
      repositoryId,
      path,
      content,
      activityName: activityName ?? null,
    });
    const response = await this.#runtime.request(
      {
        kind: "writeWorkingTreeFile",
        correlationId: randomUUID(),
        request,
      },
      "writeWorkingTreeFileResult",
    );
    if (response.kind !== "writeWorkingTreeFileResult")
      throw this.#runtime.unexpected(response.kind);
  }

  async watchRepository(
    repositoryId: RepositoryId,
    listener: RepositoryChangedListener,
  ): Promise<void> {
    this.#runtime.assertReady();
    const id = RepositoryIdSchema.parse(repositoryId);
    if (this.#runtime.hasWatchListener(id)) {
      this.#runtime.setWatchListener(id, listener);
      return;
    }
    this.#runtime.setWatchListener(id, listener);
    try {
      const response = await this.#runtime.request(
        {
          kind: "watchRepository",
          correlationId: randomUUID(),
          repositoryId: id,
        },
        "watchRepositoryResult",
      );
      if (response.kind !== "watchRepositoryResult")
        throw this.#runtime.unexpected(response.kind);
      if (response.repositoryId !== id) {
        throw new GitUtilityTransportError(
          "protocolViolation",
          "Watch repository result did not match its request",
        );
      }
    } catch (error) {
      this.#runtime.clearWatchListener(id, listener);
      throw error;
    }
  }

  async unwatchRepository(repositoryId: RepositoryId): Promise<void> {
    this.#runtime.assertReady();
    const id = RepositoryIdSchema.parse(repositoryId);
    const response = await this.#runtime.request(
      {
        kind: "unwatchRepository",
        correlationId: randomUUID(),
        repositoryId: id,
      },
      "unwatchRepositoryResult",
    );
    if (response.kind !== "unwatchRepositoryResult")
      throw this.#runtime.unexpected(response.kind);
    if (response.repositoryId !== id) {
      throw new GitUtilityTransportError(
        "protocolViolation",
        "Unwatch repository result did not match its request",
      );
    }
    this.#runtime.clearWatchListener(id);
  }

  executeQuery(
    untrustedRequest: unknown,
    listener: GitEventListener,
  ): Promise<GitTerminalEvent> {
    this.#runtime.assertReady();
    const request = GitExecutionRequestSchema.parse(untrustedRequest);
    const correlationId = randomUUID();
    return this.#runtime.executeQuery(
      { kind: "query", correlationId, request },
      listener,
    );
  }

  async #repositoryService(
    untrustedRequest: unknown,
  ): Promise<GitRepositoryServiceResult> {
    this.#runtime.assertReady();
    const request = GitRepositoryServiceRequestSchema.parse(untrustedRequest);
    const response = await this.#runtime.request(
      { kind: "repositoryService", correlationId: randomUUID(), request },
      "repositoryServiceResult",
    );
    if (response.kind !== "repositoryServiceResult")
      throw this.#runtime.unexpected(response.kind);
    if (response.result.operation !== request.operation) {
      throw new GitUtilityTransportError(
        "protocolViolation",
        "Repository service result did not match its request",
      );
    }
    return response.result;
  }

  async cancelQuery(requestId: string): Promise<boolean> {
    this.#runtime.assertReady();
    const id = GitRequestIdSchema.parse(requestId);
    const response = await this.#runtime.request(
      { kind: "cancel", correlationId: randomUUID(), requestId: id },
      "cancelResult",
    );
    if (response.kind !== "cancelResult")
      throw this.#runtime.unexpected(response.kind);
    return response.cancelled;
  }

  dispose(): Promise<void> {
    return this.#runtime.dispose();
  }

  get state(): GitUtilityClientState {
    return this.#runtime.state;
  }
}
