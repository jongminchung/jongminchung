import { shell } from "electron";
import type { BrowserWindow } from "electron";
import type {
  LocalHistoryDesktopTrpcRouter,
  MainDesktopTrpcRouter,
} from "../../src/shared/contracts/desktop-trpc";
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
import { parseLocalHistoryRepositoryRequest } from "../../src/shared/contracts/local-history-ipc";
import type { DesktopStreamPublisher } from "./desktop-stream-hub";
import type { DesktopTrpcHost } from "./desktop-trpc-host";
import type { GitUtilityClient } from "./git-utility-client";
import { safeRepositoryPaths } from "./repository-capabilities";
import type { SettingsStore } from "./settings-store";
import type { TerminalUtilityClient } from "./terminal-utility-client";

interface GitHandlerDependencies {
  readonly router: DesktopTrpcHost<MainDesktopTrpcRouter>;
  readonly stream: DesktopStreamPublisher;
  readonly window: BrowserWindow;
  readonly settings: SettingsStore;
  readonly gitUtility: GitUtilityClient;
  readonly terminalUtility: TerminalUtilityClient;
  readonly repositoryPaths: Map<string, string>;
  readonly repositoryAccessModes: Map<string, "trusted" | "safe">;
}

export function registerGitHandlers(
  dependencies: GitHandlerDependencies,
): () => void {
  const {
    router,
    stream,
    window,
    settings,
    gitUtility,
    terminalUtility,
    repositoryPaths,
    repositoryAccessModes,
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
    "git",
    "openRepository",
    async (_event, raw): Promise<RepositoryRecord> => {
      const request = OpenRepositoryRequestSchema.parse(raw);
      const repository = await gitUtility.openRepository(request.path);
      const safePaths = safeRepositoryPaths(settings);
      const nextMode =
        safePaths.has(request.path) || safePaths.has(repository.path)
          ? "safe"
          : "trusted";
      if (nextMode === "safe") {
        const repositoriesToClose = [...repositoryPaths.entries()].flatMap(
          ([id, path]) =>
            path === repository.path &&
            repositoryAccessModes.get(id) === "trusted"
              ? [id]
              : [],
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
    "git",
    "initializeRepository",
    async (_event, raw): Promise<GitCreationTerminalEvent> => {
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
    "git",
    "cloneRepository",
    async (_event, raw): Promise<GitCreationTerminalEvent> => {
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
    "git",
    "closeRepository",
    async (_event, raw): Promise<boolean> => {
      const request = GitCloseRepositoryRequestSchema.parse(raw);
      await terminalUtility.closeRepository(request);
      const closed = await gitUtility.closeRepository(request.repositoryId);
      repositoryPaths.delete(request.repositoryId);
      repositoryAccessModes.delete(request.repositoryId);
      return closed;
    },
  );
  router.handle("git", "inspectSnapshot", async (_event, raw) => {
    const request = GitRepositoryRequestSchema.parse(raw);
    return RepositorySnapshotSchema.parse(
      await gitUtility.inspectSnapshot(request.repositoryId),
    );
  });
  router.handle("git", "repositoryService", async (_event, raw) => {
    const request = GitRepositoryServiceRequestSchema.parse(raw);
    return GitRepositoryServiceResultSchema.parse(
      await gitUtility.executeRepositoryService(request),
    );
  });
  router.handle(
    "git",
    "query",
    async (_event, raw): Promise<GitTerminalEvent> => {
      const request = GitExecutionRequestSchema.parse(raw);
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
          stream.publish({
            kind: "git.barrier",
            operation: "query",
            requestId: request.requestId,
          });
        }
        return GitTerminalResultSchema.parse(terminal);
      } finally {
        activeRequestIds.delete(request.requestId);
      }
    },
  );
  router.handle("git", "cancelQuery", async (_event, raw): Promise<boolean> => {
    const request = GitCancelQueryRequestSchema.parse(raw);
    return gitUtility.cancelQuery(request.requestId);
  });
  router.handle("git", "readFile", async (_event, raw) => {
    const request = GitReadFileRequestSchema.parse(raw);
    return FileContentSchema.parse(
      await gitUtility.readFile(
        request.repositoryId,
        request.source,
        request.path,
      ),
    );
  });
  router.handle("git", "readFilePreview", async (_event, raw) => {
    const request = GitReadFileRequestSchema.parse(raw);
    return FilePreviewSchema.parse(
      await gitUtility.readFilePreview(
        request.repositoryId,
        request.source,
        request.path,
      ),
    );
  });
  router.handle(
    "git",
    "writeWorkingTreeFile",
    async (_event, raw): Promise<void> => {
      const request = GitWriteWorkingTreeFileRequestSchema.parse(raw);
      await gitUtility.writeWorkingTreeFile(
        request.repositoryId,
        request.path,
        request.content,
        request.activityName ?? undefined,
      );
    },
  );
  router.handle(
    "git",
    "openWorkingTreeFile",
    async (_event, raw): Promise<void> => {
      const request = GitWorkingTreeFileRequestSchema.parse(raw);
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
  router.handle(
    "git",
    "watchRepository",
    async (_event, raw): Promise<void> => {
      const request = GitWatchRepositoryRequestSchema.parse(raw);
      await gitUtility.watchRepository(
        request.repositoryId,
        (repositoryEvent) => {
          if (window.isDestroyed() || window.webContents.isDestroyed()) return;
          stream.publish({
            kind: "repository.changed",
            event: RepositoryChangedEventSchema.parse(repositoryEvent),
          });
        },
      );
      watchedRepositoryIds.add(request.repositoryId);
    },
  );
  router.handle(
    "git",
    "unwatchRepository",
    async (_event, raw): Promise<void> => {
      const request = GitWatchRepositoryRequestSchema.parse(raw);
      try {
        await gitUtility.unwatchRepository(request.repositoryId);
      } finally {
        watchedRepositoryIds.delete(request.repositoryId);
      }
    },
  );
  return unsubscribeDisconnect;
}

interface LocalHistoryGitHandlerDependencies {
  readonly router: DesktopTrpcHost<LocalHistoryDesktopTrpcRouter>;
  readonly gitUtility: GitUtilityClient;
}

export function registerLocalHistoryGitHandler({
  router,
  gitUtility,
}: LocalHistoryGitHandlerDependencies): void {
  router.handle("localHistory", "repositoryService", async (_event, raw) => {
    const request = parseLocalHistoryRepositoryRequest(raw);
    const result = GitRepositoryServiceResultSchema.parse(
      await gitUtility.executeRepositoryService(request),
    );
    if (result.operation !== request.operation) {
      throw new Error("Local History result did not match its request.");
    }
    return result;
  });
}
