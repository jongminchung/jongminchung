import { ipcMain, shell } from "electron";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
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
  IPC_CHANNELS,
} from "../../src/shared/contracts/ipc";
import {
  localHistoryRequestRepositoryId,
  parseLocalHistoryRepositoryRequest,
} from "../../src/shared/contracts/local-history-ipc";
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
  readonly localHistoryRepositoryFor?: (
    sender: IpcMainInvokeEvent["sender"],
  ) => RepositoryId | null;
}

export function registerGitHandlers(dependencies: GitHandlerDependencies): void {
  const {
    window,
    settings,
    gitUtility,
    terminalUtility,
    repositoryPaths,
    repositoryAccessModes,
    assertRepositoryCapability,
    assertActiveCapability,
    localHistoryRepositoryFor,
  } = dependencies;
  const creationListener: GitCreationEventListener = (creationEvent) => {
    if (window.isDestroyed() || window.webContents.isDestroyed()) return;
    window.webContents.send(
      IPC_CHANNELS.gitCreationEvent,
      GitCreationEventSchema.parse(creationEvent),
    );
  };
  const createdRepository = (terminal: GitCreationTerminalEvent): RepositoryRecord => {
    if (terminal.kind === "completed") return terminal.repository;
    if (terminal.kind === "failed") throw new Error(terminal.message);
    throw new Error("Repository creation was cancelled");
  };
  ipcMain.handle(
    IPC_CHANNELS.gitOpenRepository,
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
  ipcMain.handle(
    IPC_CHANNELS.gitInitializeRepository,
    async (event, raw: unknown): Promise<RepositoryRecord> => {
      assertTrustedSender(event, window);
      assertActiveCapability("gitMutation");
      const request = GitInitializeRepositoryRequestSchema.parse(raw);
      const terminal = await gitUtility.initializeRepository(request, creationListener);
      const repository = RepositoryRecordSchema.parse(createdRepository(terminal));
      repositoryPaths.set(repository.id, repository.path);
      repositoryAccessModes.set(repository.id, "trusted");
      return repository;
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.gitCloneRepository,
    async (event, raw: unknown): Promise<RepositoryRecord> => {
      assertTrustedSender(event, window);
      assertActiveCapability("gitMutation");
      const request = GitCloneRepositoryRequestSchema.parse(raw);
      const terminal = await gitUtility.cloneRepository(request, creationListener);
      const repository = RepositoryRecordSchema.parse(createdRepository(terminal));
      repositoryPaths.set(repository.id, repository.path);
      repositoryAccessModes.set(repository.id, "trusted");
      return repository;
    },
  );
  ipcMain.handle(IPC_CHANNELS.gitCloseRepository, async (event, raw: unknown): Promise<boolean> => {
    assertTrustedSender(event, window);
    const request = GitCloseRepositoryRequestSchema.parse(raw);
    await terminalUtility.closeRepository(request);
    const closed = await gitUtility.closeRepository(request.repositoryId);
    repositoryPaths.delete(request.repositoryId);
    repositoryAccessModes.delete(request.repositoryId);
    return closed;
  });
  ipcMain.handle(IPC_CHANNELS.gitInspectSnapshot, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitRepositoryRequestSchema.parse(raw);
    return RepositorySnapshotSchema.parse(await gitUtility.inspectSnapshot(request.repositoryId));
  });
  ipcMain.handle(IPC_CHANNELS.gitRepositoryService, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitRepositoryServiceRequestSchema.parse(raw);
    for (const repositoryId of repositoryServiceExecutableIds(request)) {
      assertRepositoryCapability(repositoryId, "gitMutation");
    }
    return GitRepositoryServiceResultSchema.parse(
      await gitUtility.executeRepositoryService(request),
    );
  });
  ipcMain.handle(IPC_CHANNELS.localHistoryRepositoryService, async (event, raw: unknown) => {
    const repositoryId = localHistoryRepositoryFor?.(event.sender) ?? null;
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
  ipcMain.handle(IPC_CHANNELS.gitQuery, async (event, raw: unknown): Promise<GitTerminalEvent> => {
    assertTrustedSender(event, window);
    const request = GitExecutionRequestSchema.parse(raw);
    if (request.kind === "operation") {
      assertRepositoryCapability(request.repositoryId, "gitMutation");
    }
    const terminal = await gitUtility.executeQuery(request, (gitEvent) => {
      if (window.isDestroyed() || window.webContents.isDestroyed()) return;
      window.webContents.send(IPC_CHANNELS.gitQueryEvent, GitRequestEventSchema.parse(gitEvent));
    });
    return GitTerminalResultSchema.parse(terminal);
  });
  ipcMain.handle(IPC_CHANNELS.gitCancelQuery, async (event, raw: unknown): Promise<boolean> => {
    assertTrustedSender(event, window);
    const request = GitCancelQueryRequestSchema.parse(raw);
    return gitUtility.cancelQuery(request.requestId);
  });
  ipcMain.handle(IPC_CHANNELS.gitReadFile, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitReadFileRequestSchema.parse(raw);
    return FileContentSchema.parse(
      await gitUtility.readFile(request.repositoryId, request.source, request.path),
    );
  });
  ipcMain.handle(IPC_CHANNELS.gitReadFilePreview, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitReadFileRequestSchema.parse(raw);
    return FilePreviewSchema.parse(
      await gitUtility.readFilePreview(request.repositoryId, request.source, request.path),
    );
  });
  ipcMain.handle(
    IPC_CHANNELS.gitWriteWorkingTreeFile,
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
  ipcMain.handle(
    IPC_CHANNELS.gitOpenWorkingTreeFile,
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
  ipcMain.handle(IPC_CHANNELS.gitWatchRepository, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const request = GitWatchRepositoryRequestSchema.parse(raw);
    await gitUtility.watchRepository(request.repositoryId, (repositoryEvent) => {
      if (window.isDestroyed() || window.webContents.isDestroyed()) return;
      window.webContents.send(
        IPC_CHANNELS.gitRepositoryChanged,
        RepositoryChangedEventSchema.parse(repositoryEvent),
      );
    });
  });
  ipcMain.handle(IPC_CHANNELS.gitUnwatchRepository, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const request = GitWatchRepositoryRequestSchema.parse(raw);
    await gitUtility.unwatchRepository(request.repositoryId);
  });
}
