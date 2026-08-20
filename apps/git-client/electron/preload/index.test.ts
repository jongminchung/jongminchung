import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopApi } from "../../src/shared/contracts/desktop-api";
import type {
    FileContent,
    FilePreview,
    GitCreationEvent,
    GitRequestEvent,
    RepositoryChangedEvent,
    RepositoryRecord,
} from "../../src/shared/contracts/git-utility";
import type {
    RepositorySnapshot,
    TerminalEvent,
} from "../../src/shared/contracts/model";
import { TEST_TRPC_PATHS } from "../test/desktop-trpc-fixture";

interface TestMessagePort {
    onmessage: ((event: { data: unknown }) => void) | null;
    peer: TestMessagePort | null;
    postMessage(data: unknown): void;
    start(): void;
    close(): void;
}

class SynchronousMessagePort implements TestMessagePort {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    peer: TestMessagePort | null = null;

    postMessage(data: unknown): void {
        this.peer?.onmessage?.({ data });
    }

    start(): void {}

    close(): void {}
}

class SynchronousMessageChannel {
    readonly port1 = new SynchronousMessagePort();
    readonly port2 = new SynchronousMessagePort();

    constructor() {
        this.port1.peer = this.port2;
        this.port2.peer = this.port1;
    }
}

vi.stubGlobal("MessageChannel", SynchronousMessageChannel);

const electronMock = vi.hoisted(() => ({
    exposedApi: null as unknown,
    invoke: vi.fn(),
    streamPort: null as TestMessagePort | null,
    postMessage: vi.fn(
        (_channel: string, _request: unknown, ports: TestMessagePort[]) => {
            const [port] = ports;
            if (port === undefined)
                throw new Error("Missing desktop stream port");
            electronMock.streamPort = port;
            port.postMessage({ kind: "ready", version: 1 });
        },
    ),
    transportInvoke: vi.fn(async (_channel: string, request: unknown) => {
        const envelope = request as { path: string; input?: unknown };
        try {
            const result =
                envelope.input === undefined
                    ? await electronMock.invoke(envelope.path)
                    : await electronMock.invoke(envelope.path, envelope.input);
            if (
                envelope.path === TEST_TRPC_PATHS.gitQuery ||
                envelope.path === TEST_TRPC_PATHS.gitInitializeRepository ||
                envelope.path === TEST_TRPC_PATHS.gitCloneRepository
            ) {
                const input = envelope.input as { requestId: string };
                setTimeout(() => {
                    electronMock.streamPort?.postMessage({
                        kind: "git.barrier",
                        operation:
                            envelope.path === TEST_TRPC_PATHS.gitQuery
                                ? "query"
                                : "creation",
                        requestId: input.requestId,
                    });
                }, 0);
            }
            return { ok: true, data: result };
        } catch (error) {
            return {
                ok: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Desktop RPC failed",
                },
            };
        }
    }),
}));

vi.mock("electron", () => ({
    contextBridge: {
        exposeInMainWorld: (_name: string, api: unknown): void => {
            electronMock.exposedApi = api;
        },
    },
    ipcRenderer: {
        invoke: electronMock.transportInvoke,
        postMessage: electronMock.postMessage,
    },
}));

await import("./index");

const REPOSITORY_ID = "02fc7f7c-3f66-514b-9470-451a776cfcc7";
const SECOND_REPOSITORY_ID = "50dce2ce-cd90-4f4a-8af7-dbb005bf7262";
const REQUEST_ID = "388ac97b-6f01-4e10-8149-78ec15412d18";
const TERMINAL_ID = "f6478d5c-5aa0-4d4a-b646-cb950b0ca555";
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
const FILE_CONTENT: FileContent = Object.freeze({
    kind: "text",
    path: "tracked.txt",
    content: "content\n",
    sizeBytes: 8,
    lineCount: 1,
});
const FILE_PREVIEW: FilePreview = Object.freeze({
    kind: "binary",
    path: "tracked.bin",
    sizeBytes: 4,
});
const REPOSITORY_CHANGED: RepositoryChangedEvent = {
    repositoryId: REPOSITORY_ID,
    invalidations: ["status", "stash"],
};

type IpcEventHandler = (event: unknown, message: unknown) => void;

function api(): DesktopApi {
    return electronMock.exposedApi as DesktopApi;
}

function gitEventHandler(): IpcEventHandler {
    return (_event, raw) => {
        const gitEvent = raw as GitRequestEvent;
        if (
            gitEvent.kind === "completed" ||
            gitEvent.kind === "failed" ||
            gitEvent.kind === "cancelled"
        ) {
            return;
        }
        electronMock.streamPort?.postMessage({
            kind: "git.query.event",
            event: raw,
        });
    };
}

function gitCreationEventHandler(): IpcEventHandler {
    return (_event, raw) => {
        const creationEvent = raw as GitCreationEvent;
        if (
            creationEvent.kind === "completed" ||
            creationEvent.kind === "failed" ||
            creationEvent.kind === "cancelled"
        ) {
            return;
        }
        electronMock.streamPort?.postMessage({
            kind: "git.creation.event",
            event: raw,
        });
    };
}

function repositoryChangedEventHandler(): IpcEventHandler {
    return (_event, raw) => {
        electronMock.streamPort?.postMessage({
            kind: "repository.changed",
            event: raw,
        });
    };
}

function terminalEventHandler(): IpcEventHandler {
    return (_event, raw) => {
        electronMock.streamPort?.postMessage({
            kind: "terminal.event",
            event: raw,
        });
    };
}

describe("전자 사전 로드 Git API", () => {
    beforeEach(() => {
        electronMock.invoke.mockReset();
    });

    it("[성공] Electron 프로세스 인수에서 고정 명칭을 따르기", () => {
        expect(api().runtime.qaFixture).toBe(false);
    });

    it("[성공] IPC를 통과하기 전에 HTTP(S) 외부 URL의 승리를 확인함", async () => {
        electronMock.invoke.mockResolvedValue(undefined);

        await expect(
            api().shell.openExternal(
                "http://gitlab.example.test/group/project",
            ),
        ).resolves.toBeUndefined();
        expect(electronMock.invoke).toHaveBeenCalledWith(
            TEST_TRPC_PATHS.shellOpenExternal,
            "http://gitlab.example.test/group/project",
        );

        electronMock.invoke.mockClear();
        await expect(
            api().shell.openExternal("file:///tmp/private"),
        ).rejects.toThrow("credential-free HTTP or HTTPS");
        expect(electronMock.invoke).not.toHaveBeenCalled();
    });

    it("[성공] 리포지토리 수명주기 결과를 인증함", async () => {
        electronMock.invoke.mockImplementation(
            async (channel: string): Promise<unknown> => {
                if (channel === TEST_TRPC_PATHS.gitOpenRepository)
                    return REPOSITORY;
                if (channel === TEST_TRPC_PATHS.gitCloseRepository) return true;
                if (channel === TEST_TRPC_PATHS.gitCancelQuery) return false;
                throw new Error(`Unexpected channel ${channel}`);
            },
        );

        await expect(
            api().git.openRepository("/tmp/repository"),
        ).resolves.toEqual(REPOSITORY);
        await expect(api().git.closeRepository(REPOSITORY_ID)).resolves.toBe(
            true,
        );
        await expect(api().git.cancelQuery(REQUEST_ID)).resolves.toBe(false);
    });

    it("[성공] 총체적으로 스냅샷을 조사함", async () => {
        electronMock.invoke.mockResolvedValue(SNAPSHOT);

        await expect(api().git.inspectSnapshot(REPOSITORY_ID)).resolves.toEqual(
            SNAPSHOT,
        );
        expect(electronMock.invoke).toHaveBeenCalledWith(
            TEST_TRPC_PATHS.gitInspectSnapshot,
            {
                repositoryId: REPOSITORY_ID,
            },
        );
    });

    it("[성공] 모든 조사관 및 무시 무시함을 확인함", async () => {
        electronMock.invoke.mockImplementation(
            async (
                channel: string,
                request: Readonly<Record<string, unknown>>,
            ): Promise<unknown> => {
                if (channel !== TEST_TRPC_PATHS.gitRepositoryService) {
                    throw new Error(`Unexpected channel ${channel}`);
                }
                switch (request.operation) {
                    case "compareBranches":
                        return {
                            operation: request.operation,
                            value: {
                                ahead: 1,
                                behind: 0,
                                leftOnly: [SNAPSHOT.headOid],
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
                        return {
                            operation: request.operation,
                            value: ["main"],
                        };
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
                            value: {
                                gitignore: "dist/\n",
                                infoExclude: ".cache/\n",
                            },
                        };
                    case "writeIgnoreRules":
                        return { operation: request.operation };
                    default:
                        throw new Error(
                            `Unexpected operation ${String(request.operation)}`,
                        );
                }
            },
        );

        await expect(
            api().git.compareBranches(REPOSITORY_ID, "feature", "main"),
        ).resolves.toMatchObject({
            ahead: 1,
            leftOnly: [SNAPSHOT.headOid],
        });
        await expect(
            api().git.preCommitCheck(REPOSITORY_ID),
        ).resolves.toMatchObject({
            branch: "main",
            protectedBranch: true,
        });
        await expect(api().git.listGitConfig(REPOSITORY_ID)).resolves.toEqual(
            [],
        );
        await expect(api().git.listSubmodules(REPOSITORY_ID)).resolves.toEqual(
            [],
        );
        await expect(
            api().git.listMergedBranches(REPOSITORY_ID, "HEAD"),
        ).resolves.toEqual(["main"]);
        await expect(
            api().git.loadCommitSignature(REPOSITORY_ID, "HEAD"),
        ).resolves.toMatchObject({
            status: "N",
        });
        await expect(api().git.listRemotes(REPOSITORY_ID)).resolves.toEqual([]);
        await expect(api().git.listWorktrees(REPOSITORY_ID)).resolves.toEqual(
            [],
        );
        await expect(api().git.readIgnoreRules(REPOSITORY_ID)).resolves.toEqual(
            {
                gitignore: "dist/\n",
                infoExclude: ".cache/\n",
            },
        );
        await expect(
            api().git.writeIgnoreRules(REPOSITORY_ID, {
                gitignore: "coverage/\n",
                infoExclude: ".work/\n",
            }),
        ).resolves.toBeUndefined();
        expect(electronMock.invoke).toHaveBeenLastCalledWith(
            TEST_TRPC_PATHS.gitRepositoryService,
            {
                operation: "writeIgnoreRules",
                repositoryId: REPOSITORY_ID,
                rules: { gitignore: "coverage/\n", infoExclude: ".work/\n" },
            },
        );
    });

    it("[성공] 직접 업로드 및 기록 다시 쓰기 보기 결과를 확인함", async () => {
        electronMock.invoke.mockImplementation(
            async (
                channel: string,
                request: Readonly<Record<string, unknown>>,
            ): Promise<unknown> => {
                expect(channel).toBe(TEST_TRPC_PATHS.gitRepositoryService);
                if (request.operation === "pushPreview") {
                    return {
                        operation: request.operation,
                        value: PUSH_PREVIEW,
                    };
                }
                if (request.operation === "historyRewritePreview") {
                    return {
                        operation: request.operation,
                        value: HISTORY_REWRITE_PREVIEW,
                    };
                }
                throw new Error(
                    `Unexpected operation ${String(request.operation)}`,
                );
            },
        );

        await expect(
            api().git.loadPushPreview(
                REPOSITORY_ID,
                "origin",
                "refs/heads/main",
                "HEAD",
            ),
        ).resolves.toEqual(PUSH_PREVIEW);
        await expect(
            api().git.loadHistoryRewritePreview(REPOSITORY_ID, "HEAD~1"),
        ).resolves.toEqual(HISTORY_REWRITE_PREVIEW);
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            1,
            TEST_TRPC_PATHS.gitRepositoryService,
            {
                operation: "pushPreview",
                repositoryId: REPOSITORY_ID,
                remote: "origin",
                remoteRef: "refs/heads/main",
                localRevision: "HEAD",
            },
        );
    });

    it("[성공] 모든 패치, 쉘프, 변경 목록, 복구 및 호출을 인증함", async () => {
        const shelfId = "896b19c6-dd8f-4f7b-a591-cf701e86457c";
        const changelistId = "723094e7-bf3b-4d3e-8f74-6cebe9571840";
        const recoveryId = "53f66fe0-6b52-4a69-9b9f-b07c724f9095";
        const checksum = "a".repeat(64);
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
        electronMock.invoke.mockImplementation(
            async (
                channel: string,
                request: Readonly<Record<string, unknown>>,
            ): Promise<unknown> => {
                expect(channel).toBe(TEST_TRPC_PATHS.gitRepositoryService);
                switch (request.operation) {
                    case "exportPatch":
                        return {
                            operation: request.operation,
                            value: {
                                path: "/tmp/export.patch",
                                sizeBytes: 128,
                                commitCount: 1,
                            },
                        };
                    case "createPatchText":
                        return {
                            operation: request.operation,
                            value: "patch text",
                        };
                    case "createShelf":
                        return { operation: request.operation, value: shelf };
                    case "listShelves":
                        return {
                            operation: request.operation,
                            value: [shelf],
                        };
                    case "listChangelists":
                        return {
                            operation: request.operation,
                            value: [changelist],
                        };
                    case "saveChangelist":
                        return {
                            operation: request.operation,
                            value: changelist,
                        };
                    case "commitChangelist":
                        return {
                            operation: request.operation,
                            value: {
                                changelistId,
                                commitOid: SNAPSHOT.headOid,
                            },
                        };
                    case "listRecoveryEntries":
                        return {
                            operation: request.operation,
                            value: [recovery],
                        };
                    case "restoreRecoveryEntry":
                        return {
                            operation: request.operation,
                            value: {
                                entryId: recoveryId,
                                restoredRefs: ["refs/heads/main"],
                            },
                        };
                    case "listConflicts":
                        return {
                            operation: request.operation,
                            value: [conflict],
                        };
                    case "readConflict":
                        return {
                            operation: request.operation,
                            value: conflictContent,
                        };
                    default:
                        return { operation: request.operation };
                }
            },
        );

        await expect(
            api().git.exportPatch(REPOSITORY_ID, ["HEAD"], "/tmp/export.patch"),
        ).resolves.toMatchObject({ commitCount: 1 });
        await expect(
            api().git.createPatchText(REPOSITORY_ID, ["HEAD"]),
        ).resolves.toBe("patch text");
        await expect(
            api().git.importPatch(REPOSITORY_ID, "/tmp/import.patch"),
        ).resolves.toBeUndefined();
        await expect(
            api().git.createShelf(REPOSITORY_ID, "saved", ["tracked.txt"]),
        ).resolves.toEqual(shelf);
        await expect(api().git.listShelves(REPOSITORY_ID)).resolves.toEqual([
            shelf,
        ]);
        await expect(
            api().git.applyShelf(REPOSITORY_ID, shelfId, true),
        ).resolves.toBeUndefined();
        await expect(
            api().git.deleteShelf(REPOSITORY_ID, shelfId),
        ).resolves.toBeUndefined();
        await expect(api().git.listChangelists(REPOSITORY_ID)).resolves.toEqual(
            [changelist],
        );
        await expect(
            api().git.saveChangelist(REPOSITORY_ID, null, "selected", [
                "tracked.txt",
            ]),
        ).resolves.toEqual(changelist);
        await expect(
            api().git.deleteChangelist(REPOSITORY_ID, changelistId),
        ).resolves.toBeUndefined();
        await expect(
            api().git.commitChangelist(
                REPOSITORY_ID,
                changelistId,
                "commit",
                false,
                false,
                false,
            ),
        ).resolves.toMatchObject({ changelistId });
        await expect(
            api().git.listRecoveryEntries(REPOSITORY_ID),
        ).resolves.toEqual([recovery]);
        await expect(
            api().git.restoreRecoveryEntry(REPOSITORY_ID, recoveryId),
        ).resolves.toMatchObject({
            restoredRefs: ["refs/heads/main"],
        });
        await expect(api().git.listConflicts(REPOSITORY_ID)).resolves.toEqual([
            conflict,
        ]);
        await expect(
            api().git.readConflict(REPOSITORY_ID, "tracked.txt"),
        ).resolves.toEqual(conflictContent);
        await expect(
            api().git.writeConflictResult(
                REPOSITORY_ID,
                "tracked.txt",
                "resolved\n",
                true,
            ),
        ).resolves.toBeUndefined();
        await expect(
            api().git.resolveBinaryConflict(
                REPOSITORY_ID,
                "tracked.txt",
                "ours",
            ),
        ).resolves.toBeUndefined();

        expect(
            electronMock.invoke.mock.calls.map((call) => call[1]?.operation),
        ).toEqual([
            "exportPatch",
            "createPatchText",
            "importPatch",
            "createShelf",
            "listShelves",
            "applyShelf",
            "deleteShelf",
            "listChangelists",
            "saveChangelist",
            "deleteChangelist",
            "commitChangelist",
            "listRecoveryEntries",
            "restoreRecoveryEntry",
            "listConflicts",
            "readConflict",
            "writeConflictResult",
            "resolveBinaryConflict",
        ]);
    });

    it("[실패] 메인을 호출하기 전에는 아무런 서비스도 받지 못했습니다", async () => {
        await expect(
            api().git.readConflict(REPOSITORY_ID, "../secret.txt"),
        ).rejects.toThrow();
        await expect(
            api().git.createShelf(REPOSITORY_ID, "bad\0message", [
                "tracked.txt",
            ]),
        ).rejects.toThrow();
        await expect(
            api().git.exportPatch(REPOSITORY_ID, ["--all"], "/tmp/out.patch"),
        ).rejects.toThrow();
        expect(electronMock.invoke).not.toHaveBeenCalled();
    });

    it("[성공] 샌드박스 사전 로드에서 하위 모듈, 파일 전송 및 소수에게 요청을 검증함", async () => {
        const submoduleDiff = {
            path: "modules/client",
            beforeOid: SNAPSHOT.headOid,
            afterOid: SNAPSHOT.headOid,
            beforeSubject: "before",
            afterSubject: "after",
            ahead: 0,
            behind: 0,
        };
        const rollbackStep = {
            repositoryId: REPOSITORY_ID,
            path: "/tmp/repository",
            description: "check out main",
            operations: [
                { kind: "checkout" as const, target: "main", force: false },
            ],
        };
        electronMock.invoke.mockImplementation(
            async (
                channel: string,
                request: Readonly<Record<string, unknown>>,
            ): Promise<unknown> => {
                if (channel === TEST_TRPC_PATHS.gitOpenWorkingTreeFile)
                    return undefined;
                if (channel !== TEST_TRPC_PATHS.gitRepositoryService)
                    throw new Error(`Unexpected channel ${channel}`);
                if (request.operation === "loadSubmoduleDiff") {
                    return {
                        operation: request.operation,
                        value: submoduleDiff,
                    };
                }
                if (
                    request.operation === "executeSynchronizedBranchOperation"
                ) {
                    return {
                        operation: request.operation,
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
                    };
                }
                if (request.operation === "applyMultiRootRollback") {
                    return {
                        operation: request.operation,
                        value: [
                            {
                                repositoryId: REPOSITORY_ID,
                                path: "/tmp/repository",
                                succeeded: true,
                                message: "rollback completed",
                            },
                        ],
                    };
                }
                throw new Error(
                    `Unexpected operation ${String(request.operation)}`,
                );
            },
        );

        await expect(
            api().git.loadSubmoduleDiff(
                REPOSITORY_ID,
                { kind: "revision", revision: "HEAD~1" },
                { kind: "workingTree" },
                "modules/client",
            ),
        ).resolves.toEqual(submoduleDiff);
        await expect(
            api().git.openWorkingTreeFile(REPOSITORY_ID, "tracked.txt"),
        ).resolves.toBeUndefined();
        const synchronized = await api().git.executeSynchronizedBranchOperation(
            [REPOSITORY_ID, SECOND_REPOSITORY_ID],
            { kind: "checkout", target: "main", force: false },
        );
        expect(synchronized.rollbackPlan).toEqual([rollbackStep]);
        await expect(
            api().git.applyMultiRootRollback(synchronized.rollbackPlan),
        ).resolves.toMatchObject([{ message: "rollback completed" }]);

        expect(electronMock.invoke.mock.calls).toEqual([
            [
                TEST_TRPC_PATHS.gitRepositoryService,
                {
                    operation: "loadSubmoduleDiff",
                    repositoryId: REPOSITORY_ID,
                    before: { kind: "revision", revision: "HEAD~1" },
                    after: { kind: "workingTree" },
                    path: "modules/client",
                },
            ],
            [
                TEST_TRPC_PATHS.gitOpenWorkingTreeFile,
                { repositoryId: REPOSITORY_ID, path: "tracked.txt" },
            ],
            [
                TEST_TRPC_PATHS.gitRepositoryService,
                {
                    operation: "executeSynchronizedBranchOperation",
                    repositoryIds: [REPOSITORY_ID, SECOND_REPOSITORY_ID],
                    gitOperation: {
                        kind: "checkout",
                        target: "main",
                        force: false,
                    },
                },
            ],
            [
                TEST_TRPC_PATHS.gitRepositoryService,
                {
                    operation: "applyMultiRootRollback",
                    steps: [rollbackStep],
                },
            ],
        ]);

        electronMock.invoke.mockClear();
        await expect(
            api().git.openWorkingTreeFile(REPOSITORY_ID, "../outside.txt"),
        ).rejects.toThrow();
        await expect(
            api().git.executeSynchronizedBranchOperation([REPOSITORY_ID], {
                kind: "checkout",
                target: "main",
                force: true,
            }),
        ).rejects.toThrow();
        expect(electronMock.invoke).not.toHaveBeenCalled();
    });

    it("[성공] 리포지토리 및 복제 작업을 인증하고 스트리밍함", async () => {
        const received: GitCreationEvent[] = [];
        electronMock.invoke.mockImplementation(
            async (
                channel: string,
                request: Readonly<Record<string, unknown>>,
            ): Promise<unknown> => {
                if (
                    channel !== TEST_TRPC_PATHS.gitInitializeRepository &&
                    channel !== TEST_TRPC_PATHS.gitCloneRepository
                ) {
                    throw new Error(`Unexpected channel ${channel}`);
                }
                const operation =
                    channel === TEST_TRPC_PATHS.gitInitializeRepository
                        ? "initialize"
                        : "clone";
                const emit = gitCreationEventHandler();
                emit(
                    {},
                    {
                        kind: "started",
                        requestId: request.requestId,
                        operation,
                        displayCommand:
                            operation === "initialize"
                                ? "git init"
                                : "git clone",
                        startedAtMs: 1,
                    },
                );
                const terminal = {
                    kind: "completed" as const,
                    requestId: request.requestId,
                    operation,
                    repository: REPOSITORY,
                    exitCode: 0,
                    durationMs: 2,
                };
                emit({}, terminal);
                return terminal;
            },
        );

        await expect(
            api().git.initializeRepository("/tmp/repository", false, (event) =>
                received.push(event),
            ),
        ).resolves.toEqual(REPOSITORY);
        await expect(
            api().git.cloneRepository(
                "https://example.invalid/repository.git",
                "/tmp/repository",
                { depth: 1, branch: "main", recurseSubmodules: true },
                (event) => received.push(event),
            ),
        ).resolves.toEqual(REPOSITORY);

        expect(
            received.map((event) => `${event.operation}:${event.kind}`),
        ).toEqual([
            "initialize:started",
            "initialize:completed",
            "clone:started",
            "clone:completed",
        ]);
        expect(electronMock.invoke.mock.calls[0]?.[1]).toEqual({
            requestId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
            path: "/tmp/repository",
            bare: false,
        });
        expect(electronMock.invoke.mock.calls[1]?.[1]).toEqual({
            requestId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
            url: "https://example.invalid/repository.git",
            path: "/tmp/repository",
            options: { depth: 1, branch: "main", recurseSubmodules: true },
        });
    });

    it("[성공] 호출하기 전에 구독하고 시간을 지정하고 하나의 서비스 수명을 전달함", async () => {
        const received: GitRequestEvent[] = [];
        const terminal = {
            kind: "completed" as const,
            requestId: REQUEST_ID,
            exitCode: 0,
            durationMs: 4,
        };
        electronMock.invoke.mockImplementation(
            async (channel: string): Promise<unknown> => {
                if (channel !== TEST_TRPC_PATHS.gitQuery)
                    throw new Error(`Unexpected channel ${channel}`);
                const emit = gitEventHandler();
                emit(
                    {},
                    {
                        kind: "started",
                        requestId: REQUEST_ID,
                        displayCommand: "git status",
                        startedAtMs: 1,
                    },
                );
                emit(
                    {},
                    {
                        kind: "output",
                        requestId: REQUEST_ID,
                        sequence: 0,
                        stream: "stdout",
                        data: "clean",
                    },
                );
                emit({}, terminal);
                return terminal;
            },
        );

        await expect(
            api().git.executeQuery(
                {
                    kind: "status",
                    requestId: REQUEST_ID,
                    repositoryId: REPOSITORY_ID,
                },
                (event) => received.push(event),
            ),
        ).resolves.toEqual(terminal);
        expect(received.map((event) => event.kind)).toEqual([
            "started",
            "output",
            "completed",
        ]);
    });

    it("[성공] 호출 응답 이벤트 채널보다 먼저 도착하면 출력 이벤트를 유지함", async () => {
        const received: GitRequestEvent[] = [];
        const terminal = {
            kind: "completed" as const,
            requestId: REQUEST_ID,
            exitCode: 0,
            durationMs: 4,
        };
        electronMock.invoke.mockImplementation(
            async (channel: string): Promise<unknown> => {
                if (channel !== TEST_TRPC_PATHS.gitQuery)
                    throw new Error(`Unexpected channel ${channel}`);
                setTimeout(() => {
                    const emit = gitEventHandler();
                    emit(
                        {},
                        {
                            kind: "started",
                            requestId: REQUEST_ID,
                            displayCommand: "git log",
                            startedAtMs: 1,
                        },
                    );
                    emit(
                        {},
                        {
                            kind: "output",
                            requestId: REQUEST_ID,
                            sequence: 0,
                            stream: "stdout",
                            data: "commit output\0",
                        },
                    );
                    emit({}, terminal);
                }, 0);
                return terminal;
            },
        );

        await expect(
            api().git.executeQuery(
                {
                    kind: "log",
                    requestId: REQUEST_ID,
                    repositoryId: REPOSITORY_ID,
                    skip: 0,
                    limit: 500,
                    order: "topology",
                    filters: {
                        query: null,
                        branch: null,
                        author: null,
                        since: null,
                        until: null,
                        paths: [],
                        noMerges: false,
                        regex: false,
                        matchCase: false,
                    },
                },
                (event) => received.push(event),
            ),
        ).resolves.toEqual(terminal);
        expect(received.map((event) => event.kind)).toEqual([
            "started",
            "output",
            "completed",
        ]);
        expect(received[1]).toMatchObject({ data: "commit output\0" });
    });

    it("[성공] 신뢰하는 사전 임대 기간을 통해 작업을", async () => {
        const received: GitRequestEvent[] = [];
        const request = {
            kind: "operation" as const,
            requestId: REQUEST_ID,
            repositoryId: REPOSITORY_ID,
            operation: { kind: "stage" as const, paths: ["tracked.txt"] },
        };
        const terminal = {
            kind: "completed" as const,
            requestId: REQUEST_ID,
            exitCode: 0,
            durationMs: 4,
        };
        electronMock.invoke.mockImplementation(
            async (channel: string, raw: unknown): Promise<unknown> => {
                if (channel !== TEST_TRPC_PATHS.gitQuery)
                    throw new Error(`Unexpected channel ${channel}`);
                expect(raw).toEqual(request);
                const emit = gitEventHandler();
                emit(
                    {},
                    {
                        kind: "started",
                        requestId: REQUEST_ID,
                        displayCommand: "git add -- tracked.txt",
                        startedAtMs: 1,
                    },
                );
                emit({}, terminal);
                return terminal;
            },
        );

        await expect(
            api().git.executeQuery(request, (event) => received.push(event)),
        ).resolves.toEqual(terminal);
        expect(received.map((event) => event.kind)).toEqual([
            "started",
            "completed",
        ]);
    });

    it("[성공] 권한 파일 결과를 검증하고 시계자 정리를 소유함", async () => {
        const received: RepositoryChangedEvent[] = [];
        electronMock.invoke.mockImplementation(
            async (channel: string): Promise<unknown> => {
                if (channel === TEST_TRPC_PATHS.gitReadFile)
                    return FILE_CONTENT;
                if (channel === TEST_TRPC_PATHS.gitReadFilePreview)
                    return FILE_PREVIEW;
                if (channel === TEST_TRPC_PATHS.gitWatchRepository) {
                    repositoryChangedEventHandler()({}, REPOSITORY_CHANGED);
                    return undefined;
                }
                if (channel === TEST_TRPC_PATHS.gitUnwatchRepository)
                    return undefined;
                throw new Error(`Unexpected channel ${channel}`);
            },
        );

        await expect(
            api().git.readFile(
                REPOSITORY_ID,
                { kind: "workingTree" },
                "tracked.txt",
            ),
        ).resolves.toEqual(FILE_CONTENT);
        await expect(
            api().git.readFilePreview(
                REPOSITORY_ID,
                { kind: "index" },
                "tracked.bin",
            ),
        ).resolves.toEqual(FILE_PREVIEW);
        await expect(
            api().git.watchRepository(REPOSITORY_ID, (event) =>
                received.push(event),
            ),
        ).resolves.toBeUndefined();
        expect(received).toEqual([REPOSITORY_CHANGED]);
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            1,
            TEST_TRPC_PATHS.gitReadFile,
            {
                repositoryId: REPOSITORY_ID,
                source: { kind: "workingTree" },
                path: "tracked.txt",
            },
        );

        await expect(
            api().git.unwatchRepository(REPOSITORY_ID),
        ).resolves.toBeUndefined();
        repositoryChangedEventHandler()({}, REPOSITORY_CHANGED);
        expect(received).toEqual([REPOSITORY_CHANGED]);
    });

    it("[실패] 다른 요청과 관련 서버에 응답을 했습니다", async () => {
        electronMock.invoke.mockResolvedValue({
            kind: "completed",
            requestId: "cb2587dc-3b92-454d-86fb-94486b336c6b",
            exitCode: 0,
            durationMs: 1,
        });

        await expect(
            api().git.executeQuery(
                {
                    kind: "status",
                    requestId: REQUEST_ID,
                    repositoryId: REPOSITORY_ID,
                },
                () => undefined,
            ),
        ).rejects.toThrow("Git query result did not match its request");
    });

    it("[성공] 터미널을 생성하기 전에 구독하고 모든 터미널 작동을 검증함", async () => {
        const received: TerminalEvent[] = [];
        electronMock.invoke.mockImplementation(
            async (
                channel: string,
                request: Readonly<Record<string, unknown>>,
            ): Promise<unknown> => {
                if (channel === TEST_TRPC_PATHS.terminalCreate) {
                    terminalEventHandler()(
                        {},
                        {
                            kind: "output",
                            requestId: request.requestId,
                            terminalId: TERMINAL_ID,
                            sequence: 0,
                            data: [112, 119, 100, 13, 10],
                        },
                    );
                    return {
                        requestId: request.requestId,
                        terminalId: TERMINAL_ID,
                    };
                }
                if (channel === TEST_TRPC_PATHS.terminalListLaunchTargets) {
                    return {
                        shells: [
                            { kind: "shell", id: "zsh", displayName: "Zsh" },
                        ],
                        agents: [],
                    };
                }
                if (
                    channel === TEST_TRPC_PATHS.terminalWrite ||
                    channel === TEST_TRPC_PATHS.terminalResize ||
                    channel === TEST_TRPC_PATHS.terminalClose ||
                    channel === TEST_TRPC_PATHS.terminalCloseRepository
                ) {
                    return undefined;
                }
                throw new Error(`Unexpected channel ${channel}`);
            },
        );

        await expect(
            api().terminal.create(
                REPOSITORY_ID,
                100,
                28,
                { kind: "default" },
                (event) => received.push(event),
            ),
        ).resolves.toBe(TERMINAL_ID);
        await expect(api().terminal.listLaunchTargets()).resolves.toEqual({
            shells: [{ kind: "shell", id: "zsh", displayName: "Zsh" }],
            agents: [],
        });
        await expect(
            api().terminal.write(TERMINAL_ID, "pwd\r"),
        ).resolves.toBeUndefined();
        await expect(
            api().terminal.resize(TERMINAL_ID, 120, 36),
        ).resolves.toBeUndefined();
        await expect(
            api().terminal.close(TERMINAL_ID),
        ).resolves.toBeUndefined();
        await expect(
            api().terminal.closeRepository(REPOSITORY_ID),
        ).resolves.toBeUndefined();

        expect(received).toEqual([
            { kind: "output", sequence: 0, data: [112, 119, 100, 13, 10] },
        ]);
    });
});

describe("전자 사전 로드 거부 API", () => {
    const oauthSessionId = "91af28cc-4493-4ceb-b405-84878dd5dbe8";
    const account = Object.freeze({
        id: "account-1",
        provider: "gitHub" as const,
        baseUrl: "https://github.com",
        login: "octocat",
    });
    const changeRequest = Object.freeze({
        number: 7,
        title: "Ship Electron hosting",
        state: "open",
        author: "octocat",
        sourceBranch: "feature",
        targetBranch: "main",
        webUrl: "https://github.com/owner/repo/pull/7",
        nodeId: "PR_kwDOExample",
        draft: false,
        updatedAt: "2026-07-19T00:00:00Z",
    });

    beforeEach(() => electronMock.invoke.mockReset());

    it("[성공] OAuth prompt와 session 완료·취소를 tRPC mutation으로 연결함", async () => {
        const prompt = Object.freeze({
            kind: "device" as const,
            sessionId: oauthSessionId,
            provider: "gitHub" as const,
            baseUrl: "https://github.com",
            authorizationUrl: "https://github.com/login/device",
            userCode: "ABCD-EFGH",
            expiresAt: 2_000_000_000_000,
        });
        electronMock.invoke
            .mockResolvedValueOnce(prompt)
            .mockResolvedValueOnce(account)
            .mockResolvedValueOnce(undefined);

        await expect(
            api().hosting.beginOAuth(
                "gitHub",
                "https://github.com/path",
                "  client-id  ",
            ),
        ).resolves.toEqual(prompt);
        await expect(api().hosting.awaitOAuth(oauthSessionId)).resolves.toEqual(
            account,
        );
        await expect(
            api().hosting.cancelOAuth(oauthSessionId),
        ).resolves.toBeUndefined();

        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            1,
            TEST_TRPC_PATHS.hostingBeginOAuth,
            {
                provider: "gitHub",
                baseUrl: "https://github.com",
                clientId: "client-id",
            },
        );
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            2,
            TEST_TRPC_PATHS.hostingAwaitOAuth,
            { sessionId: oauthSessionId },
        );
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            3,
            TEST_TRPC_PATHS.hostingCancelOAuth,
            { sessionId: oauthSessionId },
        );
    });

    it("[실패] 모든 예외 챔피언십을 심사하고 자격을 증명하지 않음", async () => {
        electronMock.invoke
            .mockResolvedValueOnce(account)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                kind: "changeRequest",
                item: changeRequest,
            });

        const saved = await api().hosting.saveAccount(
            "gitHub",
            "https://github.com/",
            "ghp_super-secret",
        );
        await api().hosting.restoreAccounts([saved]);
        await api().hosting.deleteAccount(saved.id);
        const response = await api().hosting.execute(saved.id, {
            kind: "get",
            project: "owner/repo",
            number: 7,
        });

        expect(saved).toEqual(account);
        expect(JSON.stringify(saved)).not.toContain("ghp_super-secret");
        expect(response).toEqual({
            kind: "changeRequest",
            item: changeRequest,
        });
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            1,
            TEST_TRPC_PATHS.hostingSaveAccount,
            {
                provider: "gitHub",
                baseUrl: "https://github.com",
                token: "ghp_super-secret",
            },
        );
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            2,
            TEST_TRPC_PATHS.hostingRestoreAccounts,
            {
                accounts: [account],
            },
        );
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            3,
            TEST_TRPC_PATHS.hostingDeleteAccount,
            {
                accountId: "account-1",
            },
        );
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            4,
            TEST_TRPC_PATHS.hostingExecute,
            {
                accountId: "account-1",
                request: { kind: "get", project: "owner/repo", number: 7 },
            },
        );
    });

    it("[실패] IPC 이전에는 입력을 하지 않았는데 IPC 이후에는 일치하지 않는 응답이 있었습니다", async () => {
        await expect(
            api().hosting.restoreAccounts([
                { ...account, token: "must-not-cross" },
            ] as never),
        ).rejects.toThrow();
        expect(electronMock.invoke).not.toHaveBeenCalled();

        electronMock.invoke.mockResolvedValue({
            kind: "completed",
            message: "wrong result",
        });
        await expect(
            api().hosting.execute("account-1", {
                kind: "files",
                project: "owner/repo",
                number: 7,
            }),
        ).rejects.toThrow("Hosting response did not match its request");

        electronMock.invoke.mockClear();
        await expect(api().hosting.awaitOAuth("not-a-uuid")).rejects.toThrow();
        await expect(api().hosting.cancelOAuth("not-a-uuid")).rejects.toThrow();
        expect(electronMock.invoke).not.toHaveBeenCalled();
    });

    it("[실패] 저장 요청과 일치하지 않는 계정 ID가 있음", async () => {
        electronMock.invoke.mockResolvedValue({
            ...account,
            provider: "gitLab",
        });

        await expect(
            api().hosting.saveAccount(
                "gitHub",
                "https://github.com",
                "ghp_secret",
            ),
        ).rejects.toThrow("Hosting account response did not match its request");

        electronMock.invoke.mockResolvedValue({
            kind: "browser",
            sessionId: oauthSessionId,
            provider: "gitLab",
            baseUrl: "https://gitlab.com",
            authorizationUrl: "https://gitlab.com/oauth/authorize",
            expiresAt: 2_000_000_000_000,
        });
        await expect(
            api().hosting.beginOAuth(
                "gitHub",
                "https://github.com",
                "client-id",
            ),
        ).rejects.toThrow("OAuth prompt response did not match its request");
    });

    it("[실패] 기본 경계를 보장받을 수 있는 모든 자격을 증명하는 현장을 유지하고 있음", async () => {
        electronMock.invoke.mockResolvedValue({
            ...account,
            token: "ghp_must-never-reach-the-renderer",
        });

        await expect(
            api().hosting.saveAccount(
                "gitHub",
                "https://github.com",
                "ghp_request-secret",
            ),
        ).rejects.toThrow();
    });
});
