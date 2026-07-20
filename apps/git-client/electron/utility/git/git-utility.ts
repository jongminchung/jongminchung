import {
  GIT_EVENT_CHUNK_CHARACTERS,
  GitCloneRepositoryRequestSchema,
  GitExecutionRequestSchema,
  GitInitializeRepositoryRequestSchema,
  GitIgnoreRulesSchema,
  GitRepositoryServiceRequestSchema,
  GitRepositoryServiceResultSchema,
  GitSubmoduleInfosSchema,
  OpenRepositoryRequestSchema,
  RepositoryIdSchema,
  type GitCreationEvent,
  type GitCreationEventListener,
  type GitCreationOperation,
  type GitCreationTerminalEvent,
  type GitEventListener,
  type FileContent,
  type FilePreview,
  type FileSource,
  type GitRequestId,
  type GitRepositoryServiceRequest,
  type GitRepositoryServiceResult,
  type GitSubmoduleInfo,
  type RepositoryChangedListener,
  type GitTerminalEvent,
  type RepositoryId,
  type RepositoryRecord,
  type RepositorySnapshot,
} from "../../../src/shared/contracts/git-utility";
import type {
  BranchComparison,
  CommitSignature,
  GitConfig,
  HistoryRewritePreview,
  IgnoreRules,
  PreCommitCheck,
  PushPreview,
  RemoteInfo,
  WorktreeInfo,
} from "../../../src/shared/contracts/model";
import { ChangelistService } from "./changelist-service";
import { GitConflictService } from "./conflict-service";
import { GitFileService } from "./file-service";
import { GitUtilityError, asGitUtilityError } from "./git-error";
import { GitProcessRunner } from "./git-process";
import { IgnoreRulesService } from "./ignore-rules-service";
import { LocalHistoryService } from "./local-history-service";
import { MultiRootService } from "./multi-root-service";
import { GitOperationService } from "./operation-service";
import { PatchProcessRunner, PatchService } from "./patch-service";
import { GitPreviewService } from "./preview-service";
import { GitQueryService } from "./query-service";
import { RecoveryService } from "./recovery-service";
import {
  RepositoryCreateService,
  type RepositoryCreateEvent,
  type RepositoryCreateListener,
  type RepositoryCreateTerminalEvent,
} from "./repository-create-service";
import { RepositoryInspectionService } from "./repository-inspection-service";
import { RepositoryRegistry } from "./repository-registry";
import { RepositoryWatcherService } from "./repository-watcher";
import { ShelfService } from "./shelf-service";
import { SubmoduleDiffService } from "./submodule-diff-service";
import { WorkingTreeFileResolver } from "./working-tree-file-resolver";

interface RepositoryCreatorLike {
  initialize(
    request: unknown,
    listener: RepositoryCreateListener,
    signal?: AbortSignal,
  ): Promise<RepositoryCreateTerminalEvent>;
  clone(
    request: unknown,
    listener: RepositoryCreateListener,
    signal?: AbortSignal,
  ): Promise<RepositoryCreateTerminalEvent>;
}

interface RepositoryWatcherLike {
  watch(repositoryId: RepositoryId, listener: RepositoryChangedListener): Promise<void>;
  unwatch(repositoryId: RepositoryId): Promise<void>;
}

type RepositoryWatcherFactory = (registry: RepositoryRegistry) => RepositoryWatcherLike;

function repositoryServiceIds(request: GitRepositoryServiceRequest): readonly RepositoryId[] {
  if (request.operation === "executeSynchronizedBranchOperation") {
    return [...new Set(request.repositoryIds)];
  }
  if (request.operation === "applyMultiRootRollback") {
    return [...new Set(request.steps.map((step) => step.repositoryId))];
  }
  if (request.operation === "listLocalHistoryActivities") {
    return [request.scope.repositoryId];
  }
  return [request.repositoryId];
}

export class GitUtility {
  readonly #registry: RepositoryRegistry;
  readonly #queries: GitQueryService;
  readonly #operations: GitOperationService;
  readonly #previews: GitPreviewService;
  readonly #files: GitFileService;
  readonly #inspection: RepositoryInspectionService;
  readonly #ignoreRules: IgnoreRulesService;
  readonly #patches: PatchService;
  readonly #shelves: ShelfService | null;
  readonly #changelists: ChangelistService | null;
  readonly #recovery: RecoveryService | null;
  readonly #conflicts: GitConflictService;
  readonly #submoduleDiff: SubmoduleDiffService;
  readonly #workingTreeFiles: WorkingTreeFileResolver;
  readonly #multiRoot: MultiRootService | null;
  readonly #localHistory: LocalHistoryService | null;
  readonly #creations: RepositoryCreatorLike;
  readonly #watchers: RepositoryWatcherLike;
  readonly #activeCreations = new Map<GitRequestId, AbortController>();
  readonly #activeRepositoryServices = new Map<RepositoryId, Set<AbortController>>();

  constructor(
    creations: RepositoryCreatorLike = RepositoryCreateService.create(),
    watcherFactory: RepositoryWatcherFactory = (registry) => RepositoryWatcherService.of(registry),
    storageRoot: string | null = null,
  ) {
    const runner = new GitProcessRunner();
    const patchRunner = new PatchProcessRunner();
    this.#registry = new RepositoryRegistry(runner);
    this.#queries = new GitQueryService(this.#registry, runner);
    this.#recovery =
      storageRoot === null ? null : RecoveryService.of(this.#registry, storageRoot, runner);
    this.#operations = new GitOperationService(this.#registry, runner, undefined, this.#recovery);
    this.#previews = GitPreviewService.of(this.#registry, runner);
    this.#files = GitFileService.of(this.#registry);
    this.#inspection = new RepositoryInspectionService(this.#registry, runner);
    this.#ignoreRules = new IgnoreRulesService(this.#registry);
    this.#patches = new PatchService(this.#registry, patchRunner);
    this.#shelves =
      storageRoot === null ? null : ShelfService.of(this.#registry, storageRoot, patchRunner);
    this.#changelists =
      storageRoot === null ? null : ChangelistService.of(this.#registry, storageRoot, patchRunner);
    this.#conflicts = GitConflictService.of(this.#registry);
    this.#submoduleDiff = new SubmoduleDiffService(this.#registry, runner);
    this.#workingTreeFiles = new WorkingTreeFileResolver(this.#registry);
    this.#multiRoot =
      this.#recovery === null ? null : MultiRootService.of(this.#registry, this.#recovery, runner);
    this.#localHistory =
      storageRoot === null ? null : LocalHistoryService.of(this.#registry, storageRoot, runner);
    this.#creations = creations;
    this.#watchers = watcherFactory(this.#registry);
  }

  async openRepository(untrustedRequest: unknown): Promise<RepositoryRecord> {
    const request = OpenRepositoryRequestSchema.parse(untrustedRequest);
    const repository = await this.#registry.open(request.path);
    await this.#localHistory?.initialize(repository.id);
    return repository;
  }

  initializeRepository(
    untrustedRequest: unknown,
    listener: GitCreationEventListener,
  ): Promise<GitCreationTerminalEvent> {
    const request = GitInitializeRepositoryRequestSchema.parse(untrustedRequest);
    return this.#executeCreation(
      request.requestId,
      "initialize",
      listener,
      (creationListener, signal) =>
        this.#creations.initialize(
          { path: request.path, bare: request.bare },
          creationListener,
          signal,
        ),
    );
  }

  cloneRepository(
    untrustedRequest: unknown,
    listener: GitCreationEventListener,
  ): Promise<GitCreationTerminalEvent> {
    const request = GitCloneRepositoryRequestSchema.parse(untrustedRequest);
    return this.#executeCreation(request.requestId, "clone", listener, (creationListener, signal) =>
      this.#creations.clone(
        {
          url: request.url,
          path: request.path,
          options: request.options,
          singleBranch: false,
        },
        creationListener,
        signal,
      ),
    );
  }

  closeRepository(untrustedRepositoryId: unknown): boolean {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    this.#queries.cancelRepository(repositoryId);
    this.#operations.cancelRepository(repositoryId);
    this.#cancelRepositoryServices(repositoryId);
    void this.#watchers.unwatch(repositoryId);
    return this.#registry.close(repositoryId);
  }

  listRepositories(): readonly RepositoryRecord[] {
    return this.#registry.list();
  }

  executeQuery(untrustedRequest: unknown, listener: GitEventListener): Promise<GitTerminalEvent> {
    const request = GitExecutionRequestSchema.parse(untrustedRequest);
    if (request.kind !== "operation") return this.#queries.execute(request, listener);
    return this.#operations.execute(
      request.requestId,
      request.repositoryId,
      request.operation,
      listener,
    );
  }

  inspectSnapshot(untrustedRepositoryId: unknown): Promise<RepositorySnapshot> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.inspectSnapshot(repositoryId);
  }

  compareBranches(
    untrustedRepositoryId: unknown,
    left: string,
    right: string,
  ): Promise<BranchComparison> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.compareBranches(repositoryId, left, right);
  }

  preCommitCheck(untrustedRepositoryId: unknown): Promise<PreCommitCheck> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.preCommitCheck(repositoryId);
  }

  listGitConfig(untrustedRepositoryId: unknown): Promise<readonly GitConfig[]> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.listGitConfig(repositoryId);
  }

  async listSubmodules(untrustedRepositoryId: unknown): Promise<readonly GitSubmoduleInfo[]> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return GitSubmoduleInfosSchema.parse(await this.#inspection.listSubmodules(repositoryId));
  }

  listMergedBranches(untrustedRepositoryId: unknown, target: string): Promise<readonly string[]> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.listMergedBranches(repositoryId, target);
  }

  loadCommitSignature(untrustedRepositoryId: unknown, revision: string): Promise<CommitSignature> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.loadCommitSignature(repositoryId, revision);
  }

  listRemotes(untrustedRepositoryId: unknown): Promise<readonly RemoteInfo[]> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.listRemotes(repositoryId);
  }

  listWorktrees(untrustedRepositoryId: unknown): Promise<readonly WorktreeInfo[]> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.listWorktrees(repositoryId);
  }

  readIgnoreRules(untrustedRepositoryId: unknown): Promise<IgnoreRules> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#ignoreRules.read(repositoryId);
  }

  writeIgnoreRules(untrustedRepositoryId: unknown, untrustedRules: unknown): Promise<void> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    const rules = GitIgnoreRulesSchema.parse(untrustedRules);
    return this.#ignoreRules.write(repositoryId, rules);
  }

  loadPushPreview(
    untrustedRepositoryId: unknown,
    remote: string | null,
    remoteRef: string | null,
    localRevision: string,
  ): Promise<PushPreview> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#previews.pushPreview(repositoryId, remote, remoteRef, localRevision);
  }

  loadHistoryRewritePreview(
    untrustedRepositoryId: unknown,
    fromRevision: string,
  ): Promise<HistoryRewritePreview> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#previews.historyRewritePreview(repositoryId, fromRevision);
  }

  async executeRepositoryService(untrustedRequest: unknown): Promise<GitRepositoryServiceResult> {
    const request = GitRepositoryServiceRequestSchema.parse(untrustedRequest);
    const repositoryIds = repositoryServiceIds(request);
    const cancellation = this.#trackRepositoryService(repositoryIds);
    try {
      const result = await this.#executeRepositoryService(request, cancellation.signal);
      return GitRepositoryServiceResultSchema.parse(result);
    } finally {
      this.#untrackRepositoryService(repositoryIds, cancellation);
    }
  }

  cancelQuery(requestId: GitRequestId): boolean {
    if (this.#queries.cancel(requestId)) return true;
    if (this.#operations.cancel(requestId)) return true;
    const cancellation = this.#activeCreations.get(requestId);
    if (cancellation === undefined) return false;
    cancellation.abort("requested");
    return true;
  }

  cancelAllCreations(): number {
    for (const cancellation of this.#activeCreations.values()) {
      cancellation.abort("requested");
    }
    return this.#activeCreations.size;
  }

  readFile(repositoryId: RepositoryId, source: FileSource, path: string): Promise<FileContent> {
    return this.#files.readFile(repositoryId, source, path);
  }

  readFilePreview(
    repositoryId: RepositoryId,
    source: FileSource,
    path: string,
  ): Promise<FilePreview> {
    return this.#files.readFilePreview(repositoryId, source, path);
  }

  async writeWorkingTreeFile(
    repositoryId: RepositoryId,
    path: string,
    content: string,
    activityName?: string,
  ): Promise<void> {
    await this.#files.writeWorkingTreeFile(repositoryId, path, content);
    await this.#localHistory?.record(repositoryId, activityName ?? `Editing ${path}`);
  }

  watchRepository(
    untrustedRepositoryId: unknown,
    listener: RepositoryChangedListener,
  ): Promise<void> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#watchers.watch(repositoryId, (event) => {
      listener(event);
      void this.#localHistory?.record(repositoryId, "External change", true);
    });
  }

  unwatchRepository(untrustedRepositoryId: unknown): Promise<void> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#watchers.unwatch(repositoryId);
  }

  async #executeRepositoryService(
    request: GitRepositoryServiceRequest,
    signal: AbortSignal,
  ): Promise<GitRepositoryServiceResult> {
    switch (request.operation) {
      case "compareBranches":
        return {
          operation: request.operation,
          value: await this.compareBranches(request.repositoryId, request.left, request.right),
        };
      case "preCommitCheck":
        return {
          operation: request.operation,
          value: await this.preCommitCheck(request.repositoryId),
        };
      case "listGitConfig":
        return {
          operation: request.operation,
          value: await this.listGitConfig(request.repositoryId),
        };
      case "listSubmodules":
        return {
          operation: request.operation,
          value: await this.listSubmodules(request.repositoryId),
        };
      case "listMergedBranches":
        return {
          operation: request.operation,
          value: await this.listMergedBranches(request.repositoryId, request.target),
        };
      case "loadCommitSignature":
        return {
          operation: request.operation,
          value: await this.loadCommitSignature(request.repositoryId, request.revision),
        };
      case "listRemotes":
        return {
          operation: request.operation,
          value: await this.listRemotes(request.repositoryId),
        };
      case "listWorktrees":
        return {
          operation: request.operation,
          value: await this.listWorktrees(request.repositoryId),
        };
      case "readIgnoreRules":
        return {
          operation: request.operation,
          value: await this.readIgnoreRules(request.repositoryId),
        };
      case "writeIgnoreRules":
        await this.writeIgnoreRules(request.repositoryId, request.rules);
        return { operation: request.operation };
      case "pushPreview":
        return {
          operation: request.operation,
          value: await this.loadPushPreview(
            request.repositoryId,
            request.remote,
            request.remoteRef,
            request.localRevision,
          ),
        };
      case "historyRewritePreview":
        return {
          operation: request.operation,
          value: await this.loadHistoryRewritePreview(request.repositoryId, request.fromRevision),
        };
      case "exportPatch":
        return {
          operation: request.operation,
          value: await this.#patches.exportPatch(
            request.repositoryId,
            request.revisions,
            request.targetPath,
            signal,
          ),
        };
      case "createPatchText":
        return {
          operation: request.operation,
          value: await this.#patches.createPatchText(
            request.repositoryId,
            request.revisions,
            signal,
          ),
        };
      case "importPatch":
        await this.#patches.importPatch(request.repositoryId, request.path, signal);
        return { operation: request.operation };
      case "createShelf":
        return {
          operation: request.operation,
          value: await this.#stored(this.#shelves).create(
            request.repositoryId,
            request.message,
            request.paths,
            signal,
          ),
        };
      case "listShelves":
        return {
          operation: request.operation,
          value: await this.#stored(this.#shelves).list(request.repositoryId),
        };
      case "applyShelf":
        await this.#stored(this.#shelves).apply(
          request.repositoryId,
          request.shelfId,
          request.dropAfterApply,
          signal,
        );
        return { operation: request.operation };
      case "deleteShelf":
        await this.#stored(this.#shelves).delete(request.repositoryId, request.shelfId);
        return { operation: request.operation };
      case "listChangelists":
        return {
          operation: request.operation,
          value: await this.#stored(this.#changelists).list(request.repositoryId, signal),
        };
      case "saveChangelist":
        return {
          operation: request.operation,
          value: await this.#stored(this.#changelists).save(
            request.repositoryId,
            request.id,
            request.name,
            request.paths,
            signal,
          ),
        };
      case "deleteChangelist":
        await this.#stored(this.#changelists).delete(
          request.repositoryId,
          request.changelistId,
          signal,
        );
        return { operation: request.operation };
      case "commitChangelist":
        await this.#stored(this.#recovery).recordBeforeOperation(
          request.repositoryId,
          {
            kind: "commit",
            message: request.message,
            amend: request.amend,
            signOff: request.signOff,
            gpgSign: request.gpgSign,
          },
          signal,
        );
        return {
          operation: request.operation,
          value: await this.#stored(this.#changelists).commit(
            request.repositoryId,
            request.changelistId,
            {
              message: request.message,
              amend: request.amend,
              signOff: request.signOff,
              gpgSign: request.gpgSign,
            },
            signal,
          ),
        };
      case "listRecoveryEntries":
        return {
          operation: request.operation,
          value: await this.#stored(this.#recovery).list(request.repositoryId, signal),
        };
      case "restoreRecoveryEntry":
        return {
          operation: request.operation,
          value: await this.#stored(this.#recovery).restore(
            request.repositoryId,
            request.entryId,
            signal,
          ),
        };
      case "listLocalHistoryActivities":
        return {
          operation: request.operation,
          value: await this.#stored(this.#localHistory).list(
            request.scope,
            request.cursor,
            request.limit,
            request.query,
            request.showSystemEvents,
          ),
        };
      case "readLocalHistoryActivity":
        return {
          operation: request.operation,
          value: await this.#stored(this.#localHistory).detail(
            request.repositoryId,
            request.activityId,
          ),
        };
      case "readLocalHistoryDiff":
        return {
          operation: request.operation,
          value: await this.#stored(this.#localHistory).diff(
            request.repositoryId,
            request.activityId,
            request.path,
            signal,
          ),
        };
      case "revertLocalHistory":
        await this.#stored(this.#localHistory).revert(
          request.repositoryId,
          request.activityId,
          request.paths,
          request.includeLater,
          signal,
        );
        return { operation: request.operation };
      case "createLocalHistoryPatch":
        return {
          operation: request.operation,
          value: await this.#stored(this.#localHistory).createPatch(
            request.repositoryId,
            request.activityId,
            request.paths,
            signal,
          ),
        };
      case "putLocalHistoryLabel":
        return {
          operation: request.operation,
          value: await this.#stored(this.#localHistory).putLabel(
            request.repositoryId,
            request.label,
          ),
        };
      case "listConflicts":
        return {
          operation: request.operation,
          value: await this.#conflicts.list(request.repositoryId, signal),
        };
      case "readConflict":
        return {
          operation: request.operation,
          value: await this.#conflicts.read(request.repositoryId, request.path, signal),
        };
      case "writeConflictResult":
        await this.#conflicts.write(
          request.repositoryId,
          request.path,
          request.result,
          request.stage,
          signal,
        );
        return { operation: request.operation };
      case "resolveBinaryConflict":
        await this.#conflicts.resolveBinary(
          request.repositoryId,
          request.path,
          request.side,
          signal,
        );
        return { operation: request.operation };
      case "loadSubmoduleDiff":
        return {
          operation: request.operation,
          value: (
            await this.#submoduleDiff.loadSubmoduleDiff(
              request.repositoryId,
              request.before,
              request.after,
              request.path,
              signal,
            )
          ).diff,
        };
      case "resolveWorkingTreeFile":
        return {
          operation: request.operation,
          value: await this.#workingTreeFiles.resolve(request.repositoryId, request.path),
        };
      case "executeSynchronizedBranchOperation":
        return {
          operation: request.operation,
          value: await this.#stored(this.#multiRoot).executeSynchronizedBranchOperation(
            request.repositoryIds,
            request.gitOperation,
            signal,
          ),
        };
      case "applyMultiRootRollback":
        return {
          operation: request.operation,
          value: await this.#stored(this.#multiRoot).applyMultiRootRollback(request.steps, signal),
        };
    }
  }

  #trackRepositoryService(repositoryIds: readonly RepositoryId[]): AbortController {
    const cancellation = new AbortController();
    for (const repositoryId of repositoryIds) {
      const active = this.#activeRepositoryServices.get(repositoryId);
      if (active === undefined) {
        this.#activeRepositoryServices.set(repositoryId, new Set([cancellation]));
      } else {
        active.add(cancellation);
      }
    }
    return cancellation;
  }

  #stored<T>(service: T | null): T {
    if (service !== null) return service;
    throw new GitUtilityError("invalidInput", "Persistent Git service storage is not configured");
  }

  #untrackRepositoryService(
    repositoryIds: readonly RepositoryId[],
    cancellation: AbortController,
  ): void {
    for (const repositoryId of repositoryIds) {
      const active = this.#activeRepositoryServices.get(repositoryId);
      if (active === undefined) continue;
      active.delete(cancellation);
      if (active.size === 0) this.#activeRepositoryServices.delete(repositoryId);
    }
  }

  #cancelRepositoryServices(repositoryId: RepositoryId): number {
    const active = this.#activeRepositoryServices.get(repositoryId);
    if (active === undefined) return 0;
    for (const cancellation of active) {
      cancellation.abort("repositoryClosed");
    }
    this.#activeRepositoryServices.delete(repositoryId);
    return active.size;
  }

  async #executeCreation(
    requestId: GitRequestId,
    operation: GitCreationOperation,
    listener: GitCreationEventListener,
    execute: (
      listener: (event: RepositoryCreateEvent) => void,
      signal: AbortSignal,
    ) => Promise<RepositoryCreateTerminalEvent>,
  ): Promise<GitCreationTerminalEvent> {
    if (this.#activeCreations.has(requestId)) {
      throw new GitUtilityError("invalidInput", `Request ${requestId} is already running`);
    }
    const cancellation = new AbortController();
    this.#activeCreations.set(requestId, cancellation);
    let sequence = 0;
    try {
      const terminal = await execute((event) => {
        if (event.kind === "completed" || event.kind === "failed" || event.kind === "cancelled") {
          return;
        }
        if (event.kind === "started") {
          this.#emitCreation(listener, { ...event, requestId });
          return;
        }
        if (event.kind === "progress") {
          this.#emitCreation(listener, {
            ...event,
            requestId,
            sequence,
            phase: event.phase.slice(0, 256),
          });
          sequence += 1;
          return;
        }
        for (let offset = 0; offset < event.data.length; offset += GIT_EVENT_CHUNK_CHARACTERS) {
          this.#emitCreation(listener, {
            ...event,
            requestId,
            sequence,
            data: event.data.slice(offset, offset + GIT_EVENT_CHUNK_CHARACTERS),
          });
          sequence += 1;
        }
      }, cancellation.signal);
      const result = await this.#creationTerminal(requestId, operation, terminal);
      this.#emitCreation(listener, result);
      return result;
    } finally {
      this.#activeCreations.delete(requestId);
    }
  }

  async #creationTerminal(
    requestId: GitRequestId,
    operation: GitCreationOperation,
    terminal: RepositoryCreateTerminalEvent,
  ): Promise<GitCreationTerminalEvent> {
    if (terminal.kind === "completed") {
      try {
        const repository = await this.#registry.open(terminal.path);
        return { ...terminal, requestId, operation, repository };
      } catch (error) {
        const failure = asGitUtilityError(error);
        return {
          kind: "failed",
          requestId,
          operation,
          code: failure.code,
          message: failure.message,
          exitCode: failure.exitCode,
          durationMs: terminal.durationMs,
        };
      }
    }
    return { ...terminal, requestId, operation };
  }

  #emitCreation(listener: GitCreationEventListener, event: GitCreationEvent): void {
    try {
      listener(event);
    } catch {
      // A renderer listener must not prevent repository registration or process cleanup.
    }
  }
}

export type { RepositoryId };
