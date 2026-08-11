import { describe, expect, it } from "vitest";
import {
  type GitCreationEvent,
  type GitQueryRequest,
  type GitRequestEvent,
  type GitRequestId,
  type GitRepositoryServiceRequest,
  type GitRepositoryServiceResult,
  type FileContent,
  type FilePreview,
  type FileSource,
  type RepositoryChangedEvent,
  type RepositoryId,
} from "../../src/shared/contracts/git-utility";
import {
  GIT_UTILITY_PROTOCOL_VERSION,
  MainToGitUtilityMessageSchema,
  type MainToGitUtilityMessage,
} from "../../src/shared/contracts/git-utility-process";
import {
  GitUtilityClient,
  type GitUtilityClientConnectOptions,
  type GitUtilityProcessTransport,
} from "./git-utility-client";
import {
  TEST_REPOSITORY as REPOSITORY,
  TEST_REPOSITORY_ID as REPOSITORY_ID,
  TEST_SNAPSHOT as SNAPSHOT,
} from "./test/repository-fixtures";

const INSTANCE_ID = "fd312e4e-5856-4afe-bfca-b34f35880429";
const SECOND_REPOSITORY_ID = "50dce2ce-cd90-4f4a-8af7-dbb005bf7262" as RepositoryId;
const REQUEST_ID = "388ac97b-6f01-4e10-8149-78ec15412d18" as GitRequestId;
const PUSH_PREVIEW = {
  sourceBranch: "main",
  sourceRevision: "HEAD",
  localOid: SNAPSHOT.headOid!,
  remote: "origin",
  remoteRef: "refs/heads/main",
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
};
const HISTORY_REWRITE_PREVIEW = {
  branch: "main",
  headOid: SNAPSHOT.headOid!,
  base: null,
  root: true,
  entries: [
    {
      oid: SNAPSHOT.headOid!,
      subject: "fixture",
      parents: [],
      action: "pick" as const,
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
};
const FILE_SOURCE: FileSource = Object.freeze({ kind: "workingTree" });
const FILE_CONTENT: FileContent = Object.freeze({
  kind: "text",
  path: "tracked.txt",
  content: "content\n",
  sizeBytes: 8,
  lineCount: 1,
});
const LINE_LIMIT_CONTENT: FileContent = Object.freeze({
  kind: "tooLarge",
  path: "many-lines.txt",
  sizeBytes: 100_002,
  lineCount: 50_001,
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

class FakeUtilityProcessTransport implements GitUtilityProcessTransport {
  readonly posted: unknown[] = [];
  readonly #messageListeners = new Set<(message: unknown) => void>();
  readonly #exitListeners = new Set<(exitCode: number) => void>();
  readonly #errorListeners = new Set<(message: string) => void>();
  killCount = 0;

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  subscribeMessage(listener: (message: unknown) => void): () => void {
    this.#messageListeners.add(listener);
    return () => this.#messageListeners.delete(listener);
  }

  subscribeExit(listener: (exitCode: number) => void): () => void {
    this.#exitListeners.add(listener);
    return () => this.#exitListeners.delete(listener);
  }

  subscribeError(listener: (message: string) => void): () => void {
    this.#errorListeners.add(listener);
    return () => this.#errorListeners.delete(listener);
  }

  kill(): boolean {
    this.killCount += 1;
    return true;
  }

  emitMessage(message: unknown): void {
    for (const listener of this.#messageListeners) listener(message);
  }

  emitExit(exitCode: number): void {
    for (const listener of this.#exitListeners) listener(exitCode);
  }
}

function lastMainMessage(transport: FakeUtilityProcessTransport): MainToGitUtilityMessage {
  return MainToGitUtilityMessageSchema.parse(transport.posted.at(-1));
}

async function connectClient(
  transport = new FakeUtilityProcessTransport(),
  options: GitUtilityClientConnectOptions = {},
): Promise<{
  readonly client: GitUtilityClient;
  readonly transport: FakeUtilityProcessTransport;
}> {
  const connecting = GitUtilityClient.connect(transport, {
    handshakeTimeoutMs: 1_000,
    ...options,
  });
  transport.emitMessage({
    kind: "ready",
    protocolVersion: GIT_UTILITY_PROTOCOL_VERSION,
    instanceId: INSTANCE_ID,
  });
  const handshake = lastMainMessage(transport);
  if (handshake.kind !== "handshake") throw new Error("Expected handshake request");
  transport.emitMessage({
    kind: "handshakeAck",
    correlationId: handshake.correlationId,
    protocolVersion: GIT_UTILITY_PROTOCOL_VERSION,
    instanceId: INSTANCE_ID,
  });
  return { client: await connecting, transport };
}

function statusQuery(): GitQueryRequest {
  return {
    kind: "status",
    requestId: REQUEST_ID,
    repositoryId: REPOSITORY_ID,
  };
}

describe("GitUtilityClient", () => {
  it("handshakes and correlates an open repository response", async () => {
    const { client, transport } = await connectClient();
    const opening = client.openRepository("/tmp/repository");
    const request = lastMainMessage(transport);
    if (request.kind !== "openRepository") throw new Error("Expected open request");

    transport.emitMessage({
      kind: "openRepositoryResult",
      correlationId: request.correlationId,
      repository: REPOSITORY,
    });

    await expect(opening).resolves.toEqual(REPOSITORY);
    expect(client.state).toBe("ready");
  });

  it("correlates a complete inspected snapshot by repository id", async () => {
    const { client, transport } = await connectClient();
    const inspecting = client.inspectSnapshot(REPOSITORY_ID);
    const request = lastMainMessage(transport);
    if (request.kind !== "inspectSnapshot") throw new Error("Expected snapshot inspection request");
    expect(request.repositoryId).toBe(REPOSITORY_ID);

    transport.emitMessage({
      kind: "inspectSnapshotResult",
      correlationId: request.correlationId,
      snapshot: SNAPSHOT,
    });

    await expect(inspecting).resolves.toEqual(SNAPSHOT);
  });

  it("correlates strict repository inspection and ignore-rule operations", async () => {
    const { client, transport } = await connectClient();
    const comparing = client.compareBranches(REPOSITORY_ID, "feature", "main");
    const compareRequest = lastMainMessage(transport);
    if (compareRequest.kind !== "repositoryService") {
      throw new Error("Expected repository service request");
    }
    expect(compareRequest.request).toEqual({
      operation: "compareBranches",
      repositoryId: REPOSITORY_ID,
      left: "feature",
      right: "main",
    });
    const comparison = {
      ahead: 1,
      behind: 0,
      leftOnly: [SNAPSHOT.headOid!],
      rightOnly: [],
    };
    transport.emitMessage({
      kind: "repositoryServiceResult",
      correlationId: compareRequest.correlationId,
      result: { operation: "compareBranches", value: comparison },
    });
    await expect(comparing).resolves.toEqual(comparison);

    const writing = client.writeIgnoreRules(REPOSITORY_ID, {
      gitignore: "dist/\n",
      infoExclude: ".cache/\n",
    });
    const writeRequest = lastMainMessage(transport);
    if (writeRequest.kind !== "repositoryService") {
      throw new Error("Expected ignore-rules service request");
    }
    transport.emitMessage({
      kind: "repositoryServiceResult",
      correlationId: writeRequest.correlationId,
      result: { operation: "writeIgnoreRules" },
    });
    await expect(writing).resolves.toBeUndefined();
  });

  it("correlates strict direct push and history rewrite preview results", async () => {
    const { client, transport } = await connectClient();
    const loadingPush = client.loadPushPreview(REPOSITORY_ID, "origin", "refs/heads/main", "HEAD");
    const pushRequest = lastMainMessage(transport);
    if (pushRequest.kind !== "repositoryService") {
      throw new Error("Expected push preview repository service request");
    }
    expect(pushRequest.request).toEqual({
      operation: "pushPreview",
      repositoryId: REPOSITORY_ID,
      remote: "origin",
      remoteRef: "refs/heads/main",
      localRevision: "HEAD",
    });
    transport.emitMessage({
      kind: "repositoryServiceResult",
      correlationId: pushRequest.correlationId,
      result: { operation: "pushPreview", value: PUSH_PREVIEW },
    });
    await expect(loadingPush).resolves.toEqual(PUSH_PREVIEW);

    const loadingRewrite = client.loadHistoryRewritePreview(REPOSITORY_ID, "HEAD~1");
    const rewriteRequest = lastMainMessage(transport);
    if (rewriteRequest.kind !== "repositoryService") {
      throw new Error("Expected history rewrite repository service request");
    }
    transport.emitMessage({
      kind: "repositoryServiceResult",
      correlationId: rewriteRequest.correlationId,
      result: {
        operation: "historyRewritePreview",
        value: HISTORY_REWRITE_PREVIEW,
      },
    });
    await expect(loadingRewrite).resolves.toEqual(HISTORY_REWRITE_PREVIEW);
  });

  it("correlates every typed special repository service method", async () => {
    const { client, transport } = await connectClient();
    const shelfId = "896b19c6-dd8f-4f7b-a591-cf701e86457c";
    const changelistId = "723094e7-bf3b-4d3e-8f74-6cebe9571840";
    const recoveryId = "53f66fe0-6b52-4a69-9b9f-b07c724f9095";
    const checksum = "a".repeat(64);
    const objectId = SNAPSHOT.headOid;
    if (objectId === null) throw new Error("Fixture HEAD is required");
    const shelf = {
      id: shelfId,
      repositoryId: REPOSITORY_ID,
      message: "saved",
      createdAtMs: 1,
      files: [{ path: "tracked.txt", checksum: "", untracked: false }],
      indexPatchChecksum: checksum,
      worktreePatchChecksum: checksum,
    };
    const changelist = {
      id: changelistId,
      repositoryId: REPOSITORY_ID,
      name: "selected",
      paths: ["tracked.txt"],
      createdAtMs: 1,
      updatedAtMs: 1,
    };
    const recovery = {
      id: recoveryId,
      repositoryId: REPOSITORY_ID,
      operation: "commit",
      createdAtMs: 1,
      branch: "main",
      headOid: SNAPSHOT.headOid,
      refs: [{ name: "refs/heads/main", oid: SNAPSHOT.headOid }],
      recoverable: true,
    };
    const conflict = {
      path: "tracked.txt",
      baseOid: SNAPSHOT.headOid,
      localOid: SNAPSHOT.headOid,
      remoteOid: SNAPSHOT.headOid,
      binary: false,
    };
    const conflictContent = {
      path: "tracked.txt",
      base: "base\n",
      local: "local\n",
      remote: "remote\n",
      result: "result\n",
      binary: false,
      localLabel: "HEAD",
      remoteLabel: "feature",
    };
    const scenarios: readonly Readonly<{
      operation: GitRepositoryServiceRequest["operation"];
      invoke: () => Promise<unknown>;
      result: GitRepositoryServiceResult;
    }>[] = [
      {
        operation: "exportPatch",
        invoke: () => client.exportPatch(REPOSITORY_ID, ["HEAD"], "/tmp/export.patch"),
        result: {
          operation: "exportPatch",
          value: {
            path: "/tmp/export.patch",
            sizeBytes: 128,
            commitCount: 1,
          },
        },
      },
      {
        operation: "createPatchText",
        invoke: () => client.createPatchText(REPOSITORY_ID, ["HEAD"]),
        result: { operation: "createPatchText", value: "patch text" },
      },
      {
        operation: "importPatch",
        invoke: () => client.importPatch(REPOSITORY_ID, "/tmp/import.patch"),
        result: { operation: "importPatch" },
      },
      {
        operation: "createShelf",
        invoke: () => client.createShelf(REPOSITORY_ID, "saved", ["tracked.txt"]),
        result: { operation: "createShelf", value: shelf },
      },
      {
        operation: "listShelves",
        invoke: () => client.listShelves(REPOSITORY_ID),
        result: { operation: "listShelves", value: [shelf] },
      },
      {
        operation: "applyShelf",
        invoke: () => client.applyShelf(REPOSITORY_ID, shelfId, true),
        result: { operation: "applyShelf" },
      },
      {
        operation: "deleteShelf",
        invoke: () => client.deleteShelf(REPOSITORY_ID, shelfId),
        result: { operation: "deleteShelf" },
      },
      {
        operation: "listChangelists",
        invoke: () => client.listChangelists(REPOSITORY_ID),
        result: {
          operation: "listChangelists",
          value: [changelist],
        },
      },
      {
        operation: "saveChangelist",
        invoke: () => client.saveChangelist(REPOSITORY_ID, null, "selected", ["tracked.txt"]),
        result: { operation: "saveChangelist", value: changelist },
      },
      {
        operation: "deleteChangelist",
        invoke: () => client.deleteChangelist(REPOSITORY_ID, changelistId),
        result: { operation: "deleteChangelist" },
      },
      {
        operation: "commitChangelist",
        invoke: () =>
          client.commitChangelist(REPOSITORY_ID, changelistId, "commit", false, false, false),
        result: {
          operation: "commitChangelist",
          value: {
            changelistId,
            commitOid: objectId,
          },
        },
      },
      {
        operation: "listRecoveryEntries",
        invoke: () => client.listRecoveryEntries(REPOSITORY_ID),
        result: {
          operation: "listRecoveryEntries",
          value: [recovery],
        },
      },
      {
        operation: "restoreRecoveryEntry",
        invoke: () => client.restoreRecoveryEntry(REPOSITORY_ID, recoveryId),
        result: {
          operation: "restoreRecoveryEntry",
          value: {
            entryId: recoveryId,
            restoredRefs: ["refs/heads/main"],
          },
        },
      },
      {
        operation: "listConflicts",
        invoke: () => client.listConflicts(REPOSITORY_ID),
        result: { operation: "listConflicts", value: [conflict] },
      },
      {
        operation: "readConflict",
        invoke: () => client.readConflict(REPOSITORY_ID, "tracked.txt"),
        result: {
          operation: "readConflict",
          value: conflictContent,
        },
      },
      {
        operation: "writeConflictResult",
        invoke: () => client.writeConflictResult(REPOSITORY_ID, "tracked.txt", "resolved\n", true),
        result: { operation: "writeConflictResult" },
      },
      {
        operation: "resolveBinaryConflict",
        invoke: () => client.resolveBinaryConflict(REPOSITORY_ID, "tracked.txt", "ours"),
        result: { operation: "resolveBinaryConflict" },
      },
    ];

    for (const scenario of scenarios) {
      const pending = scenario.invoke();
      const request = lastMainMessage(transport);
      if (request.kind !== "repositoryService") {
        throw new Error("Expected repository service request");
      }
      expect(request.request.operation).toBe(scenario.operation);
      transport.emitMessage({
        kind: "repositoryServiceResult",
        correlationId: request.correlationId,
        result: scenario.result,
      });
      await expect(pending).resolves.not.toBeInstanceOf(Error);
    }
    expect(scenarios).toHaveLength(17);
  });

  it("correlates submodule, canonical-file, and multi-root service methods", async () => {
    const { client, transport } = await connectClient();
    const submoduleDiff = {
      path: "modules/client",
      beforeOid: SNAPSHOT.headOid,
      afterOid: SNAPSHOT.headOid,
      beforeSubject: "before",
      afterSubject: "after",
      ahead: 0,
      behind: 0,
    };

    const loading = client.loadSubmoduleDiff(
      REPOSITORY_ID,
      { kind: "revision", revision: "HEAD~1" },
      { kind: "workingTree" },
      "modules/client",
    );
    const loadRequest = lastMainMessage(transport);
    if (loadRequest.kind !== "repositoryService")
      throw new Error("Expected submodule repository service request");
    transport.emitMessage({
      kind: "repositoryServiceResult",
      correlationId: loadRequest.correlationId,
      result: { operation: "loadSubmoduleDiff", value: submoduleDiff },
    });
    await expect(loading).resolves.toEqual(submoduleDiff);

    const resolving = client.resolveWorkingTreeFile(REPOSITORY_ID, "tracked.txt");
    const resolveRequest = lastMainMessage(transport);
    if (resolveRequest.kind !== "repositoryService")
      throw new Error("Expected working-tree repository service request");
    transport.emitMessage({
      kind: "repositoryServiceResult",
      correlationId: resolveRequest.correlationId,
      result: {
        operation: "resolveWorkingTreeFile",
        value: "/tmp/repository/tracked.txt",
      },
    });
    await expect(resolving).resolves.toBe("/tmp/repository/tracked.txt");

    const synchronizing = client.executeSynchronizedBranchOperation(
      [REPOSITORY_ID, SECOND_REPOSITORY_ID],
      {
        kind: "createBranch",
        name: "feature",
        startPoint: "HEAD",
        checkout: true,
      },
    );
    const synchronizeRequest = lastMainMessage(transport);
    if (synchronizeRequest.kind !== "repositoryService")
      throw new Error("Expected multi-root repository service request");
    const rollbackStep = {
      repositoryId: REPOSITORY_ID,
      path: "/tmp/repository",
      description: "check out main, then delete feature",
      operations: [
        { kind: "checkout" as const, target: "main", force: false },
        {
          kind: "deleteBranch" as const,
          name: "feature",
          force: false,
        },
      ],
    };
    transport.emitMessage({
      kind: "repositoryServiceResult",
      correlationId: synchronizeRequest.correlationId,
      result: {
        operation: "executeSynchronizedBranchOperation",
        value: {
          outcomes: [
            {
              repositoryId: REPOSITORY_ID,
              path: "/tmp/repository",
              succeeded: true,
              message: "completed",
            },
          ],
          rollbackPlan: [rollbackStep],
        },
      },
    });
    const synchronized = await synchronizing;
    expect(synchronized.rollbackPlan).toEqual([rollbackStep]);

    const rollingBack = client.applyMultiRootRollback(synchronized.rollbackPlan);
    const rollbackRequest = lastMainMessage(transport);
    if (rollbackRequest.kind !== "repositoryService")
      throw new Error("Expected rollback repository service request");
    transport.emitMessage({
      kind: "repositoryServiceResult",
      correlationId: rollbackRequest.correlationId,
      result: {
        operation: "applyMultiRootRollback",
        value: [
          {
            repositoryId: REPOSITORY_ID,
            path: "/tmp/repository",
            succeeded: true,
            message: "rollback completed",
          },
        ],
      },
    });
    await expect(rollingBack).resolves.toMatchObject([{ message: "rollback completed" }]);

    expect(loadRequest.request).toMatchObject({
      operation: "loadSubmoduleDiff",
      path: "modules/client",
    });
    expect(resolveRequest.request).toEqual({
      operation: "resolveWorkingTreeFile",
      repositoryId: REPOSITORY_ID,
      path: "tracked.txt",
    });
    expect(synchronizeRequest.request).toMatchObject({
      operation: "executeSynchronizedBranchOperation",
      repositoryIds: [REPOSITORY_ID, SECOND_REPOSITORY_ID],
    });
    expect(rollbackRequest.request).toEqual({
      operation: "applyMultiRootRollback",
      steps: [rollbackStep],
    });
  });

  it("streams and correlates repository initialization", async () => {
    const { client, transport } = await connectClient();
    const received: GitCreationEvent[] = [];
    const creating = client.initializeRepository(
      { requestId: REQUEST_ID, path: "/tmp/repository", bare: false },
      (event) => received.push(event),
    );
    const request = lastMainMessage(transport);
    if (request.kind !== "initializeRepository") throw new Error("Expected initialize request");
    const events: readonly GitCreationEvent[] = [
      {
        kind: "started",
        requestId: REQUEST_ID,
        operation: "initialize",
        displayCommand: "git init --initial-branch=main -- /tmp/repository",
        startedAtMs: 1,
      },
      {
        kind: "output",
        requestId: REQUEST_ID,
        operation: "initialize",
        sequence: 0,
        stream: "stdout",
        data: "Initialized empty Git repository",
      },
      {
        kind: "completed",
        requestId: REQUEST_ID,
        operation: "initialize",
        repository: REPOSITORY,
        exitCode: 0,
        durationMs: 2,
      },
    ];
    for (const event of events) {
      transport.emitMessage({
        kind: "creationEvent",
        correlationId: request.correlationId,
        event,
      });
    }

    await expect(creating).resolves.toEqual(events.at(-1));
    expect(received).toEqual(events);
  });

  it("forwards only a started, sequential output, terminal query lifecycle", async () => {
    const { client, transport } = await connectClient();
    const received: GitRequestEvent[] = [];
    const executing = client.executeQuery(statusQuery(), (event) => {
      received.push(event);
    });
    const request = lastMainMessage(transport);
    if (request.kind !== "query") throw new Error("Expected query request");
    const events: readonly GitRequestEvent[] = [
      {
        kind: "started",
        requestId: REQUEST_ID,
        displayCommand: "git status",
        startedAtMs: 1,
      },
      {
        kind: "output",
        requestId: REQUEST_ID,
        sequence: 0,
        stream: "stdout",
        data: "first",
      },
      {
        kind: "output",
        requestId: REQUEST_ID,
        sequence: 1,
        stream: "stderr",
        data: "second",
      },
      {
        kind: "completed",
        requestId: REQUEST_ID,
        exitCode: 0,
        durationMs: 2,
      },
    ];
    for (const event of events) {
      transport.emitMessage({
        kind: "queryEvent",
        correlationId: request.correlationId,
        event,
      });
    }

    await expect(executing).resolves.toEqual(events.at(-1));
    expect(received).toEqual(events);
  });

  it("forwards an operation over the existing query protocol and lifecycle", async () => {
    const { client, transport } = await connectClient();
    const received: GitRequestEvent[] = [];
    const operationRequest = {
      kind: "operation" as const,
      requestId: REQUEST_ID,
      repositoryId: REPOSITORY_ID,
      operation: { kind: "stage" as const, paths: ["tracked.txt"] },
    };
    const executing = client.executeQuery(operationRequest, (event) => {
      received.push(event);
    });
    const request = lastMainMessage(transport);
    if (request.kind !== "query") throw new Error("Expected operation on query protocol");
    expect(request.request).toEqual(operationRequest);
    const events: readonly GitRequestEvent[] = [
      {
        kind: "started",
        requestId: REQUEST_ID,
        displayCommand: "git add -- tracked.txt",
        startedAtMs: 1,
      },
      {
        kind: "completed",
        requestId: REQUEST_ID,
        exitCode: 0,
        durationMs: 2,
      },
    ];
    for (const event of events) {
      transport.emitMessage({
        kind: "queryEvent",
        correlationId: request.correlationId,
        event,
      });
    }

    await expect(executing).resolves.toEqual(events.at(-1));
    expect(received).toEqual(events);
  });

  it("correlates bounded file reads and writes across the utility process", async () => {
    const { client, transport } = await connectClient();
    const reading = client.readFile(REPOSITORY_ID, FILE_SOURCE, "tracked.txt");
    const readRequest = lastMainMessage(transport);
    if (readRequest.kind !== "readFile") throw new Error("Expected file read request");
    expect(readRequest.request).toEqual({
      repositoryId: REPOSITORY_ID,
      source: FILE_SOURCE,
      path: "tracked.txt",
    });
    transport.emitMessage({
      kind: "readFileResult",
      correlationId: readRequest.correlationId,
      content: FILE_CONTENT,
    });
    await expect(reading).resolves.toEqual(FILE_CONTENT);

    const previewing = client.readFilePreview(REPOSITORY_ID, FILE_SOURCE, "image.png");
    const previewRequest = lastMainMessage(transport);
    if (previewRequest.kind !== "readFilePreview") throw new Error("Expected preview request");
    transport.emitMessage({
      kind: "readFilePreviewResult",
      correlationId: previewRequest.correlationId,
      preview: FILE_PREVIEW,
    });
    await expect(previewing).resolves.toEqual(FILE_PREVIEW);

    const writing = client.writeWorkingTreeFile(REPOSITORY_ID, "tracked.txt", "edited\n");
    const writeRequest = lastMainMessage(transport);
    if (writeRequest.kind !== "writeWorkingTreeFile")
      throw new Error("Expected working-tree file write request");
    expect(writeRequest.request).toEqual({
      repositoryId: REPOSITORY_ID,
      path: "tracked.txt",
      content: "edited\n",
      activityName: null,
    });
    transport.emitMessage({
      kind: "writeWorkingTreeFileResult",
      correlationId: writeRequest.correlationId,
    });
    await expect(writing).resolves.toBeUndefined();

    const lineLimited = client.readFile(REPOSITORY_ID, FILE_SOURCE, "many-lines.txt");
    const lineLimitRequest = lastMainMessage(transport);
    if (lineLimitRequest.kind !== "readFile") throw new Error("Expected line-limited read request");
    transport.emitMessage({
      kind: "readFileResult",
      correlationId: lineLimitRequest.correlationId,
      content: LINE_LIMIT_CONTENT,
    });
    await expect(lineLimited).resolves.toEqual(LINE_LIMIT_CONTENT);
  });

  it("registers a watcher before acknowledgement and drops stale events after unwatch", async () => {
    const { client, transport } = await connectClient();
    const received: RepositoryChangedEvent[] = [];
    const watching = client.watchRepository(REPOSITORY_ID, (event) => received.push(event));
    const watchRequest = lastMainMessage(transport);
    if (watchRequest.kind !== "watchRepository") throw new Error("Expected watch request");

    transport.emitMessage({
      kind: "repositoryChanged",
      event: REPOSITORY_CHANGED,
    });
    transport.emitMessage({
      kind: "watchRepositoryResult",
      correlationId: watchRequest.correlationId,
      repositoryId: REPOSITORY_ID,
    });
    await expect(watching).resolves.toBeUndefined();
    expect(received).toEqual([REPOSITORY_CHANGED]);

    const unwatching = client.unwatchRepository(REPOSITORY_ID);
    const unwatchRequest = lastMainMessage(transport);
    if (unwatchRequest.kind !== "unwatchRepository") throw new Error("Expected unwatch request");
    transport.emitMessage({
      kind: "unwatchRepositoryResult",
      correlationId: unwatchRequest.correlationId,
      repositoryId: REPOSITORY_ID,
    });
    await expect(unwatching).resolves.toBeUndefined();
    transport.emitMessage({
      kind: "repositoryChanged",
      event: REPOSITORY_CHANGED,
    });
    expect(received).toEqual([REPOSITORY_CHANGED]);
  });

  it("drops a watcher listener whenever repository close completes", async () => {
    const { client, transport } = await connectClient();
    const received: RepositoryChangedEvent[] = [];
    const watching = client.watchRepository(REPOSITORY_ID, (event) => received.push(event));
    const watchRequest = lastMainMessage(transport);
    if (watchRequest.kind !== "watchRepository") throw new Error("Expected watch request");
    transport.emitMessage({
      kind: "watchRepositoryResult",
      correlationId: watchRequest.correlationId,
      repositoryId: REPOSITORY_ID,
    });
    await watching;

    const closing = client.closeRepository(REPOSITORY_ID);
    const closeRequest = lastMainMessage(transport);
    if (closeRequest.kind !== "closeRepository") throw new Error("Expected close request");
    transport.emitMessage({
      kind: "closeRepositoryResult",
      correlationId: closeRequest.correlationId,
      closed: false,
    });
    await expect(closing).resolves.toBe(false);
    transport.emitMessage({
      kind: "repositoryChanged",
      event: REPOSITORY_CHANGED,
    });
    expect(received).toEqual([]);
  });

  it("kills the utility and rejects a query on an out-of-order event", async () => {
    const { client, transport } = await connectClient();
    const executing = client.executeQuery(statusQuery(), () => undefined);
    const request = lastMainMessage(transport);
    if (request.kind !== "query") throw new Error("Expected query request");

    transport.emitMessage({
      kind: "queryEvent",
      correlationId: request.correlationId,
      event: {
        kind: "output",
        requestId: REQUEST_ID,
        sequence: 1,
        stream: "stdout",
        data: "late",
      },
    });

    await expect(executing).rejects.toMatchObject({
      code: "protocolViolation",
    });
    expect(transport.killCount).toBe(1);
    expect(client.state).toBe("crashed");
  });

  it("rejects every pending operation when the utility crashes", async () => {
    const crashes: Error[] = [];
    const { client, transport } = await connectClient(new FakeUtilityProcessTransport(), {
      onCrash: (error) => crashes.push(error),
    });
    const mutation = client.executeRepositoryService({
      operation: "writeIgnoreRules",
      repositoryId: REPOSITORY_ID,
      rules: { gitignore: "dist/\n", infoExclude: "" },
    });
    const postedBeforeCrash = transport.posted.length;

    transport.emitExit(9);

    await expect(mutation).rejects.toMatchObject({ code: "utilityExited" });
    expect(client.state).toBe("crashed");
    expect(transport.posted).toHaveLength(postedBeforeCrash);
    expect(crashes).toHaveLength(1);
    expect(crashes[0]).toMatchObject({ code: "utilityExited" });
    transport.emitExit(10);
    expect(crashes).toHaveLength(1);
  });

  it("validates incoming messages before routing them", async () => {
    const { client, transport } = await connectClient();
    const opening = client.openRepository("/tmp/repository");

    transport.emitMessage({
      kind: "openRepositoryResult",
      correlationId: "not-a-uuid",
    });

    await expect(opening).rejects.toMatchObject({
      code: "protocolViolation",
    });
    expect(transport.killCount).toBe(1);
  });

  it("acknowledges dispose, rejects outstanding work, and tears down the process", async () => {
    const { client, transport } = await connectClient();
    const executing = client.executeQuery(statusQuery(), () => undefined);
    const disposing = client.dispose();
    const disposeRequest = lastMainMessage(transport);
    if (disposeRequest.kind !== "dispose") throw new Error("Expected dispose request");

    transport.emitMessage({
      kind: "disposeResult",
      correlationId: disposeRequest.correlationId,
    });

    await expect(disposing).resolves.toBeUndefined();
    await expect(executing).rejects.toMatchObject({ code: "disposed" });
    expect(client.state).toBe("disposed");
    expect(transport.killCount).toBe(1);
  });
});
