import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepositorySnapshot, TerminalEvent } from "../../src/generated";
import type {
    FileContent,
    FilePreview,
    GitCreationEvent,
    GitRequestEvent,
    RepositoryChangedEvent,
    RepositoryRecord,
} from "../../src/shared/contracts/git-utility";
import type { DesktopApi } from "../../src/shared/contracts/ipc";
import { IPC_CHANNELS } from "../../src/shared/contracts/ipc";

const electronMock = vi.hoisted(() => ({
    exposedApi: null as unknown,
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
    contextBridge: {
        exposeInMainWorld: (_name: string, api: unknown): void => {
            electronMock.exposedApi = api;
        },
    },
    ipcRenderer: {
        invoke: electronMock.invoke,
        on: electronMock.on,
        removeListener: electronMock.removeListener,
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
    const registration = electronMock.on.mock.calls.find(
        ([channel]) => channel === IPC_CHANNELS.gitQueryEvent,
    );
    if (registration === undefined)
        throw new Error("Git query event handler was not registered");
    return registration[1] as IpcEventHandler;
}

function gitCreationEventHandler(): IpcEventHandler {
    const registration = electronMock.on.mock.calls.find(
        ([channel]) => channel === IPC_CHANNELS.gitCreationEvent,
    );
    if (registration === undefined)
        throw new Error("Git creation event handler was not registered");
    return registration[1] as IpcEventHandler;
}

function repositoryChangedEventHandler(): IpcEventHandler {
    const registration = electronMock.on.mock.calls.find(
        ([channel]) => channel === IPC_CHANNELS.gitRepositoryChanged,
    );
    if (registration === undefined)
        throw new Error("Repository event handler was not registered");
    return registration[1] as IpcEventHandler;
}

function terminalEventHandler(): IpcEventHandler {
    const registration = electronMock.on.mock.calls.find(
        ([channel]) => channel === IPC_CHANNELS.terminalEvent,
    );
    if (registration === undefined)
        throw new Error("Terminal event handler was not registered");
    return registration[1] as IpcEventHandler;
}

describe("Electron preload Git API", () => {
    beforeEach(() => {
        electronMock.invoke.mockReset();
    });

    it("validates HTTP(S) external URLs before crossing IPC", async () => {
        electronMock.invoke.mockResolvedValue(undefined);

        await expect(
            api().shell.openExternal(
                "http://gitlab.example.test/group/project",
            ),
        ).resolves.toBeUndefined();
        expect(electronMock.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.shellOpenExternal,
            "http://gitlab.example.test/group/project",
        );

        electronMock.invoke.mockClear();
        await expect(
            api().shell.openExternal("file:///tmp/private"),
        ).rejects.toThrow("credential-free HTTP or HTTPS");
        expect(electronMock.invoke).not.toHaveBeenCalled();
    });

    it("validates repository lifecycle results", async () => {
        electronMock.invoke.mockImplementation(
            async (channel: string): Promise<unknown> => {
                if (channel === IPC_CHANNELS.gitOpenRepository)
                    return REPOSITORY;
                if (channel === IPC_CHANNELS.gitCloseRepository) return true;
                if (channel === IPC_CHANNELS.gitCancelQuery) return false;
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

    it("validates a complete inspected repository snapshot", async () => {
        electronMock.invoke.mockResolvedValue(SNAPSHOT);

        await expect(api().git.inspectSnapshot(REPOSITORY_ID)).resolves.toEqual(
            SNAPSHOT,
        );
        expect(electronMock.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.gitInspectSnapshot,
            {
                repositoryId: REPOSITORY_ID,
            },
        );
    });

    it("validates every repository inspection and ignore-rules response", async () => {
        electronMock.invoke.mockImplementation(
            async (
                channel: string,
                request: Readonly<Record<string, unknown>>,
            ): Promise<unknown> => {
                if (channel !== IPC_CHANNELS.gitRepositoryService) {
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
            IPC_CHANNELS.gitRepositoryService,
            {
                operation: "writeIgnoreRules",
                repositoryId: REPOSITORY_ID,
                rules: { gitignore: "coverage/\n", infoExclude: ".work/\n" },
            },
        );
    });

    it("validates direct push and history rewrite preview results", async () => {
        electronMock.invoke.mockImplementation(
            async (
                channel: string,
                request: Readonly<Record<string, unknown>>,
            ): Promise<unknown> => {
                expect(channel).toBe(IPC_CHANNELS.gitRepositoryService);
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
            IPC_CHANNELS.gitRepositoryService,
            {
                operation: "pushPreview",
                repositoryId: REPOSITORY_ID,
                remote: "origin",
                remoteRef: "refs/heads/main",
                localRevision: "HEAD",
            },
        );
    });

    it("validates all patch, shelf, changelist, recovery, and conflict calls", async () => {
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
                expect(channel).toBe(IPC_CHANNELS.gitRepositoryService);
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
        ).resolves.toMatchObject({ restoredRefs: ["refs/heads/main"] });
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

    it("rejects unsafe special-service input before invoking main", async () => {
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

    it("validates submodule, file-open, and multi-root requests in the sandboxed preload", async () => {
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
                if (channel === IPC_CHANNELS.gitOpenWorkingTreeFile)
                    return undefined;
                if (channel !== IPC_CHANNELS.gitRepositoryService)
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
                IPC_CHANNELS.gitRepositoryService,
                {
                    operation: "loadSubmoduleDiff",
                    repositoryId: REPOSITORY_ID,
                    before: { kind: "revision", revision: "HEAD~1" },
                    after: { kind: "workingTree" },
                    path: "modules/client",
                },
            ],
            [
                IPC_CHANNELS.gitOpenWorkingTreeFile,
                { repositoryId: REPOSITORY_ID, path: "tracked.txt" },
            ],
            [
                IPC_CHANNELS.gitRepositoryService,
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
                IPC_CHANNELS.gitRepositoryService,
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

    it("validates and streams repository initialize and clone operations", async () => {
        const received: GitCreationEvent[] = [];
        electronMock.invoke.mockImplementation(
            async (
                channel: string,
                request: Readonly<Record<string, unknown>>,
            ): Promise<unknown> => {
                if (
                    channel !== IPC_CHANNELS.gitInitializeRepository &&
                    channel !== IPC_CHANNELS.gitCloneRepository
                ) {
                    throw new Error(`Unexpected channel ${channel}`);
                }
                const operation =
                    channel === IPC_CHANNELS.gitInitializeRepository
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
                emit(
                    {},
                    {
                        kind: "completed",
                        requestId: request.requestId,
                        operation,
                        repository: REPOSITORY,
                        exitCode: 0,
                        durationMs: 2,
                    },
                );
                return REPOSITORY;
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

    it("subscribes before invoking and delivers one ordered query lifecycle", async () => {
        const received: GitRequestEvent[] = [];
        const terminal = {
            kind: "completed" as const,
            requestId: REQUEST_ID,
            exitCode: 0,
            durationMs: 4,
        };
        electronMock.invoke.mockImplementation(
            async (channel: string): Promise<unknown> => {
                if (channel !== IPC_CHANNELS.gitQuery)
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

    it("delivers an operation through the same validated preload lifecycle", async () => {
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
                if (channel !== IPC_CHANNELS.gitQuery)
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

    it("validates bounded file results and owns repository watcher cleanup", async () => {
        const received: RepositoryChangedEvent[] = [];
        electronMock.invoke.mockImplementation(
            async (channel: string): Promise<unknown> => {
                if (channel === IPC_CHANNELS.gitReadFile) return FILE_CONTENT;
                if (channel === IPC_CHANNELS.gitReadFilePreview)
                    return FILE_PREVIEW;
                if (channel === IPC_CHANNELS.gitWatchRepository) {
                    repositoryChangedEventHandler()({}, REPOSITORY_CHANGED);
                    return undefined;
                }
                if (channel === IPC_CHANNELS.gitUnwatchRepository)
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
            IPC_CHANNELS.gitReadFile,
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

    it("rejects a terminal response correlated to another request", async () => {
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

    it("subscribes before creating a terminal and validates every terminal operation", async () => {
        const received: TerminalEvent[] = [];
        electronMock.invoke.mockImplementation(
            async (
                channel: string,
                request: Readonly<Record<string, unknown>>,
            ): Promise<unknown> => {
                if (channel === IPC_CHANNELS.terminalCreate) {
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
                if (channel === IPC_CHANNELS.terminalListLaunchTargets) {
                    return {
                        shells: [
                            { kind: "shell", id: "zsh", displayName: "Zsh" },
                        ],
                        agents: [],
                    };
                }
                if (
                    channel === IPC_CHANNELS.terminalWrite ||
                    channel === IPC_CHANNELS.terminalResize ||
                    channel === IPC_CHANNELS.terminalClose ||
                    channel === IPC_CHANNELS.terminalCloseRepository
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

describe("Electron preload hosting API", () => {
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

    it("validates all hosting calls and does not expose the credential", async () => {
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
            IPC_CHANNELS.hostingSaveAccount,
            {
                provider: "gitHub",
                baseUrl: "https://github.com",
                token: "ghp_super-secret",
            },
        );
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            2,
            IPC_CHANNELS.hostingRestoreAccounts,
            { accounts: [account] },
        );
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            3,
            IPC_CHANNELS.hostingDeleteAccount,
            { accountId: "account-1" },
        );
        expect(electronMock.invoke).toHaveBeenNthCalledWith(
            4,
            IPC_CHANNELS.hostingExecute,
            {
                accountId: "account-1",
                request: { kind: "get", project: "owner/repo", number: 7 },
            },
        );
    });

    it("rejects malformed input before IPC and mismatched responses after IPC", async () => {
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
    });

    it("rejects an account identity that does not match the save request", async () => {
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
    });

    it("rejects any credential field returned across the main boundary", async () => {
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
