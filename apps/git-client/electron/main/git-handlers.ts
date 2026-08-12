import { shell } from "electron";
import type { BrowserWindow } from "electron";
import { RPC_PROCEDURES } from "../../src/shared/contracts/desktop-rpc";
import {
  FileContentSchema,
  FilePreviewSchema,
  GitCloneRepositoryRequestSchema,
  type GitCreationEventListener,
  GitCreationEventSchema,
  type GitCreationTerminalEvent,
  GitExecutionRequestSchema,
  GitInitializeRepositoryRequestSchema,
  GitReadFileRequestSchema,
  type GitRepositoryServiceRequest,
  GitRepositoryServiceRequestSchema,
  GitRepositoryServiceResultSchema,
  GitRequestEventSchema,
  type GitTerminalEvent,
  GitWatchRepositoryRequestSchema,
  GitWorkingTreeFileRequestSchema,
  GitWriteWorkingTreeFileRequestSchema,
  OpenRepositoryRequestSchema,
  RepositoryChangedEventSchema,
  type RepositoryId,
  type RepositoryRecord,
  RepositoryRecordSchema,
  RepositorySnapshotSchema,
} from "../../src/shared/contracts/git-utility";
import {
  GitCancelQueryRequestSchema,
  GitCloseRepositoryRequestSchema,
  GitRepositoryRequestSchema,
  GitTerminalResultSchema,
} from "../../src/shared/contracts/ipc";
import {
  localHistoryRequestRepositoryId,
  parseLocalHistoryRepositoryRequest,
} from "../../src/shared/contracts/local-history-ipc";
import type { DesktopRpcRouter } from "./desktop-rpc-router";
import type { DesktopStreamPublisher } from "./desktop-stream-hub";
import type { GitUtilityClient } from "./git-utility-client";
import { assertTrustedLocalHistorySender, assertTrustedSender } from "./ipc-security";
import { safeRepositoryPaths } from "./repository-capabilities";
import type { ExecutableCapability } from "./repository-capabilities";
import type { SettingsStore } from "./settings-store";
import type { TerminalUtilityClient } from "./terminal-utility-client";

function repositoryServiceExecutableIds(
  request: GitRepositoryServiceRequest,
): readonly RepositoryId[] {
  switch (request.operation) {
    case "compareBranches":
    case "listGitConfig":
    case "listSubmodules":
    case "listMergedBranches":
    case "loadCommitSignature":
    case "listRemotes":
    case "listWorktrees":
    case "readIgnoreRules":
    case "pushPreview":
    case "historyRewritePreview":
    case "createPatchText":
    case "listShelves":
    case "listChangelists":
    case "listRecoveryEntries":
    case "listLocalHistoryActivities":
    case "readLocalHistoryActivity":
    case "readLocalHistoryDiff":
    case "createLocalHistoryPatch":
    case "listConflicts":
    case "readConflict":
    case "loadSubmoduleDiff":
    case "resolveWorkingTreeFile":
      return [];
    case "executeSynchronizedBranchOperation":
      return request.repositoryIds;
    case "applyMultiRootRollback":
      return request.steps.map((step) => step.repositoryId);
    default:
      if ("repositoryId" in request) return [request.repositoryId];
      throw new Error("Repository service is unavailable in Safe Mode.");
  }
}

interface GitHandlerDependencies {
  readonly router: DesktopRpcRouter;
  readonly stream: DesktopStreamPublisher;
  readonly window: BrowserWindow;
  readonly settings: SettingsStore;
  readonly gitUtility: GitUtilityClient;
  readonly terminalUtility: TerminalUtilityClient;
  readonly repositoryPaths: Map<string, string>;
  readonly repositoryAccessModes: Map<string, "trusted" | "safe">;
  readonly assertRepositoryCapability: (
    repositoryId: string,
    capability: ExecutableCapability,
  ) => void;
  readonly assertActiveCapability: (capability: ExecutableCapability) => void;
}

export function registerGitHandlers(dependencies: GitHandlerDependencies): () => void {
  const {
    router,
    stream,
    window,
    settings,
    gitUtility,
    terminalUtility,
    repositoryPaths,
    repositoryAccessModes,
    assertRepositoryCapability,
    assertActiveCapability,
  } = dependencies;
  const creationListener: GitCreationEventListener = (creationEvent) => {
    if (window.isDestroyed() || window.webContents.isDestroyed()) return;
    if (
      creationEvent.kind === "completed" ||
      creationEvent.kind === "failed" ||
      creationEvent.kind === "cancelled"
    ) {
      return;
    }
    stream.publish({
      kind: "git.creation.event",
      event: GitCreationEventSchema.parse(creationEvent),
    });
  };
  const activeRequestIds = new Set<string>();
  const watchedRepositoryIds = new Set<RepositoryId>();
  const unsubscribeDisconnect =
    stream.onDisconnect?.(() => {
      for (const requestId of activeRequestIds) {
        void gitUtility.cancelQuery(requestId).catch(() => undefined);
      }
      activeRequestIds.clear();
      for (const repositoryId of watchedRepositoryIds) {
        void gitUtility.unwatchRepository(repositoryId).catch(() => undefined);
      }
      watchedRepositoryIds.clear();
    }) ?? (() => undefined);
  router.handle(
    RPC_PROCEDURES.gitOpenRepository,
    async (event, raw: unknown): Promise<RepositoryRecord> => {
      assertTrustedSender(event, window);
      const request = OpenRepositoryRequestSchema.parse(raw);
      const repository = await gitUtility.openRepository(request.path);
      const safePaths = safeRepositoryPaths(settings);
      const nextMode =
        safePaths.has(request.path) || safePaths.has(repository.path) ? "safe" : "trusted";
      if (nextMode === "safe") {
        const repositoriesToClose = [...repositoryPaths.entries()].flatMap(([id, path]) =>
          path === repository.path && repositoryAccessModes.get(id) === "trusted" ? [id] : [],
        );
        await Promise.all(
          repositoriesToClose.map(async (repositoryId) =>
            terminalUtility.closeRepository({ repositoryId }),
          ),
        );
      }
      repositoryPaths.set(repository.id, repository.path);
      repositoryAccessModes.set(repository.id, nextMode);
      return RepositoryRecordSchema.parse(repository);
    },
  );
  router.handle(
    RPC_PROCEDURES.gitInitializeRepository,
    async (event, raw: unknown): Promise<GitCreationTerminalEvent> => {
      assertTrustedSender(event, window);
      assertActiveCapability("gitMutation");
      const request = GitInitializeRepositoryRequestSchema.parse(raw);
      activeRequestIds.add(request.requestId);
      try {
        const terminal = GitCreationEventSchema.parse(
          await gitUtility.initializeRepository(request, creationListener),
        ) as GitCreationTerminalEvent;
        if (terminal.kind === "completed") {
          repositoryPaths.set(terminal.repository.id, terminal.repository.path);
          repositoryAccessModes.set(terminal.repository.id, "trusted");
        }
        if (activeRequestIds.has(request.requestId)) {
          stream.publish({
            kind: "git.barrier",
            operation: "creation",
            requestId: request.requestId,
          });
        }
        return terminal;
      } finally {
        activeRequestIds.delete(request.requestId);
      }
    },
  );
  router.handle(
    RPC_PROCEDURES.gitCloneRepository,
    async (event, raw: unknown): Promise<GitCreationTerminalEvent> => {
      assertTrustedSender(event, window);
      assertActiveCapability("gitMutation");
      const request = GitCloneRepositoryRequestSchema.parse(raw);
      activeRequestIds.add(request.requestId);
      try {
        const terminal = GitCreationEventSchema.parse(
          await gitUtility.cloneRepository(request, creationListener),
        ) as GitCreationTerminalEvent;
        if (terminal.kind === "completed") {
          repositoryPaths.set(terminal.repository.id, terminal.repository.path);
          repositoryAccessModes.set(terminal.repository.id, "trusted");
        }
        if (activeRequestIds.has(request.requestId)) {
          stream.publish({
            kind: "git.barrier",
            operation: "creation",
            requestId: request.requestId,
          });
        }
        return terminal;
      } finally {
        activeRequestIds.delete(request.requestId);
      }
    },
  );
  router.handle(
    RPC_PROCEDURES.gitCloseRepository,
    async (event, raw: unknown): Promise<boolean> => {
      assertTrustedSender(event, window);
      const request = GitCloseRepositoryRequestSchema.parse(raw);
      await terminalUtility.closeRepository(request);
      const closed = await gitUtility.closeRepository(request.repositoryId);
      repositoryPaths.delete(request.repositoryId);
      repositoryAccessModes.delete(request.repositoryId);
      return closed;
    },
  );
  router.handle(RPC_PROCEDURES.gitInspectSnapshot, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitRepositoryRequestSchema.parse(raw);
    return RepositorySnapshotSchema.parse(await gitUtility.inspectSnapshot(request.repositoryId));
  });
  router.handle(RPC_PROCEDURES.gitRepositoryService, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitRepositoryServiceRequestSchema.parse(raw);
    for (const repositoryId of repositoryServiceExecutableIds(request)) {
      assertRepositoryCapability(repositoryId, "gitMutation");
    }
    return GitRepositoryServiceResultSchema.parse(
      await gitUtility.executeRepositoryService(request),
    );
  });
  router.handle(RPC_PROCEDURES.gitQuery, async (event, raw: unknown): Promise<GitTerminalEvent> => {
    assertTrustedSender(event, window);
    const request = GitExecutionRequestSchema.parse(raw);
    if (request.kind === "operation") {
      assertRepositoryCapability(request.repositoryId, "gitMutation");
    }
    activeRequestIds.add(request.requestId);
    try {
      const terminal = await gitUtility.executeQuery(request, (gitEvent) => {
        if (window.isDestroyed() || window.webContents.isDestroyed()) return;
        if (
          gitEvent.kind === "completed" ||
          gitEvent.kind === "failed" ||
          gitEvent.kind === "cancelled"
        ) {
          return;
        }
        stream.publish({
          kind: "git.query.event",
          event: GitRequestEventSchema.parse(gitEvent),
        });
      });
      if (activeRequestIds.has(request.requestId)) {
        stream.publish({ kind: "git.barrier", operation: "query", requestId: request.requestId });
      }
      return GitTerminalResultSchema.parse(terminal);
    } finally {
      activeRequestIds.delete(request.requestId);
    }
  });
  router.handle(RPC_PROCEDURES.gitCancelQuery, async (event, raw: unknown): Promise<boolean> => {
    assertTrustedSender(event, window);
    const request = GitCancelQueryRequestSchema.parse(raw);
    return gitUtility.cancelQuery(request.requestId);
  });
  router.handle(RPC_PROCEDURES.gitReadFile, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitReadFileRequestSchema.parse(raw);
    return FileContentSchema.parse(
      await gitUtility.readFile(request.repositoryId, request.source, request.path),
    );
  });
  router.handle(RPC_PROCEDURES.gitReadFilePreview, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitReadFileRequestSchema.parse(raw);
    return FilePreviewSchema.parse(
      await gitUtility.readFilePreview(request.repositoryId, request.source, request.path),
    );
  });
  router.handle(
    RPC_PROCEDURES.gitWriteWorkingTreeFile,
    async (event, raw: unknown): Promise<void> => {
      assertTrustedSender(event, window);
      const request = GitWriteWorkingTreeFileRequestSchema.parse(raw);
      assertRepositoryCapability(request.repositoryId, "gitMutation");
      await gitUtility.writeWorkingTreeFile(
        request.repositoryId,
        request.path,
        request.content,
        request.activityName ?? undefined,
      );
    },
  );
  router.handle(
    RPC_PROCEDURES.gitOpenWorkingTreeFile,
    async (event, raw: unknown): Promise<void> => {
      assertTrustedSender(event, window);
      const request = GitWorkingTreeFileRequestSchema.parse(raw);
      assertRepositoryCapability(request.repositoryId, "externalExecution");
      const canonicalPath = await gitUtility.resolveWorkingTreeFile(
        request.repositoryId,
        request.path,
      );
      const error = await shell.openPath(canonicalPath);
      if (error.length > 0) {
        throw new Error(`Could not open working-tree file: ${error}`);
      }
    },
  );
  router.handle(RPC_PROCEDURES.gitWatchRepository, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const request = GitWatchRepositoryRequestSchema.parse(raw);
    await gitUtility.watchRepository(request.repositoryId, (repositoryEvent) => {
      if (window.isDestroyed() || window.webContents.isDestroyed()) return;
      stream.publish({
        kind: "repository.changed",
        event: RepositoryChangedEventSchema.parse(repositoryEvent),
      });
    });
    watchedRepositoryIds.add(request.repositoryId);
  });
  router.handle(RPC_PROCEDURES.gitUnwatchRepository, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const request = GitWatchRepositoryRequestSchema.parse(raw);
    try {
      await gitUtility.unwatchRepository(request.repositoryId);
    } finally {
      watchedRepositoryIds.delete(request.repositoryId);
    }
  });
  return unsubscribeDisconnect;
}

interface LocalHistoryGitHandlerDependencies {
  readonly router: DesktopRpcRouter;
  readonly window: BrowserWindow;
  readonly repositoryId: RepositoryId;
  readonly gitUtility: GitUtilityClient;
  readonly assertRepositoryCapability: (
    repositoryId: string,
    capability: ExecutableCapability,
  ) => void;
}

export function registerLocalHistoryGitHandler({
  router,
  window,
  repositoryId,
  gitUtility,
  assertRepositoryCapability,
}: LocalHistoryGitHandlerDependencies): void {
  router.handle(RPC_PROCEDURES.localHistoryRepositoryService, async (event, raw: unknown) => {
    assertTrustedLocalHistorySender(event, window, repositoryId);
    const request = parseLocalHistoryRepositoryRequest(raw);
    if (localHistoryRequestRepositoryId(request) !== repositoryId) {
      throw new Error("Local History cannot access a different repository.");
    }
    for (const executableRepositoryId of repositoryServiceExecutableIds(request)) {
      assertRepositoryCapability(executableRepositoryId, "gitMutation");
    }
    const result = GitRepositoryServiceResultSchema.parse(
      await gitUtility.executeRepositoryService(request),
    );
    if (result.operation !== request.operation) {
      throw new Error("Local History result did not match its request.");
    }
    return result;
  });
}
