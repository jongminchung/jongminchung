import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  FileContent,
  FilePreview,
  FileSource,
  GitCreationEventListener,
  GitCreationTerminalEvent,
  GitEventListener,
  GitQueryRequest,
  GitRequestId,
  GitRepositoryServiceRequest,
  GitRepositoryServiceResult,
  GitTerminalEvent,
  RepositoryChangedEvent,
  RepositoryChangedListener,
  RepositoryId,
  RepositoryRecord,
} from "../../src/shared/contracts/git-utility";
import {
  GIT_UTILITY_PROTOCOL_VERSION,
  GitUtilityToMainMessageSchema,
} from "../../src/shared/contracts/git-utility-process";
import type { RepositorySnapshot } from "../../src/shared/contracts/model";
import {
  GitUtilityProtocolServer,
  type GitUtilityServerPort,
  type GitUtilityServiceLike,
} from "../utility/git/utility-server";
import {
  TEST_REPOSITORY as REPOSITORY,
  TEST_REPOSITORY_ID as REPOSITORY_ID,
  TEST_SNAPSHOT as SNAPSHOT,
} from "./test/repository-fixtures";

const REQUEST_ID = "388ac97b-6f01-4e10-8149-78ec15412d18" as GitRequestId;
const FILE_SOURCE: FileSource = Object.freeze({ kind: "workingTree" });
const FILE_CONTENT: FileContent = Object.freeze({
  kind: "text",
  path: "tracked.txt",
  content: "content\n",
  sizeBytes: 8,
  lineCount: 1,
});
const FILE_PREVIEW: FilePreview = Object.freeze({
  kind: "image",
  preview: Object.freeze({
    path: "image.png",
    mimeType: "image/png",
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    sizeBytes: 8,
  }),
});
const REPOSITORY_CHANGED: RepositoryChangedEvent = {
  repositoryId: REPOSITORY_ID,
  invalidations: ["status", "history"],
};

function statusQuery(): GitQueryRequest {
  return {
    kind: "status",
    requestId: REQUEST_ID,
    repositoryId: REPOSITORY_ID,
  };
}

class FakeServerPort implements GitUtilityServerPort {
  readonly posted: unknown[] = [];
  readonly #listeners = new Set<(message: unknown) => void>();

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  subscribe(listener: (message: unknown) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(message: unknown): void {
    for (const listener of this.#listeners) listener(message);
  }
}

class FakeGitUtility implements GitUtilityServiceLike {
  readonly records: RepositoryRecord[] = [];
  closeCount = 0;
  cancelAllCount = 0;
  watcher: RepositoryChangedListener | null = null;

  async openRepository(): Promise<RepositoryRecord> {
    this.records.push(REPOSITORY);
    return REPOSITORY;
  }

  async initializeRepository(
    request: Readonly<{ requestId: GitRequestId }>,
    listener: GitCreationEventListener,
  ): Promise<GitCreationTerminalEvent> {
    listener({
      kind: "started",
      requestId: request.requestId,
      operation: "initialize",
      displayCommand: "git init --initial-branch=main -- /tmp/repository",
      startedAtMs: 1,
    });
    const terminal: GitCreationTerminalEvent = {
      kind: "completed",
      requestId: request.requestId,
      operation: "initialize",
      repository: REPOSITORY,
      exitCode: 0,
      durationMs: 2,
    };
    listener(terminal);
    return terminal;
  }

  cloneRepository(
    request: Readonly<{ requestId: GitRequestId }>,
    listener: GitCreationEventListener,
  ): Promise<GitCreationTerminalEvent> {
    return this.initializeRepository(request, listener);
  }

  closeRepository(): boolean {
    this.closeCount += 1;
    this.records.splice(0);
    return true;
  }

  listRepositories(): readonly RepositoryRecord[] {
    return this.records;
  }

  async inspectSnapshot(): Promise<RepositorySnapshot> {
    return SNAPSHOT;
  }

  async executeRepositoryService(
    request: GitRepositoryServiceRequest,
  ): Promise<GitRepositoryServiceResult> {
    switch (request.operation) {
      case "compareBranches":
        return {
          operation: request.operation,
          value: {
            ahead: 1,
            behind: 0,
            leftOnly: [SNAPSHOT.headOid!],
            rightOnly: [],
          },
        };
      case "preCommitCheck":
        return {
          operation: request.operation,
          value: {
            branch: "main",
            detachedHead: false,
            protectedBranch: true,
            crlfPaths: [],
            largeFiles: [],
            riskyPaths: [],
            hooks: [],
          },
        };
      case "listGitConfig":
        return { operation: request.operation, value: [] };
      case "listSubmodules":
        return { operation: request.operation, value: [] };
      case "listMergedBranches":
        return { operation: request.operation, value: ["main"] };
      case "loadCommitSignature":
        return {
          operation: request.operation,
          value: {
            status: "N",
            fingerprint: null,
            signer: null,
            keyId: null,
            trust: null,
          },
        };
      case "listRemotes":
        return { operation: request.operation, value: [] };
      case "listWorktrees":
        return { operation: request.operation, value: [] };
      case "readIgnoreRules":
        return {
          operation: request.operation,
          value: { gitignore: "", infoExclude: "" },
        };
      case "writeIgnoreRules":
        return { operation: request.operation };
      case "pushPreview":
        return {
          operation: request.operation,
          value: {
            sourceBranch: "main",
            sourceRevision: request.localRevision,
            localOid: SNAPSHOT.headOid!,
            remote: request.remote ?? "origin",
            remoteRef: request.remoteRef ?? "refs/heads/main",
            upstreamConfigured: true,
            setUpstreamDefault: false,
            remoteOid: SNAPSHOT.headOid,
            expectedLeaseOid: SNAPSHOT.headOid,
            ahead: 0,
            behind: 0,
            fastForward: true,
            newBranch: false,
            commits: [],
            remoteOnlyCommits: [],
            protectedBranch: true,
            checkedAtMs: 1,
            remoteStateError: null,
            warnings: [],
          },
        };
      case "historyRewritePreview":
        return {
          operation: request.operation,
          value: {
            branch: "main",
            headOid: SNAPSHOT.headOid!,
            base: null,
            root: true,
            entries: [
              {
                oid: SNAPSHOT.headOid!,
                subject: "fixture",
                parents: [],
                action: "pick",
                message: null,
                published: false,
                mergeCommit: false,
              },
            ],
            publishedCommitCount: 0,
            descendantCount: 1,
            dependentRefs: [],
            hasMerges: false,
            protectedBranch: true,
            warnings: [],
          },
        };
    }
    throw new Error(`Unsupported fixture operation ${request.operation}`);
  }

  async executeQuery(
    _request: unknown,
    listener: GitEventListener,
  ): Promise<GitTerminalEvent> {
    listener({
      kind: "started",
      requestId: REQUEST_ID,
      displayCommand: "git status",
      startedAtMs: 1,
    });
    const terminal: GitTerminalEvent = {
      kind: "completed",
      requestId: REQUEST_ID,
      exitCode: 0,
      durationMs: 1,
    };
    listener(terminal);
    return terminal;
  }

  async readFile(): Promise<FileContent> {
    return FILE_CONTENT;
  }

  async readFilePreview(): Promise<FilePreview> {
    return FILE_PREVIEW;
  }

  async writeWorkingTreeFile(): Promise<void> {}

  async watchRepository(
    _repositoryId: RepositoryId,
    listener: RepositoryChangedListener,
  ): Promise<void> {
    this.watcher = listener;
  }

  async unwatchRepository(): Promise<void> {
    this.watcher = null;
  }

  emitRepositoryChanged(event: RepositoryChangedEvent): void {
    this.watcher?.(event);
  }

  cancelQuery(): boolean {
    return true;
  }

  cancelAllCreations(): number {
    this.cancelAllCount += 1;
    return 0;
  }
}

async function flushServer(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("Git유틸리티프로토콜서버", () => {
  it("[성공] 일치하는 핸드셰이크가 필요하고 조종사 통신을 위한 회의/라우팅함", async () => {
    const port = new FakeServerPort();
    const utility = new FakeGitUtility();
    let disposed = false;
    const server = new GitUtilityProtocolServer(port, utility, {
      onDispose: () => (disposed = true),
    });
    server.start();
    const ready = GitUtilityToMainMessageSchema.parse(port.posted.at(-1));
    if (ready.kind !== "ready") throw new Error("Expected ready message");
    const handshakeId = randomUUID();
    port.emit({
      kind: "handshake",
      correlationId: handshakeId,
      protocolVersion: GIT_UTILITY_PROTOCOL_VERSION,
      instanceId: ready.instanceId,
    });
    await flushServer();
    expect(
      GitUtilityToMainMessageSchema.parse(port.posted.at(-1)),
    ).toMatchObject({
      kind: "handshakeAck",
      correlationId: handshakeId,
    });

    const openId = randomUUID();
    port.emit({
      kind: "openRepository",
      correlationId: openId,
      request: { path: "/tmp/repository" },
    });
    await flushServer();
    expect(
      GitUtilityToMainMessageSchema.parse(port.posted.at(-1)),
    ).toMatchObject({
      kind: "openRepositoryResult",
      correlationId: openId,
      repository: REPOSITORY,
    });

    const inspectId = randomUUID();
    port.emit({
      kind: "inspectSnapshot",
      correlationId: inspectId,
      repositoryId: REPOSITORY_ID,
    });
    await flushServer();
    expect(GitUtilityToMainMessageSchema.parse(port.posted.at(-1))).toEqual({
      kind: "inspectSnapshotResult",
      correlationId: inspectId,
      snapshot: SNAPSHOT,
    });

    const inspectionId = randomUUID();
    port.emit({
      kind: "repositoryService",
      correlationId: inspectionId,
      request: {
        operation: "compareBranches",
        repositoryId: REPOSITORY_ID,
        left: "feature",
        right: "main",
      },
    });
    await flushServer();
    expect(
      GitUtilityToMainMessageSchema.parse(port.posted.at(-1)),
    ).toMatchObject({
      kind: "repositoryServiceResult",
      correlationId: inspectionId,
      result: {
        operation: "compareBranches",
        value: { ahead: 1, behind: 0 },
      },
    });

    const rewritePreviewId = randomUUID();
    port.emit({
      kind: "repositoryService",
      correlationId: rewritePreviewId,
      request: {
        operation: "historyRewritePreview",
        repositoryId: REPOSITORY_ID,
        fromRevision: "HEAD~1",
      },
    });
    await flushServer();
    expect(
      GitUtilityToMainMessageSchema.parse(port.posted.at(-1)),
    ).toMatchObject({
      kind: "repositoryServiceResult",
      correlationId: rewritePreviewId,
      result: {
        operation: "historyRewritePreview",
        value: { branch: "main", descendantCount: 1 },
      },
    });

    const initializeId = randomUUID();
    port.emit({
      kind: "initializeRepository",
      correlationId: initializeId,
      request: {
        requestId: REQUEST_ID,
        path: "/tmp/repository",
        bare: false,
      },
    });
    await flushServer();
    const creationMessages = port.posted
      .map((message) => GitUtilityToMainMessageSchema.parse(message))
      .filter(
        (message) =>
          message.kind === "creationEvent" &&
          message.correlationId === initializeId,
      );
    expect(
      creationMessages.map((message) =>
        message.kind === "creationEvent" ? message.event.kind : "",
      ),
    ).toEqual(["started", "completed"]);

    const queryId = randomUUID();
    port.emit({
      kind: "query",
      correlationId: queryId,
      request: statusQuery(),
    });
    await flushServer();
    const queryMessages = port.posted
      .map((message) => GitUtilityToMainMessageSchema.parse(message))
      .filter(
        (message) =>
          message.kind === "queryEvent" && message.correlationId === queryId,
      );
    expect(
      queryMessages.map((message) =>
        message.kind === "queryEvent" ? message.event.kind : "",
      ),
    ).toEqual(["started", "completed"]);

    const readId = randomUUID();
    port.emit({
      kind: "readFile",
      correlationId: readId,
      request: {
        repositoryId: REPOSITORY_ID,
        source: FILE_SOURCE,
        path: "tracked.txt",
      },
    });
    await flushServer();
    expect(GitUtilityToMainMessageSchema.parse(port.posted.at(-1))).toEqual({
      kind: "readFileResult",
      correlationId: readId,
      content: FILE_CONTENT,
    });

    const previewId = randomUUID();
    port.emit({
      kind: "readFilePreview",
      correlationId: previewId,
      request: {
        repositoryId: REPOSITORY_ID,
        source: FILE_SOURCE,
        path: "image.png",
      },
    });
    await flushServer();
    expect(GitUtilityToMainMessageSchema.parse(port.posted.at(-1))).toEqual({
      kind: "readFilePreviewResult",
      correlationId: previewId,
      preview: FILE_PREVIEW,
    });

    const watchId = randomUUID();
    port.emit({
      kind: "watchRepository",
      correlationId: watchId,
      repositoryId: REPOSITORY_ID,
    });
    await flushServer();
    expect(
      GitUtilityToMainMessageSchema.parse(port.posted.at(-1)),
    ).toMatchObject({
      kind: "watchRepositoryResult",
      correlationId: watchId,
      repositoryId: REPOSITORY_ID,
    });
    utility.emitRepositoryChanged(REPOSITORY_CHANGED);
    expect(GitUtilityToMainMessageSchema.parse(port.posted.at(-1))).toEqual({
      kind: "repositoryChanged",
      event: REPOSITORY_CHANGED,
    });

    const unwatchId = randomUUID();
    port.emit({
      kind: "unwatchRepository",
      correlationId: unwatchId,
      repositoryId: REPOSITORY_ID,
    });
    await flushServer();
    expect(
      GitUtilityToMainMessageSchema.parse(port.posted.at(-1)),
    ).toMatchObject({
      kind: "unwatchRepositoryResult",
      correlationId: unwatchId,
      repositoryId: REPOSITORY_ID,
    });
    expect(utility.watcher).toBeNull();

    const disposeId = randomUUID();
    port.emit({ kind: "dispose", correlationId: disposeId });
    await flushServer();
    expect(
      GitUtilityToMainMessageSchema.parse(port.posted.at(-1)),
    ).toMatchObject({
      kind: "disposeResult",
      correlationId: disposeId,
    });
    expect(utility.closeCount).toBe(1);
    expect(utility.cancelAllCount).toBe(1);
    expect(disposed).toBe(true);
  });

  it("[실패] 일치하지 않는 핸드 셰이크에 대한 후속 조치를 반환함", async () => {
    const port = new FakeServerPort();
    const server = new GitUtilityProtocolServer(port, new FakeGitUtility());
    server.start();
    const ready = GitUtilityToMainMessageSchema.parse(port.posted.at(-1));
    if (ready.kind !== "ready") throw new Error("Expected ready message");
    port.emit({
      kind: "handshake",
      correlationId: randomUUID(),
      protocolVersion: GIT_UTILITY_PROTOCOL_VERSION + 1,
      instanceId: ready.instanceId,
    });
    await flushServer();

    expect(
      GitUtilityToMainMessageSchema.parse(port.posted.at(-1)),
    ).toMatchObject({
      kind: "error",
      code: "unsupportedProtocol",
    });
  });
});
