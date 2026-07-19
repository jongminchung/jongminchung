import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { RepositorySnapshot } from "../../src/generated";
import {
    type GitCreationEvent,
    type GitCreationEventListener,
    type GitCreationTerminalEvent,
    type GitEventListener,
    type GitQueryRequest,
    type GitRequestEvent,
    type GitRequestId,
    type GitRepositoryServiceRequest,
    type GitRepositoryServiceResult,
    type GitTerminalEvent,
    type FileContent,
    type FilePreview,
    type FileSource,
    type RepositoryChangedEvent,
    type RepositoryChangedListener,
    type RepositoryId,
    type RepositoryRecord,
} from "../../src/shared/contracts/git-utility";
import {
    GIT_UTILITY_PROTOCOL_VERSION,
    GitUtilityToMainMessageSchema,
    MainToGitUtilityMessageSchema,
    type MainToGitUtilityMessage,
} from "../../src/shared/contracts/git-utility-process";
import {
    GitUtilityProtocolServer,
    type GitUtilityServerPort,
    type GitUtilityServiceLike,
} from "../utility/git/utility-server";
import {
    GitUtilityClient,
    type GitUtilityProcessTransport,
} from "./git-utility-client";

const INSTANCE_ID = "fd312e4e-5856-4afe-bfca-b34f35880429";
const REPOSITORY_ID = "02fc7f7c-3f66-514b-9470-451a776cfcc7" as RepositoryId;
const SECOND_REPOSITORY_ID =
    "50dce2ce-cd90-4f4a-8af7-dbb005bf7262" as RepositoryId;
const REQUEST_ID = "388ac97b-6f01-4e10-8149-78ec15412d18" as GitRequestId;
const REPOSITORY: RepositoryRecord = Object.freeze({
    id: REPOSITORY_ID,
    name: "repository",
    path: "/tmp/repository",
    gitDirectory: "/tmp/repository/.git",
    commonDirectory: "/tmp/repository/.git",
    isBare: false,
    gitVersion: Object.freeze({
        major: 2,
        minor: 55,
        patch: 0,
        display: "git version 2.55.0",
    }),
});
const SNAPSHOT: RepositorySnapshot = Object.freeze({
    ...REPOSITORY,
    currentBranch: "main",
    headOid: "0123456789abcdef0123456789abcdef01234567",
    upstream: "origin/main",
    remoteUrl: "https://example.invalid/repository.git",
    ahead: 2,
    behind: 1,
    isShallow: false,
    isDetached: false,
    hasCommits: true,
    operation: null,
});
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

function lastMainMessage(
    transport: FakeUtilityProcessTransport,
): MainToGitUtilityMessage {
    return MainToGitUtilityMessageSchema.parse(transport.posted.at(-1));
}

async function connectClient(
    transport = new FakeUtilityProcessTransport(),
): Promise<{
    readonly client: GitUtilityClient;
    readonly transport: FakeUtilityProcessTransport;
}> {
    const connecting = GitUtilityClient.connect(transport, {
        handshakeTimeoutMs: 1_000,
    });
    transport.emitMessage({
        kind: "ready",
        protocolVersion: GIT_UTILITY_PROTOCOL_VERSION,
        instanceId: INSTANCE_ID,
    });
    const handshake = lastMainMessage(transport);
    if (handshake.kind !== "handshake")
        throw new Error("Expected handshake request");
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
        if (request.kind !== "openRepository")
            throw new Error("Expected open request");

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
        if (request.kind !== "inspectSnapshot")
            throw new Error("Expected snapshot inspection request");
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
        const comparing = client.compareBranches(
            REPOSITORY_ID,
            "feature",
            "main",
        );
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
        const loadingPush = client.loadPushPreview(
            REPOSITORY_ID,
            "origin",
            "refs/heads/main",
            "HEAD",
        );
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

        const loadingRewrite = client.loadHistoryRewritePreview(
            REPOSITORY_ID,
            "HEAD~1",
        );
        const rewriteRequest = lastMainMessage(transport);
        if (rewriteRequest.kind !== "repositoryService") {
            throw new Error(
                "Expected history rewrite repository service request",
            );
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
                invoke: () =>
                    client.exportPatch(
                        REPOSITORY_ID,
                        ["HEAD"],
                        "/tmp/export.patch",
                    ),
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
                invoke: () =>
                    client.importPatch(REPOSITORY_ID, "/tmp/import.patch"),
                result: { operation: "importPatch" },
            },
            {
                operation: "createShelf",
                invoke: () =>
                    client.createShelf(REPOSITORY_ID, "saved", ["tracked.txt"]),
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
                invoke: () =>
                    client.saveChangelist(REPOSITORY_ID, null, "selected", [
                        "tracked.txt",
                    ]),
                result: { operation: "saveChangelist", value: changelist },
            },
            {
                operation: "deleteChangelist",
                invoke: () =>
                    client.deleteChangelist(REPOSITORY_ID, changelistId),
                result: { operation: "deleteChangelist" },
            },
            {
                operation: "commitChangelist",
                invoke: () =>
                    client.commitChangelist(
                        REPOSITORY_ID,
                        changelistId,
                        "commit",
                        false,
                        false,
                        false,
                    ),
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
                invoke: () =>
                    client.restoreRecoveryEntry(REPOSITORY_ID, recoveryId),
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
                invoke: () =>
                    client.writeConflictResult(
                        REPOSITORY_ID,
                        "tracked.txt",
                        "resolved\n",
                        true,
                    ),
                result: { operation: "writeConflictResult" },
            },
            {
                operation: "resolveBinaryConflict",
                invoke: () =>
                    client.resolveBinaryConflict(
                        REPOSITORY_ID,
                        "tracked.txt",
                        "ours",
                    ),
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

        const resolving = client.resolveWorkingTreeFile(
            REPOSITORY_ID,
            "tracked.txt",
        );
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

        const rollingBack = client.applyMultiRootRollback(
            synchronized.rollbackPlan,
        );
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
        await expect(rollingBack).resolves.toMatchObject([
            { message: "rollback completed" },
        ]);

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
        if (request.kind !== "initializeRepository")
            throw new Error("Expected initialize request");
        const events: readonly GitCreationEvent[] = [
            {
                kind: "started",
                requestId: REQUEST_ID,
                operation: "initialize",
                displayCommand:
                    "git init --initial-branch=main -- /tmp/repository",
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
        if (request.kind !== "query")
            throw new Error("Expected operation on query protocol");
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
        const reading = client.readFile(
            REPOSITORY_ID,
            FILE_SOURCE,
            "tracked.txt",
        );
        const readRequest = lastMainMessage(transport);
        if (readRequest.kind !== "readFile")
            throw new Error("Expected file read request");
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

        const previewing = client.readFilePreview(
            REPOSITORY_ID,
            FILE_SOURCE,
            "image.png",
        );
        const previewRequest = lastMainMessage(transport);
        if (previewRequest.kind !== "readFilePreview")
            throw new Error("Expected preview request");
        transport.emitMessage({
            kind: "readFilePreviewResult",
            correlationId: previewRequest.correlationId,
            preview: FILE_PREVIEW,
        });
        await expect(previewing).resolves.toEqual(FILE_PREVIEW);

        const writing = client.writeWorkingTreeFile(
            REPOSITORY_ID,
            "tracked.txt",
            "edited\n",
        );
        const writeRequest = lastMainMessage(transport);
        if (writeRequest.kind !== "writeWorkingTreeFile")
            throw new Error("Expected working-tree file write request");
        expect(writeRequest.request).toEqual({
            repositoryId: REPOSITORY_ID,
            path: "tracked.txt",
            content: "edited\n",
        });
        transport.emitMessage({
            kind: "writeWorkingTreeFileResult",
            correlationId: writeRequest.correlationId,
        });
        await expect(writing).resolves.toBeUndefined();

        const lineLimited = client.readFile(
            REPOSITORY_ID,
            FILE_SOURCE,
            "many-lines.txt",
        );
        const lineLimitRequest = lastMainMessage(transport);
        if (lineLimitRequest.kind !== "readFile")
            throw new Error("Expected line-limited read request");
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
        const watching = client.watchRepository(REPOSITORY_ID, (event) =>
            received.push(event),
        );
        const watchRequest = lastMainMessage(transport);
        if (watchRequest.kind !== "watchRepository")
            throw new Error("Expected watch request");

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
        if (unwatchRequest.kind !== "unwatchRepository")
            throw new Error("Expected unwatch request");
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
        const watching = client.watchRepository(REPOSITORY_ID, (event) =>
            received.push(event),
        );
        const watchRequest = lastMainMessage(transport);
        if (watchRequest.kind !== "watchRepository")
            throw new Error("Expected watch request");
        transport.emitMessage({
            kind: "watchRepositoryResult",
            correlationId: watchRequest.correlationId,
            repositoryId: REPOSITORY_ID,
        });
        await watching;

        const closing = client.closeRepository(REPOSITORY_ID);
        const closeRequest = lastMainMessage(transport);
        if (closeRequest.kind !== "closeRepository")
            throw new Error("Expected close request");
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
        const { client, transport } = await connectClient();
        const opening = client.openRepository("/tmp/repository");

        transport.emitExit(9);

        await expect(opening).rejects.toMatchObject({ code: "utilityExited" });
        expect(client.state).toBe("crashed");
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
        if (disposeRequest.kind !== "dispose")
            throw new Error("Expected dispose request");

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

describe("GitUtilityProtocolServer", () => {
    it("requires a matching handshake and validates/routes utility messages", async () => {
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
        expect(GitUtilityToMainMessageSchema.parse(port.posted.at(-1))).toEqual(
            {
                kind: "inspectSnapshotResult",
                correlationId: inspectId,
                snapshot: SNAPSHOT,
            },
        );

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
                    message.kind === "queryEvent" &&
                    message.correlationId === queryId,
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
        expect(GitUtilityToMainMessageSchema.parse(port.posted.at(-1))).toEqual(
            {
                kind: "readFileResult",
                correlationId: readId,
                content: FILE_CONTENT,
            },
        );

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
        expect(GitUtilityToMainMessageSchema.parse(port.posted.at(-1))).toEqual(
            {
                kind: "readFilePreviewResult",
                correlationId: previewId,
                preview: FILE_PREVIEW,
            },
        );

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
        expect(GitUtilityToMainMessageSchema.parse(port.posted.at(-1))).toEqual(
            {
                kind: "repositoryChanged",
                event: REPOSITORY_CHANGED,
            },
        );

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

    it("returns a protocol error for a mismatched handshake", async () => {
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
