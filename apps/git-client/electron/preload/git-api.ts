import { ipcRenderer } from "electron";
import { z } from "zod";
import {
  FileContentSchema,
  FilePreviewSchema,
  type GitCloneOptions,
  type GitCloneRepositoryRequest,
  GitCloneRepositoryRequestSchema,
  type GitCreationEventListener,
  type GitEventListener,
  type GitExecutionRequest,
  GitExecutionRequestSchema,
  type GitInitializeRepositoryRequest,
  GitInitializeRepositoryRequestSchema,
  GitReadFileRequestSchema,
  type GitRequestId,
  type GitTerminalEvent,
  GitWatchRepositoryRequestSchema,
  GitWorkingTreeFileRequestSchema,
  GitWriteWorkingTreeFileRequestSchema,
  OpenRepositoryRequestSchema,
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
import type { DesktopApi } from "../../src/shared/contracts/ipc";
import { gitListenerRegistry } from "./git-listener-registry";
import {
  createGitRepositoryServiceApi,
  invokeRepositoryService,
} from "./git-repository-service-api";

const BooleanResultSchema = z.boolean();

async function invokeRepositoryCreation(
  channel: typeof IPC_CHANNELS.gitInitializeRepository | typeof IPC_CHANNELS.gitCloneRepository,
  request: GitInitializeRepositoryRequest | GitCloneRepositoryRequest,
  listener: GitCreationEventListener | undefined,
): Promise<RepositoryRecord> {
  if (listener !== undefined) {
    if (gitListenerRegistry.creationListeners.has(request.requestId)) {
      throw new Error(`Git request ${request.requestId} is already running in this renderer`);
    }
    gitListenerRegistry.creationListeners.set(request.requestId, listener);
  }
  try {
    const raw: unknown = await ipcRenderer.invoke(channel, request);
    return RepositoryRecordSchema.parse(raw);
  } finally {
    if (
      listener !== undefined &&
      gitListenerRegistry.creationListeners.get(request.requestId) === listener
    ) {
      gitListenerRegistry.creationListeners.delete(request.requestId);
    }
  }
}

export function createGitApi(): DesktopApi["git"] {
  return {
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
        gitListenerRegistry.repositoryListeners.delete(request.repositoryId);
      }
    },
    async inspectSnapshot(repositoryId) {
      const request = GitRepositoryRequestSchema.parse({ repositoryId });
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.gitInspectSnapshot, request);
      return RepositorySnapshotSchema.parse(raw);
    },
    ...createGitRepositoryServiceApi(),
    async executeQuery(
      untrustedRequest: GitExecutionRequest,
      listener: GitEventListener,
    ): Promise<GitTerminalEvent> {
      const request = GitExecutionRequestSchema.parse(untrustedRequest);
      if (gitListenerRegistry.queryListeners.has(request.requestId)) {
        throw new Error(`Git request ${request.requestId} is already running in this renderer`);
      }
      let resolveTerminalEvent = (): void => undefined;
      const terminalEvent = new Promise<void>((resolve) => {
        resolveTerminalEvent = resolve;
      });
      gitListenerRegistry.queryListeners.set(request.requestId, listener);
      gitListenerRegistry.queryTerminalWaiters.set(request.requestId, resolveTerminalEvent);
      try {
        const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.gitQuery, request);
        const terminal = GitTerminalResultSchema.parse(raw);
        if (terminal.requestId !== request.requestId) {
          throw new Error("Git query result did not match its request");
        }
        await gitListenerRegistry.waitForGitTerminalEvent(terminalEvent);
        if (gitListenerRegistry.queryListeners.get(request.requestId) === listener) {
          gitListenerRegistry.deliverGitEvent(listener, terminal);
        }
        return terminal;
      } finally {
        gitListenerRegistry.queryTerminalWaiters.delete(request.requestId);
        if (gitListenerRegistry.queryListeners.get(request.requestId) === listener) {
          gitListenerRegistry.queryListeners.delete(request.requestId);
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
      if (gitListenerRegistry.repositoryListeners.has(request.repositoryId)) {
        gitListenerRegistry.repositoryListeners.set(request.repositoryId, listener);
        return;
      }
      gitListenerRegistry.repositoryListeners.set(request.repositoryId, listener);
      try {
        await ipcRenderer.invoke(IPC_CHANNELS.gitWatchRepository, request);
      } catch (error) {
        if (gitListenerRegistry.repositoryListeners.get(request.repositoryId) === listener) {
          gitListenerRegistry.repositoryListeners.delete(request.repositoryId);
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
        gitListenerRegistry.repositoryListeners.delete(request.repositoryId);
      }
    },
  };
}
