import { z } from "zod";
import type { DesktopApi } from "../../src/shared/contracts/desktop-api";
import { RPC_PROCEDURES } from "../../src/shared/contracts/desktop-rpc";
import {
  FileContentSchema,
  FilePreviewSchema,
  type GitCloneOptions,
  type GitCloneRepositoryRequest,
  GitCloneRepositoryRequestSchema,
  GitCreationEventSchema,
  type GitCreationEventListener,
  type GitCreationTerminalEvent,
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
} from "../../src/shared/contracts/ipc";
import { desktopStream } from "./desktop-stream-client";
import {
  createGitRepositoryServiceApi,
  invokeRepositoryService,
} from "./git-repository-service-api";
import { gitStreamEvents } from "./git-stream-events";
import { invokeDesktopRpc } from "./rpc-client";

const BooleanResultSchema = z.boolean();

async function invokeRepositoryCreation(
  channel: typeof RPC_PROCEDURES.gitInitializeRepository | typeof RPC_PROCEDURES.gitCloneRepository,
  request: GitInitializeRepositoryRequest | GitCloneRepositoryRequest,
  listener: GitCreationEventListener | undefined,
): Promise<RepositoryRecord> {
  await desktopStream.ready();
  if (listener !== undefined) {
    if (gitStreamEvents.creationListeners.has(request.requestId)) {
      throw new Error(`Git request ${request.requestId} is already running in this renderer`);
    }
    gitStreamEvents.creationListeners.set(request.requestId, listener);
  }
  try {
    const raw: unknown = await invokeDesktopRpc(channel, request);
    const terminal = GitCreationEventSchema.parse(raw) as GitCreationTerminalEvent;
    if (terminal.requestId !== request.requestId) {
      throw new Error("Git creation result did not match its request");
    }
    await gitStreamEvents.waitForBarrier("creation", request.requestId);
    if (listener !== undefined) gitStreamEvents.deliverCreationEvent(listener, terminal);
    if (terminal.kind === "completed") return RepositoryRecordSchema.parse(terminal.repository);
    if (terminal.kind === "failed") throw new Error(terminal.message);
    throw new Error("Repository creation was cancelled");
  } finally {
    if (
      listener !== undefined &&
      gitStreamEvents.creationListeners.get(request.requestId) === listener
    ) {
      gitStreamEvents.creationListeners.delete(request.requestId);
    }
  }
}

export function createGitApi(): DesktopApi["git"] {
  return {
    async openRepository(path: string): Promise<RepositoryRecord> {
      const request = OpenRepositoryRequestSchema.parse({ path });
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.gitOpenRepository, request);
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
      return invokeRepositoryCreation(RPC_PROCEDURES.gitInitializeRepository, request, listener);
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
      return invokeRepositoryCreation(RPC_PROCEDURES.gitCloneRepository, request, listener);
    },
    async closeRepository(repositoryId: RepositoryId): Promise<boolean> {
      const request = GitCloseRepositoryRequestSchema.parse({
        repositoryId,
      });
      try {
        const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.gitCloseRepository, request);
        return BooleanResultSchema.parse(raw);
      } finally {
        gitStreamEvents.repositoryListeners.delete(request.repositoryId);
      }
    },
    async inspectSnapshot(repositoryId) {
      const request = GitRepositoryRequestSchema.parse({ repositoryId });
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.gitInspectSnapshot, request);
      return RepositorySnapshotSchema.parse(raw);
    },
    ...createGitRepositoryServiceApi(),
    async executeQuery(
      untrustedRequest: GitExecutionRequest,
      listener: GitEventListener,
    ): Promise<GitTerminalEvent> {
      const request = GitExecutionRequestSchema.parse(untrustedRequest);
      await desktopStream.ready();
      if (gitStreamEvents.queryListeners.has(request.requestId)) {
        throw new Error(`Git request ${request.requestId} is already running in this renderer`);
      }
      gitStreamEvents.queryListeners.set(request.requestId, listener);
      try {
        const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.gitQuery, request);
        const terminal = GitTerminalResultSchema.parse(raw);
        if (terminal.requestId !== request.requestId) {
          throw new Error("Git query result did not match its request");
        }
        await gitStreamEvents.waitForBarrier("query", request.requestId);
        if (gitStreamEvents.queryListeners.get(request.requestId) === listener) {
          gitStreamEvents.deliverQueryEvent(listener, terminal);
        }
        return terminal;
      } finally {
        if (gitStreamEvents.queryListeners.get(request.requestId) === listener) {
          gitStreamEvents.queryListeners.delete(request.requestId);
        }
      }
    },
    async cancelQuery(requestId: GitRequestId): Promise<boolean> {
      const request = GitCancelQueryRequestSchema.parse({ requestId });
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.gitCancelQuery, request);
      return BooleanResultSchema.parse(raw);
    },
    async readFile(repositoryId, source, path) {
      const request = GitReadFileRequestSchema.parse({
        repositoryId,
        source,
        path,
      });
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.gitReadFile, request);
      return FileContentSchema.parse(raw);
    },
    async readFilePreview(repositoryId, source, path) {
      const request = GitReadFileRequestSchema.parse({
        repositoryId,
        source,
        path,
      });
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.gitReadFilePreview, request);
      return FilePreviewSchema.parse(raw);
    },
    async writeWorkingTreeFile(repositoryId, path, content, activityName): Promise<void> {
      const request = GitWriteWorkingTreeFileRequestSchema.parse({
        repositoryId,
        path,
        content,
        activityName: activityName ?? null,
      });
      await invokeDesktopRpc(RPC_PROCEDURES.gitWriteWorkingTreeFile, request);
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
      await invokeDesktopRpc(RPC_PROCEDURES.gitOpenWorkingTreeFile, request);
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
      await desktopStream.ready();
      if (gitStreamEvents.repositoryListeners.has(request.repositoryId)) {
        gitStreamEvents.repositoryListeners.set(request.repositoryId, listener);
        return;
      }
      gitStreamEvents.repositoryListeners.set(request.repositoryId, listener);
      try {
        await invokeDesktopRpc(RPC_PROCEDURES.gitWatchRepository, request);
      } catch (error) {
        if (gitStreamEvents.repositoryListeners.get(request.repositoryId) === listener) {
          gitStreamEvents.repositoryListeners.delete(request.repositoryId);
        }
        throw error;
      }
    },
    async unwatchRepository(repositoryId): Promise<void> {
      const request = GitWatchRepositoryRequestSchema.parse({
        repositoryId,
      });
      try {
        await invokeDesktopRpc(RPC_PROCEDURES.gitUnwatchRepository, request);
      } finally {
        gitStreamEvents.repositoryListeners.delete(request.repositoryId);
      }
    },
  };
}
