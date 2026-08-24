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
import { RepositoryMutationArbiter } from "./repository-mutation-arbiter";
import { RepositoryRegistry } from "./repository-registry";
import {
  dispatchRepositoryService,
  repositoryServiceIds,
  repositoryServiceIsMutation,
} from "./repository-service-dispatcher";
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
  watch(
    repositoryId: RepositoryId,
    listener: RepositoryChangedListener,
  ): Promise<void>;
  unwatch(repositoryId: RepositoryId): Promise<void>;
}

type RepositoryWatcherFactory = (
  registry: RepositoryRegistry,
) => RepositoryWatcherLike;

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
  readonly #mutations: RepositoryMutationArbiter;
  readonly #activeCreations = new Map<GitRequestId, AbortController>();
  readonly #activeRepositoryServices = new Map<
    RepositoryId,
    Set<AbortController>
  >();

  constructor(
    creations: RepositoryCreatorLike = RepositoryCreateService.create(),
    watcherFactory: RepositoryWatcherFactory = (registry) =>
      RepositoryWatcherService.of(registry),
    storageRoot: string | null = null,
  ) {
    const runner = new GitProcessRunner();
    const patchRunner = new PatchProcessRunner();
    this.#mutations = new RepositoryMutationArbiter();
    this.#registry = new RepositoryRegistry(runner);
    this.#queries = new GitQueryService(this.#registry, runner);
    this.#recovery =
      storageRoot === null
        ? null
        : RecoveryService.of(this.#registry, storageRoot, runner);
    this.#operations = new GitOperationService(
      this.#registry,
      runner,
      undefined,
      this.#recovery,
      this.#mutations,
    );
    this.#previews = GitPreviewService.of(this.#registry, runner);
    this.#files = GitFileService.of(this.#registry);
    this.#inspection = new RepositoryInspectionService(this.#registry, runner);
    this.#ignoreRules = new IgnoreRulesService(this.#registry);
    this.#patches = new PatchService(this.#registry, patchRunner);
    this.#shelves =
      storageRoot === null
        ? null
        : ShelfService.of(this.#registry, storageRoot, patchRunner);
    this.#changelists =
      storageRoot === null
        ? null
        : ChangelistService.of(this.#registry, storageRoot, patchRunner);
    this.#conflicts = GitConflictService.of(this.#registry);
    this.#submoduleDiff = new SubmoduleDiffService(this.#registry, runner);
    this.#workingTreeFiles = new WorkingTreeFileResolver(this.#registry);
    this.#multiRoot =
      this.#recovery === null
        ? null
        : MultiRootService.of(this.#registry, this.#recovery, runner);
    this.#localHistory =
      storageRoot === null
        ? null
        : LocalHistoryService.of(this.#registry, storageRoot, runner);
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
    const request =
      GitInitializeRepositoryRequestSchema.parse(untrustedRequest);
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
    return this.#executeCreation(
      request.requestId,
      "clone",
      listener,
      (creationListener, signal) =>
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

  executeQuery(
    untrustedRequest: unknown,
    listener: GitEventListener,
  ): Promise<GitTerminalEvent> {
    const request = GitExecutionRequestSchema.parse(untrustedRequest);
    if (request.kind !== "operation")
      return this.#queries.execute(request, listener);
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

  async listSubmodules(
    untrustedRepositoryId: unknown,
  ): Promise<readonly GitSubmoduleInfo[]> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return GitSubmoduleInfosSchema.parse(
      await this.#inspection.listSubmodules(repositoryId),
    );
  }

  listMergedBranches(
    untrustedRepositoryId: unknown,
    target: string,
  ): Promise<readonly string[]> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.listMergedBranches(repositoryId, target);
  }

  loadCommitSignature(
    untrustedRepositoryId: unknown,
    revision: string,
  ): Promise<CommitSignature> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.loadCommitSignature(repositoryId, revision);
  }

  listRemotes(untrustedRepositoryId: unknown): Promise<readonly RemoteInfo[]> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.listRemotes(repositoryId);
  }

  listWorktrees(
    untrustedRepositoryId: unknown,
  ): Promise<readonly WorktreeInfo[]> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#inspection.listWorktrees(repositoryId);
  }

  readIgnoreRules(untrustedRepositoryId: unknown): Promise<IgnoreRules> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#ignoreRules.read(repositoryId);
  }

  writeIgnoreRules(
    untrustedRepositoryId: unknown,
    untrustedRules: unknown,
  ): Promise<void> {
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
    return this.#previews.pushPreview(
      repositoryId,
      remote,
      remoteRef,
      localRevision,
    );
  }

  loadHistoryRewritePreview(
    untrustedRepositoryId: unknown,
    fromRevision: string,
  ): Promise<HistoryRewritePreview> {
    const repositoryId = RepositoryIdSchema.parse(untrustedRepositoryId);
    return this.#previews.historyRewritePreview(repositoryId, fromRevision);
  }

  async executeRepositoryService(
    untrustedRequest: unknown,
  ): Promise<GitRepositoryServiceResult> {
    const request = GitRepositoryServiceRequestSchema.parse(untrustedRequest);
    const repositoryIds = repositoryServiceIds(request);
    const cancellation = this.#trackRepositoryService(repositoryIds);
    try {
      const execute = (): Promise<GitRepositoryServiceResult> =>
        this.#executeRepositoryService(request, cancellation.signal);
      const result = repositoryServiceIsMutation(request.operation)
        ? await this.#mutations.run(repositoryIds, cancellation.signal, execute)
        : await execute();
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

  readFile(
    repositoryId: RepositoryId,
    source: FileSource,
    path: string,
  ): Promise<FileContent> {
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
    const cancellation = this.#trackRepositoryService([repositoryId]);
    try {
      await this.#mutations.run(
        [repositoryId],
        cancellation.signal,
        async () => {
          await this.#files.writeWorkingTreeFile(repositoryId, path, content);
          await this.#localHistory?.record(
            repositoryId,
            activityName ?? `Editing ${path}`,
          );
        },
      );
    } finally {
      this.#untrackRepositoryService([repositoryId], cancellation);
    }
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

  #executeRepositoryService(
    request: GitRepositoryServiceRequest,
    signal: AbortSignal,
  ): Promise<GitRepositoryServiceResult> {
    return dispatchRepositoryService(request, signal, {
      inspection: this.#inspection,
      ignoreRules: this.#ignoreRules,
      previews: this.#previews,
      patches: this.#patches,
      shelves: this.#shelves,
      changelists: this.#changelists,
      recovery: this.#recovery,
      localHistory: this.#localHistory,
      conflicts: this.#conflicts,
      submoduleDiff: this.#submoduleDiff,
      workingTreeFiles: this.#workingTreeFiles,
      multiRoot: this.#multiRoot,
    });
  }

  #trackRepositoryService(
    repositoryIds: readonly RepositoryId[],
  ): AbortController {
    const cancellation = new AbortController();
    for (const repositoryId of repositoryIds) {
      const active = this.#activeRepositoryServices.get(repositoryId);
      if (active === undefined) {
        this.#activeRepositoryServices.set(
          repositoryId,
          new Set([cancellation]),
        );
      } else {
        active.add(cancellation);
      }
    }
    return cancellation;
  }

  #untrackRepositoryService(
    repositoryIds: readonly RepositoryId[],
    cancellation: AbortController,
  ): void {
    for (const repositoryId of repositoryIds) {
      const active = this.#activeRepositoryServices.get(repositoryId);
      if (active === undefined) continue;
      active.delete(cancellation);
      if (active.size === 0)
        this.#activeRepositoryServices.delete(repositoryId);
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
      throw new GitUtilityError(
        "invalidInput",
        `Request ${requestId} is already running`,
      );
    }
    const cancellation = new AbortController();
    this.#activeCreations.set(requestId, cancellation);
    let sequence = 0;
    try {
      const terminal = await execute((event) => {
        if (
          event.kind === "completed" ||
          event.kind === "failed" ||
          event.kind === "cancelled"
        ) {
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
        for (
          let offset = 0;
          offset < event.data.length;
          offset += GIT_EVENT_CHUNK_CHARACTERS
        ) {
          this.#emitCreation(listener, {
            ...event,
            requestId,
            sequence,
            data: event.data.slice(offset, offset + GIT_EVENT_CHUNK_CHARACTERS),
          });
          sequence += 1;
        }
      }, cancellation.signal);
      const result = await this.#creationTerminal(
        requestId,
        operation,
        terminal,
      );
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

  #emitCreation(
    listener: GitCreationEventListener,
    event: GitCreationEvent,
  ): void {
    try {
      listener(event);
    } catch {
      // A renderer listener must not prevent repository registration or process cleanup.
    }
  }
}

export type { RepositoryId };
