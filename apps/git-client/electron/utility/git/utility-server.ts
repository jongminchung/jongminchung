import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import type {
  GitCreationEventListener,
  GitCreationTerminalEvent,
  GitEventListener,
  FileContent,
  FilePreview,
  FileSource,
  GitRequestId,
  GitTerminalEvent,
  RepositoryRecord,
  RepositoryChangedListener,
  RepositoryId,
  RepositorySnapshot,
  GitRepositoryServiceResult,
} from "../../../src/shared/contracts/git-utility";
import {
  GIT_UTILITY_PROTOCOL_VERSION,
  GitUtilityToMainMessageSchema,
  MainToGitUtilityMessageSchema,
  type GitUtilityProtocolErrorCode,
  type GitUtilityToMainMessage,
  type MainToGitUtilityMessage,
} from "../../../src/shared/contracts/git-utility-process";
import { GitUtilityError } from "./git-error";
import { safeErrorMessage } from "./redaction";

export interface GitUtilityServerPort {
  postMessage(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
}

export interface GitUtilityServiceLike {
  openRepository(request: unknown): Promise<RepositoryRecord>;
  initializeRepository(
    request: unknown,
    listener: GitCreationEventListener,
  ): Promise<GitCreationTerminalEvent>;
  cloneRepository(
    request: unknown,
    listener: GitCreationEventListener,
  ): Promise<GitCreationTerminalEvent>;
  closeRepository(repositoryId: unknown): boolean;
  inspectSnapshot(repositoryId: unknown): Promise<RepositorySnapshot>;
  executeRepositoryService(request: unknown): Promise<GitRepositoryServiceResult>;
  listRepositories(): readonly RepositoryRecord[];
  executeQuery(request: unknown, listener: GitEventListener): Promise<GitTerminalEvent>;
  readFile(repositoryId: RepositoryId, source: FileSource, path: string): Promise<FileContent>;
  readFilePreview(
    repositoryId: RepositoryId,
    source: FileSource,
    path: string,
  ): Promise<FilePreview>;
  writeWorkingTreeFile(
    repositoryId: RepositoryId,
    path: string,
    content: string,
    activityName?: string,
  ): Promise<void>;
  watchRepository(repositoryId: RepositoryId, listener: RepositoryChangedListener): Promise<void>;
  unwatchRepository(repositoryId: RepositoryId): Promise<void>;
  cancelQuery(requestId: GitRequestId): boolean;
  cancelAllCreations(): number;
}

export interface GitUtilityServerOptions {
  readonly onDispose?: () => void;
}

export class GitUtilityProtocolServer {
  readonly #port: GitUtilityServerPort;
  readonly #utility: GitUtilityServiceLike;
  readonly #instanceId = randomUUID();
  readonly #onDispose: () => void;
  #unsubscribe: (() => void) | null = null;
  #handshaken = false;
  #disposed = false;

  constructor(
    port: GitUtilityServerPort,
    utility: GitUtilityServiceLike,
    options: GitUtilityServerOptions = {},
  ) {
    this.#port = port;
    this.#utility = utility;
    this.#onDispose = options.onDispose ?? (() => undefined);
  }

  start(): void {
    if (this.#unsubscribe !== null || this.#disposed) return;
    this.#unsubscribe = this.#port.subscribe((message) => {
      void this.#receive(message);
    });
    this.#post({
      kind: "ready",
      protocolVersion: GIT_UTILITY_PROTOCOL_VERSION,
      instanceId: this.#instanceId,
    });
  }

  async #receive(untrustedMessage: unknown): Promise<void> {
    if (this.#disposed) return;
    const result = MainToGitUtilityMessageSchema.safeParse(untrustedMessage);
    if (!result.success) {
      this.#postError(
        null,
        "invalidMessage",
        result.error.issues[0]?.message ?? "Invalid utility message",
      );
      return;
    }
    const message = result.data;
    if (message.kind === "handshake") {
      this.#handshake(message);
      return;
    }
    if (!this.#handshaken) {
      this.#postError(
        message.correlationId,
        "invalidRequest",
        "Handshake is required before commands",
      );
      return;
    }
    try {
      await this.#route(message);
    } catch (error) {
      const { code, message: detail } = this.#errorDetails(error);
      this.#postError(message.correlationId, code, detail);
    }
  }

  #handshake(message: Extract<MainToGitUtilityMessage, Readonly<{ kind: "handshake" }>>): void {
    if (this.#handshaken) {
      this.#postError(message.correlationId, "invalidRequest", "Handshake has already completed");
      return;
    }
    if (
      message.protocolVersion !== GIT_UTILITY_PROTOCOL_VERSION ||
      message.instanceId !== this.#instanceId
    ) {
      this.#postError(
        message.correlationId,
        "unsupportedProtocol",
        "Git utility protocol handshake failed",
      );
      return;
    }
    this.#handshaken = true;
    this.#post({
      kind: "handshakeAck",
      correlationId: message.correlationId,
      protocolVersion: GIT_UTILITY_PROTOCOL_VERSION,
      instanceId: this.#instanceId,
    });
  }

  async #route(
    message: Exclude<MainToGitUtilityMessage, Readonly<{ kind: "handshake" }>>,
  ): Promise<void> {
    switch (message.kind) {
      case "openRepository": {
        const repository = await this.#utility.openRepository(message.request);
        this.#post({
          kind: "openRepositoryResult",
          correlationId: message.correlationId,
          repository,
        });
        return;
      }
      case "initializeRepository": {
        await this.#utility.initializeRepository(message.request, (event) => {
          if (this.#disposed) return;
          this.#post({ kind: "creationEvent", correlationId: message.correlationId, event });
        });
        return;
      }
      case "cloneRepository": {
        await this.#utility.cloneRepository(message.request, (event) => {
          if (this.#disposed) return;
          this.#post({ kind: "creationEvent", correlationId: message.correlationId, event });
        });
        return;
      }
      case "closeRepository": {
        const closed = this.#utility.closeRepository(message.repositoryId);
        this.#post({ kind: "closeRepositoryResult", correlationId: message.correlationId, closed });
        return;
      }
      case "inspectSnapshot": {
        const snapshot = await this.#utility.inspectSnapshot(message.repositoryId);
        this.#post({
          kind: "inspectSnapshotResult",
          correlationId: message.correlationId,
          snapshot,
        });
        return;
      }
      case "repositoryService": {
        const result = await this.#utility.executeRepositoryService(message.request);
        this.#post({
          kind: "repositoryServiceResult",
          correlationId: message.correlationId,
          result,
        });
        return;
      }
      case "query": {
        await this.#utility.executeQuery(message.request, (event) => {
          if (this.#disposed) return;
          this.#post({ kind: "queryEvent", correlationId: message.correlationId, event });
        });
        return;
      }
      case "readFile": {
        const content = await this.#utility.readFile(
          message.request.repositoryId,
          message.request.source,
          message.request.path,
        );
        this.#post({ kind: "readFileResult", correlationId: message.correlationId, content });
        return;
      }
      case "readFilePreview": {
        const preview = await this.#utility.readFilePreview(
          message.request.repositoryId,
          message.request.source,
          message.request.path,
        );
        this.#post({
          kind: "readFilePreviewResult",
          correlationId: message.correlationId,
          preview,
        });
        return;
      }
      case "writeWorkingTreeFile": {
        await this.#utility.writeWorkingTreeFile(
          message.request.repositoryId,
          message.request.path,
          message.request.content,
          message.request.activityName ?? undefined,
        );
        this.#post({
          kind: "writeWorkingTreeFileResult",
          correlationId: message.correlationId,
        });
        return;
      }
      case "watchRepository": {
        await this.#utility.watchRepository(message.repositoryId, (event) => {
          if (this.#disposed) return;
          this.#post({ kind: "repositoryChanged", event });
        });
        this.#post({
          kind: "watchRepositoryResult",
          correlationId: message.correlationId,
          repositoryId: message.repositoryId,
        });
        return;
      }
      case "unwatchRepository": {
        await this.#utility.unwatchRepository(message.repositoryId);
        this.#post({
          kind: "unwatchRepositoryResult",
          correlationId: message.correlationId,
          repositoryId: message.repositoryId,
        });
        return;
      }
      case "cancel": {
        const cancelled = this.#utility.cancelQuery(message.requestId);
        this.#post({ kind: "cancelResult", correlationId: message.correlationId, cancelled });
        return;
      }
      case "dispose": {
        this.#utility.cancelAllCreations();
        for (const repository of this.#utility.listRepositories()) {
          this.#utility.closeRepository(repository.id);
        }
        this.#post({ kind: "disposeResult", correlationId: message.correlationId });
        this.#disposed = true;
        this.#unsubscribe?.();
        this.#unsubscribe = null;
        this.#onDispose();
        return;
      }
    }
  }

  #errorDetails(error: unknown): {
    readonly code: GitUtilityProtocolErrorCode;
    readonly message: string;
  } {
    if (error instanceof GitUtilityError)
      return { code: error.code, message: safeErrorMessage(error.message) };
    if (error instanceof ZodError) {
      return {
        code: "invalidRequest",
        message: safeErrorMessage(error.issues[0]?.message ?? "Invalid Git utility request"),
      };
    }
    return {
      code: "internalError",
      message: safeErrorMessage(
        error instanceof Error ? error.message : "Unknown Git utility failure",
      ),
    };
  }

  #post(message: GitUtilityToMainMessage): void {
    this.#port.postMessage(GitUtilityToMainMessageSchema.parse(message));
  }

  #postError(
    correlationId: string | null,
    code: GitUtilityProtocolErrorCode,
    message: string,
  ): void {
    this.#post({
      kind: "error",
      correlationId,
      code,
      message: safeErrorMessage(message),
    });
  }
}
