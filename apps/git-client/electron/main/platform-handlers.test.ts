import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    DESKTOP_TRPC_CHANNELS,
    DESKTOP_TRPC_PROTOCOL_VERSION,
    DesktopTrpcResponseSchema,
} from "../../src/shared/contracts/desktop-trpc";
import type {
    FileContent,
    FilePreview,
    GitCreationEvent,
    GitCreationEventListener,
    GitCreationTerminalEvent,
    GitExecutionRequest,
    GitEventListener,
    GitQueryRequest,
    GitRequestEvent,
    GitRepositoryServiceRequest,
    GitRepositoryServiceResult,
    GitTerminalEvent,
    RepositoryChangedEvent,
    RepositoryChangedListener,
} from "../../src/shared/contracts/git-utility";
import type { TerminalEventEnvelope } from "../../src/shared/contracts/terminal";
import {
    TEST_TRPC_PATHS,
    type TestDesktopTrpcPath,
    testTrpcDomain,
    testTrpcOperationType,
} from "../test/desktop-trpc-fixture";

type InvokeHandler = (event: unknown, raw: unknown) => unknown;

const electronMock = vi.hoisted(() => ({
    handlers: new Map<string, InvokeHandler>(),
    clipboardWriteText: vi.fn(),
    fromWebContents: vi.fn(() => null as unknown),
    openExternal: vi.fn(),
    openPath: vi.fn(),
}));

vi.mock("electron", () => ({
    BrowserWindow: { fromWebContents: electronMock.fromWebContents },
    clipboard: { writeText: electronMock.clipboardWriteText },
    dialog: {
        showOpenDialog: vi.fn(),
        showSaveDialog: vi.fn(),
    },
    shell: {
        openExternal: electronMock.openExternal,
        openPath: electronMock.openPath,
    },
}));

import {
    registerPlatformHandlers,
    unregisterPlatformHandlers,
} from "./platform-handlers";
import {
    TEST_REPOSITORY as REPOSITORY,
    TEST_REPOSITORY_ID as REPOSITORY_ID,
    TEST_SNAPSHOT as SNAPSHOT,
} from "./test/repository-fixtures";

const REQUEST_ID = "388ac97b-6f01-4e10-8149-78ec15412d18";
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
    invalidations: ["status", "management"],
};

const webContentsIpc = {
    handle(channel: string, handler: InvokeHandler): void {
        electronMock.handlers.set(channel, handler);
    },
    removeHandler(channel: string): void {
        electronMock.handlers.delete(channel);
    },
};

function handler(path: TestDesktopTrpcPath): InvokeHandler {
    const channel = DESKTOP_TRPC_CHANNELS[testTrpcDomain(path)];
    const registered = electronMock.handlers.get(channel);
    if (registered === undefined)
        throw new Error(`No handler registered for ${channel}`);
    return async (event, input) => {
        const response = DesktopTrpcResponseSchema.parse(
            await registered(event, {
                version: DESKTOP_TRPC_PROTOCOL_VERSION,
                type: testTrpcOperationType(path),
                path,
                input,
            }),
        );
        if (!response.ok) throw new Error(response.error.message);
        return response.data;
    };
}

describe("플랫폼 Git IPC 핸들러", () => {
    beforeEach(() => {
        electronMock.handlers.clear();
        electronMock.openExternal.mockReset();
        electronMock.openPath.mockReset();
        electronMock.fromWebContents.mockReset();
        electronMock.fromWebContents.mockReturnValue(null);
    });

    it("[실패] 전원 모드에서 열려 있는 휴가용 Git 작업 IPC에 포함되어 있음", async () => {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const executeQuery = vi.fn(async () => ({
            kind: "completed" as const,
            requestId: REQUEST_ID,
            exitCode: 0,
            durationMs: 1,
        }));
        const settings = new Map<string, unknown>([
            ["safeRepositoryPaths", [REPOSITORY.path]],
            ["activeRepositoryPath", REPOSITORY.path],
        ]);
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: (key: string) => settings.get(key) ?? null },
            menu: { sync: vi.fn() },
            gitUtility: {
                openRepository: vi.fn(async () => REPOSITORY),
                executeQuery,
            },
            terminalUtility: { closeRepository: vi.fn(async () => 0) },
            hosting: {},
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };

        await handler(TEST_TRPC_PATHS.gitOpenRepository)(event, {
            path: REPOSITORY.path,
        });
        await expect(
            handler(TEST_TRPC_PATHS.gitQuery)(event, {
                kind: "status",
                requestId: REQUEST_ID,
                repositoryId: REPOSITORY_ID,
            }),
        ).resolves.toMatchObject({ kind: "completed", requestId: REQUEST_ID });
        await expect(
            handler(TEST_TRPC_PATHS.gitQuery)(event, {
                kind: "operation",
                requestId: REQUEST_ID,
                repositoryId: REPOSITORY_ID,
                operation: { kind: "stageAll" },
            }),
        ).rejects.toThrow("Git changes is unavailable in Safe Mode");
        expect(executeQuery).toHaveBeenCalledOnce();
        unregisterPlatformHandlers();
    });

    it("[실패] 그립 모드에서 손잡이 서비스 및 작업 트리를 변형할 수 있음", async () => {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const executeRepositoryService = vi.fn();
        const writeWorkingTreeFile = vi.fn();
        const resolveWorkingTreeFile = vi.fn();
        const settings = new Map<string, unknown>([
            ["safeRepositoryPaths", [REPOSITORY.path]],
            ["activeRepositoryPath", REPOSITORY.path],
        ]);
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: (key: string) => settings.get(key) ?? null },
            menu: { sync: vi.fn() },
            gitUtility: {
                openRepository: vi.fn(async () => REPOSITORY),
                executeRepositoryService,
                writeWorkingTreeFile,
                resolveWorkingTreeFile,
            },
            terminalUtility: { closeRepository: vi.fn(async () => 0) },
            hosting: {},
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };
        await handler(TEST_TRPC_PATHS.gitOpenRepository)(event, {
            path: REPOSITORY.path,
        });

        await expect(
            handler(TEST_TRPC_PATHS.gitRepositoryService)(event, {
                operation: "writeIgnoreRules",
                repositoryId: REPOSITORY_ID,
                rules: { gitignore: "dist/\n", infoExclude: "" },
            }),
        ).rejects.toThrow("Git changes is unavailable in Safe Mode");
        await expect(
            handler(TEST_TRPC_PATHS.gitRepositoryService)(event, {
                operation: "preCommitCheck",
                repositoryId: REPOSITORY_ID,
            }),
        ).rejects.toThrow("Git changes is unavailable in Safe Mode");
        await expect(
            handler(TEST_TRPC_PATHS.gitWriteWorkingTreeFile)(event, {
                repositoryId: REPOSITORY_ID,
                path: "tracked.txt",
                content: "changed\n",
                activityName: null,
            }),
        ).rejects.toThrow("Git changes is unavailable in Safe Mode");
        await expect(
            handler(TEST_TRPC_PATHS.gitOpenWorkingTreeFile)(event, {
                repositoryId: REPOSITORY_ID,
                path: "tracked.txt",
            }),
        ).rejects.toThrow("External execution is unavailable in Safe Mode");
        expect(executeRepositoryService).not.toHaveBeenCalled();
        expect(writeWorkingTreeFile).not.toHaveBeenCalled();
        expect(resolveWorkingTreeFile).not.toHaveBeenCalled();
        unregisterPlatformHandlers();
    });

    it("[실패] 서부 PTY를 늦게 고칠 수 있는 후방 복구방 시 터미널 및 IPC를 포함하고 있음", async () => {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const settings = new Map<string, unknown>([
            ["safeRepositoryPaths", []],
            ["activeRepositoryPath", REPOSITORY.path],
        ]);
        const terminalUtility = {
            create: vi.fn(async () => ({
                requestId: REQUEST_ID,
                terminalId: "f6478d5c-5aa0-4d4a-b646-cb950b0ca555",
            })),
            listLaunchTargets: vi.fn(async () => ({ shells: [], agents: [] })),
            closeRepository: vi.fn(async () => 1),
        };
        const hosting = {
            deleteAccount: vi.fn(async () => undefined),
        };
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: (key: string) => settings.get(key) ?? null },
            menu: { sync: vi.fn() },
            gitUtility: { openRepository: vi.fn(async () => REPOSITORY) },
            terminalUtility,
            hosting,
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };
        const createRequest = {
            requestId: REQUEST_ID,
            repositoryId: REPOSITORY_ID,
            cols: 100,
            rows: 28,
        };

        await handler(TEST_TRPC_PATHS.gitOpenRepository)(event, {
            path: REPOSITORY.path,
        });
        await expect(
            handler(TEST_TRPC_PATHS.terminalCreate)(event, createRequest),
        ).resolves.toMatchObject({
            requestId: REQUEST_ID,
        });
        settings.set("safeRepositoryPaths", [REPOSITORY.path]);
        await handler(TEST_TRPC_PATHS.gitOpenRepository)(event, {
            path: REPOSITORY.path,
        });

        expect(terminalUtility.closeRepository).toHaveBeenCalledWith({
            repositoryId: REPOSITORY_ID,
        });
        await expect(
            handler(TEST_TRPC_PATHS.terminalCreate)(event, createRequest),
        ).rejects.toThrow("Terminal access is unavailable in Safe Mode");
        await expect(
            handler(TEST_TRPC_PATHS.terminalListLaunchTargets)(event, {}),
        ).rejects.toThrow("Terminal access is unavailable in Safe Mode");
        await expect(
            handler(TEST_TRPC_PATHS.hostingDeleteAccount)(event, {
                accountId: "account-1",
            }),
        ).rejects.toThrow("Hosting access is unavailable in Safe Mode");
        expect(terminalUtility.create).toHaveBeenCalledOnce();
        expect(terminalUtility.listLaunchTargets).not.toHaveBeenCalled();
        expect(hosting.deleteAccount).not.toHaveBeenCalled();
        unregisterPlatformHandlers();
    });

    it("[실패] 하위 창에 대한 전체 IPC를 배치하고 기록을 표시하도록 제한함", async () => {
        const mainFrame = { url: "app://git-client/" };
        const mainWebContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const window = {
            isDestroyed: () => false,
            webContents: mainWebContents,
        };
        const localHistoryFrame = {
            url: `app://git-client/local-history?repositoryId=${REPOSITORY_ID}`,
        };
        const localHistoryWebContents = {
            isDestroyed: () => false,
            mainFrame: localHistoryFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const localHistoryWindow = {
            webContents: localHistoryWebContents,
            getParentWindow: () => window,
            once: vi.fn(),
        };
        electronMock.fromWebContents.mockReturnValue(localHistoryWindow);
        const executeRepositoryService = vi.fn(
            async (
                request: GitRepositoryServiceRequest,
            ): Promise<GitRepositoryServiceResult> => {
                if (request.operation !== "readLocalHistoryDiff") {
                    throw new Error(
                        `Unexpected repository service ${request.operation}`,
                    );
                }
                return { operation: request.operation, value: "diff" };
            },
        );
        const registration = registerPlatformHandlers({
            window,
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: { executeRepositoryService },
            terminalUtility: {},
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        registration.registerLocalHistoryWindow(
            localHistoryWindow as unknown as Parameters<
                typeof registration.registerLocalHistoryWindow
            >[0],
            REPOSITORY_ID,
        );
        const childEvent = {
            sender: localHistoryWebContents,
            senderFrame: localHistoryFrame,
        };

        await expect(
            handler(TEST_TRPC_PATHS.shellOpenExternal)(
                childEvent,
                "https://example.test",
            ),
        ).rejects.toThrow("not the main window");
        await expect(
            handler(TEST_TRPC_PATHS.localHistoryRepositoryService)(childEvent, {
                operation: "readLocalHistoryDiff",
                repositoryId: REPOSITORY_ID,
                activityId: REQUEST_ID,
                path: "README.md",
            }),
        ).resolves.toEqual({
            operation: "readLocalHistoryDiff",
            value: "diff",
        });
        await expect(
            handler(TEST_TRPC_PATHS.localHistoryRepositoryService)(childEvent, {
                operation: "readLocalHistoryDiff",
                repositoryId: "e49f8882-8116-4dd7-9363-5e8c341900af",
                activityId: REQUEST_ID,
                path: "README.md",
            }),
        ).rejects.toThrow("different repository");
        await expect(
            handler(TEST_TRPC_PATHS.localHistoryRepositoryService)(childEvent, {
                operation: "listConflicts",
                repositoryId: REPOSITORY_ID,
            }),
        ).rejects.toThrow("unavailable to Local History");
        expect(executeRepositoryService).toHaveBeenCalledTimes(1);
        unregisterPlatformHandlers();
    });

    it("[성공] 믿을 수 있는 렌더러에 대해 검증된 HTTP(S) URL만 조사함", async () => {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: {},
            terminalUtility: {},
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };

        await expect(
            handler(TEST_TRPC_PATHS.shellOpenExternal)(
                event,
                "http://gitlab.example.test/group/project",
            ),
        ).resolves.toBeUndefined();
        expect(electronMock.openExternal).toHaveBeenCalledWith(
            "http://gitlab.example.test/group/project",
            { activate: true },
        );

        await expect(
            handler(TEST_TRPC_PATHS.shellOpenExternal)(
                event,
                "https://token@example.test/private",
            ),
        ).rejects.toThrow("credential-free HTTP or HTTPS");
        expect(electronMock.openExternal).toHaveBeenCalledTimes(1);
        unregisterPlatformHandlers();
    });

    it("[성공] 시작과 작업 공간 창 경계 사이를 전환함", async () => {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const setMinimumSize = vi.fn();
        const setSize = vi.fn();
        const center = vi.fn();
        const onWindowPresentationModeChange = vi.fn();
        const window = {
            isDestroyed: () => false,
            webContents,
            setMinimumSize,
            getSize: vi.fn(() => [1184, 768]),
            setSize,
            center,
        };
        registerPlatformHandlers({
            window,
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: {},
            terminalUtility: {},
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
            onWindowPresentationModeChange,
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };

        await handler(TEST_TRPC_PATHS.windowSetPresentationMode)(
            event,
            "welcome",
        );
        expect(setMinimumSize).toHaveBeenLastCalledWith(800, 650);
        expect(setSize).toHaveBeenLastCalledWith(800, 650, true);
        expect(center).toHaveBeenCalledOnce();
        expect(onWindowPresentationModeChange).toHaveBeenLastCalledWith(
            "welcome",
        );

        await handler(TEST_TRPC_PATHS.windowSetPresentationMode)(
            event,
            "workspace",
        );
        expect(setMinimumSize).toHaveBeenLastCalledWith(960, 640);
        expect(onWindowPresentationModeChange).toHaveBeenLastCalledWith(
            "workspace",
        );
        unregisterPlatformHandlers();
    });

    it("[성공] Git 쿼리 이벤트를 발생시킬 수 있는 창으로 검증, 입력 및 스트리밍함", async () => {
        const send = vi.fn();
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send,
        };
        const window = { isDestroyed: () => false, webContents };
        const started: GitRequestEvent = {
            kind: "started",
            requestId: REQUEST_ID,
            displayCommand: "git status",
            startedAtMs: 1,
        };
        const terminal: GitTerminalEvent = {
            kind: "completed",
            requestId: REQUEST_ID,
            exitCode: 0,
            durationMs: 2,
        };
        const executeQuery = vi.fn(
            async (
                _request: GitQueryRequest,
                listener: GitEventListener,
            ): Promise<GitTerminalEvent> => {
                listener(started);
                listener(terminal);
                return terminal;
            },
        );
        const creationStarted: GitCreationEvent = {
            kind: "started",
            requestId: REQUEST_ID,
            operation: "initialize",
            displayCommand: "git init --initial-branch=main -- /tmp/repository",
            startedAtMs: 1,
        };
        const creationTerminal: GitCreationTerminalEvent = {
            kind: "completed",
            requestId: REQUEST_ID,
            operation: "initialize",
            repository: REPOSITORY,
            exitCode: 0,
            durationMs: 2,
        };
        const initializeRepository = vi.fn(
            async (
                _request: unknown,
                listener: GitCreationEventListener,
            ): Promise<GitCreationTerminalEvent> => {
                listener(creationStarted);
                listener(creationTerminal);
                return creationTerminal;
            },
        );
        const cloneStarted: GitCreationEvent = {
            ...creationStarted,
            operation: "clone",
            displayCommand: "git clone",
        };
        const cloneTerminal: GitCreationTerminalEvent = {
            ...creationTerminal,
            operation: "clone",
        };
        const cloneRepository = vi.fn(
            async (
                _request: unknown,
                listener: GitCreationEventListener,
            ): Promise<GitCreationTerminalEvent> => {
                listener(cloneStarted);
                listener(cloneTerminal);
                return cloneTerminal;
            },
        );
        const gitUtility = {
            openRepository: vi.fn(async () => REPOSITORY),
            initializeRepository,
            cloneRepository,
            closeRepository: vi.fn(async () => true),
            executeQuery,
            cancelQuery: vi.fn(async () => true),
        };
        registerPlatformHandlers({
            window,
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility,
            terminalUtility: {
                closeRepository: vi.fn(async () => 0),
            },
            stream: { publish: send },
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };

        await expect(
            handler(TEST_TRPC_PATHS.gitOpenRepository)(event, {
                path: "/tmp/repository",
            }),
        ).resolves.toEqual(REPOSITORY);
        await expect(
            handler(TEST_TRPC_PATHS.gitInitializeRepository)(event, {
                requestId: REQUEST_ID,
                path: "/tmp/repository",
                bare: false,
            }),
        ).resolves.toEqual(creationTerminal);
        await expect(
            handler(TEST_TRPC_PATHS.gitCloneRepository)(event, {
                requestId: REQUEST_ID,
                url: "https://example.invalid/repository.git",
                path: "/tmp/repository",
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
            }),
        ).resolves.toEqual(cloneTerminal);
        await expect(
            handler(TEST_TRPC_PATHS.gitQuery)(event, {
                kind: "status",
                requestId: REQUEST_ID,
                repositoryId: REPOSITORY_ID,
            }),
        ).resolves.toEqual(terminal);
        await expect(
            handler(TEST_TRPC_PATHS.gitCloseRepository)(event, {
                repositoryId: REPOSITORY_ID,
            }),
        ).resolves.toBe(true);
        await expect(
            handler(TEST_TRPC_PATHS.gitCancelQuery)(event, {
                requestId: REQUEST_ID,
            }),
        ).resolves.toBe(true);
        expect(send.mock.calls).toEqual([
            [{ kind: "git.creation.event", event: creationStarted }],
            [
                {
                    kind: "git.barrier",
                    operation: "creation",
                    requestId: REQUEST_ID,
                },
            ],
            [{ kind: "git.creation.event", event: cloneStarted }],
            [
                {
                    kind: "git.barrier",
                    operation: "creation",
                    requestId: REQUEST_ID,
                },
            ],
            [{ kind: "git.query.event", event: started }],
            [
                {
                    kind: "git.barrier",
                    operation: "query",
                    requestId: REQUEST_ID,
                },
            ],
        ]);
        unregisterPlatformHandlers();
    });

    it("[성공] Git IPC 수명주기를 통해 파티를 검증하고 스트리밍함", async () => {
        const send = vi.fn();
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send,
        };
        const operationRequest: GitExecutionRequest = {
            kind: "operation",
            requestId: REQUEST_ID,
            repositoryId: REPOSITORY_ID,
            operation: { kind: "stage", paths: ["tracked.txt"] },
        };
        const started: GitRequestEvent = {
            kind: "started",
            requestId: REQUEST_ID,
            displayCommand: "git add -- tracked.txt",
            startedAtMs: 1,
        };
        const terminal: GitTerminalEvent = {
            kind: "completed",
            requestId: REQUEST_ID,
            exitCode: 0,
            durationMs: 2,
        };
        const executeQuery = vi.fn(
            async (
                request: GitExecutionRequest,
                listener: GitEventListener,
            ): Promise<GitTerminalEvent> => {
                expect(request).toEqual(operationRequest);
                listener(started);
                listener(terminal);
                return terminal;
            },
        );
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: {
                openRepository: vi.fn(async () => REPOSITORY),
                executeQuery,
            },
            terminalUtility: {},
            stream: { publish: send },
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };

        await handler(TEST_TRPC_PATHS.gitOpenRepository)(event, {
            path: REPOSITORY.path,
        });

        await expect(
            handler(TEST_TRPC_PATHS.gitQuery)(event, operationRequest),
        ).resolves.toEqual(terminal);
        expect(send.mock.calls).toEqual([
            [{ kind: "git.query.event", event: started }],
            [
                {
                    kind: "git.barrier",
                    operation: "query",
                    requestId: REQUEST_ID,
                },
            ],
        ]);
        unregisterPlatformHandlers();
    });

    it("[실패]하기 전에는 전투할 수 없는 발신자의 Git 명령을 받았을 것임", async () => {
        const openRepository = vi.fn(async () => REPOSITORY);
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: {
                openRepository,
                closeRepository: vi.fn(),
                executeQuery: vi.fn(),
                cancelQuery: vi.fn(),
            },
            terminalUtility: {
                closeRepository: vi.fn(async () => 0),
            },
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);

        await expect(
            handler(TEST_TRPC_PATHS.gitOpenRepository)(
                {
                    sender: {},
                    senderFrame: { url: "https://attacker.invalid/" },
                },
                { path: "/tmp/repository" },
            ),
        ).rejects.toThrow("IPC sender is not the main window");
        expect(openRepository).not.toHaveBeenCalled();
        unregisterPlatformHandlers();
    });

    it("[성공] 전체 스냅인 스캔들을 검증하고 당황함", async () => {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const inspectSnapshot = vi.fn(async () => SNAPSHOT);
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: { inspectSnapshot },
            terminalUtility: {},
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };

        await expect(
            handler(TEST_TRPC_PATHS.gitInspectSnapshot)(event, {
                repositoryId: REPOSITORY_ID,
            }),
        ).resolves.toEqual(SNAPSHOT);
        expect(inspectSnapshot).toHaveBeenCalledWith(REPOSITORY_ID);
        unregisterPlatformHandlers();
    });

    it("[성공] 감시자 및 규칙을 무시하고 감시하고 감시함", async () => {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const headOid = SNAPSHOT.headOid;
        if (headOid === null) throw new Error("Fixture HEAD is required");
        const executeRepositoryService = vi.fn(
            async (
                request: GitRepositoryServiceRequest,
            ): Promise<GitRepositoryServiceResult> => {
                if (request.operation === "compareBranches") {
                    return {
                        operation: request.operation,
                        value: {
                            ahead: 1,
                            behind: 0,
                            leftOnly: [headOid],
                            rightOnly: [],
                        },
                    };
                }
                if (request.operation === "writeIgnoreRules") {
                    return { operation: request.operation };
                }
                throw new Error(
                    `Unexpected repository service ${request.operation}`,
                );
            },
        );
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: {
                openRepository: vi.fn(async () => REPOSITORY),
                executeRepositoryService,
            },
            terminalUtility: {},
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };

        await handler(TEST_TRPC_PATHS.gitOpenRepository)(event, {
            path: REPOSITORY.path,
        });

        await expect(
            handler(TEST_TRPC_PATHS.gitRepositoryService)(event, {
                operation: "compareBranches",
                repositoryId: REPOSITORY_ID,
                left: "feature",
                right: "main",
            }),
        ).resolves.toEqual({
            operation: "compareBranches",
            value: {
                ahead: 1,
                behind: 0,
                leftOnly: [SNAPSHOT.headOid],
                rightOnly: [],
            },
        });
        await expect(
            handler(TEST_TRPC_PATHS.gitRepositoryService)(event, {
                operation: "writeIgnoreRules",
                repositoryId: REPOSITORY_ID,
                rules: { gitignore: "dist/\n", infoExclude: ".cache/\n" },
            }),
        ).resolves.toEqual({ operation: "writeIgnoreRules" });
        expect(executeRepositoryService).toHaveBeenNthCalledWith(1, {
            operation: "compareBranches",
            repositoryId: REPOSITORY_ID,
            left: "feature",
            right: "main",
        });
        expect(executeRepositoryService).toHaveBeenNthCalledWith(2, {
            operation: "writeIgnoreRules",
            repositoryId: REPOSITORY_ID,
            rules: { gitignore: "dist/\n", infoExclude: ".cache/\n" },
        });
        unregisterPlatformHandlers();
    });

    it("[성공] 푸시 및 기록 재작성 미리 보기를 거부하고 결과를 전달함", async () => {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const executeRepositoryService = vi.fn(
            async (
                request: GitRepositoryServiceRequest,
            ): Promise<GitRepositoryServiceResult> => {
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
                    `Unexpected repository service ${request.operation}`,
                );
            },
        );
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: { executeRepositoryService },
            terminalUtility: {},
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };

        await expect(
            handler(TEST_TRPC_PATHS.gitRepositoryService)(event, {
                operation: "pushPreview",
                repositoryId: REPOSITORY_ID,
                remote: "origin",
                remoteRef: "refs/heads/main",
                localRevision: "HEAD",
            }),
        ).resolves.toEqual({ operation: "pushPreview", value: PUSH_PREVIEW });
        await expect(
            handler(TEST_TRPC_PATHS.gitRepositoryService)(event, {
                operation: "historyRewritePreview",
                repositoryId: REPOSITORY_ID,
                fromRevision: "HEAD",
            }),
        ).resolves.toEqual({
            operation: "historyRewritePreview",
            value: HISTORY_REWRITE_PREVIEW,
        });
        expect(executeRepositoryService).toHaveBeenNthCalledWith(1, {
            operation: "pushPreview",
            repositoryId: REPOSITORY_ID,
            remote: "origin",
            remoteRef: "refs/heads/main",
            localRevision: "HEAD",
        });
        expect(executeRepositoryService).toHaveBeenNthCalledWith(2, {
            operation: "historyRewritePreview",
            repositoryId: REPOSITORY_ID,
            fromRevision: "HEAD",
        });
        unregisterPlatformHandlers();
    });

    it("[성공] 파일 읽기를 확인하고 대문자화를 전달함", async () => {
        const send = vi.fn();
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send,
        };
        const readFile = vi.fn(async () => FILE_CONTENT);
        const readFilePreview = vi.fn(async () => FILE_PREVIEW);
        const watchRepository = vi.fn(
            async (
                _repositoryId: string,
                listener: RepositoryChangedListener,
            ): Promise<void> => {
                listener(REPOSITORY_CHANGED);
            },
        );
        const unwatchRepository = vi.fn(async () => undefined);
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: {
                readFile,
                readFilePreview,
                watchRepository,
                unwatchRepository,
            },
            terminalUtility: {},
            stream: { publish: send },
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };

        await expect(
            handler(TEST_TRPC_PATHS.gitReadFile)(event, {
                repositoryId: REPOSITORY_ID,
                source: { kind: "workingTree" },
                path: "tracked.txt",
            }),
        ).resolves.toEqual(FILE_CONTENT);
        await expect(
            handler(TEST_TRPC_PATHS.gitReadFilePreview)(event, {
                repositoryId: REPOSITORY_ID,
                source: { kind: "revision", revision: "HEAD" },
                path: "tracked.bin",
            }),
        ).resolves.toEqual(FILE_PREVIEW);
        await expect(
            handler(TEST_TRPC_PATHS.gitWatchRepository)(event, {
                repositoryId: REPOSITORY_ID,
            }),
        ).resolves.toBeUndefined();
        expect(send).toHaveBeenCalledWith({
            kind: "repository.changed",
            event: REPOSITORY_CHANGED,
        });
        await expect(
            handler(TEST_TRPC_PATHS.gitUnwatchRepository)(event, {
                repositoryId: REPOSITORY_ID,
            }),
        ).resolves.toBeUndefined();
        expect(readFile).toHaveBeenCalledWith(
            REPOSITORY_ID,
            { kind: "workingTree" },
            "tracked.txt",
        );
        expect(readFilePreview).toHaveBeenCalledWith(
            REPOSITORY_ID,
            { kind: "revision", revision: "HEAD" },
            "tracked.bin",
        );
        expect(unwatchRepository).toHaveBeenCalledWith(REPOSITORY_ID);
        unregisterPlatformHandlers();
    });

    it("[성공] 전투기로 전투 중인 전투 작업 트리 파일만 남아 있는 헬리콥터를 표시함", async () => {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const canonicalPath = "/tmp/repository/tracked.txt";
        const resolveWorkingTreeFile = vi.fn(async () => canonicalPath);
        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: {
                openRepository: vi.fn(async () => REPOSITORY),
                resolveWorkingTreeFile,
            },
            terminalUtility: {},
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };

        await handler(TEST_TRPC_PATHS.gitOpenRepository)(event, {
            path: REPOSITORY.path,
        });

        electronMock.openPath.mockResolvedValueOnce("");
        await expect(
            handler(TEST_TRPC_PATHS.gitOpenWorkingTreeFile)(event, {
                repositoryId: REPOSITORY_ID,
                path: "tracked.txt",
            }),
        ).resolves.toBeUndefined();
        expect(resolveWorkingTreeFile).toHaveBeenCalledWith(
            REPOSITORY_ID,
            "tracked.txt",
        );
        expect(electronMock.openPath).toHaveBeenCalledWith(canonicalPath);

        await expect(
            handler(TEST_TRPC_PATHS.gitOpenWorkingTreeFile)(event, {
                repositoryId: REPOSITORY_ID,
                path: "../outside.txt",
            }),
        ).rejects.toThrow();
        expect(resolveWorkingTreeFile).toHaveBeenCalledTimes(1);

        electronMock.openPath.mockResolvedValueOnce("No application available");
        await expect(
            handler(TEST_TRPC_PATHS.gitOpenWorkingTreeFile)(event, {
                repositoryId: REPOSITORY_ID,
                path: "tracked.txt",
            }),
        ).rejects.toThrow(
            "Could not open working-tree file: No application available",
        );
        unregisterPlatformHandlers();
    });

    it("[성공] 참가자들만 터미널 cwd를 확인하고 검증된 PTY 이벤트를 전달했습니다", async () => {
        const send = vi.fn();
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send,
        };
        const window = { isDestroyed: () => false, webContents };
        const terminalEvent: TerminalEventEnvelope = {
            kind: "output",
            requestId: REQUEST_ID,
            terminalId: "f6478d5c-5aa0-4d4a-b646-cb950b0ca555",
            sequence: 0,
            data: [36, 32],
        };
        const terminalUtility = {
            create: vi.fn(
                async (
                    _request: unknown,
                    listener: (event: TerminalEventEnvelope) => void,
                ) => {
                    listener(terminalEvent);
                    return {
                        requestId: REQUEST_ID,
                        terminalId: "f6478d5c-5aa0-4d4a-b646-cb950b0ca555",
                    };
                },
            ),
            write: vi.fn(async () => undefined),
            resize: vi.fn(async () => undefined),
            close: vi.fn(async () => undefined),
            closeRepository: vi.fn(async () => 1),
        };
        const gitUtility = {
            openRepository: vi.fn(async () => REPOSITORY),
            closeRepository: vi.fn(async () => true),
            executeQuery: vi.fn(),
            cancelQuery: vi.fn(),
        };
        registerPlatformHandlers({
            window,
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility,
            terminalUtility,
            stream: { publish: send },
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };
        const createRequest = {
            requestId: REQUEST_ID,
            repositoryId: REPOSITORY_ID,
            cols: 100,
            rows: 28,
        };

        await expect(
            handler(TEST_TRPC_PATHS.terminalCreate)(event, {
                ...createRequest,
                cwd: "/tmp/attacker-controlled",
            }),
        ).rejects.toThrow(/unrecognized_keys/u);

        await expect(
            handler(TEST_TRPC_PATHS.terminalCreate)(event, createRequest),
        ).rejects.toThrow("Repository is not open for terminal access");
        await expect(
            handler(TEST_TRPC_PATHS.gitOpenRepository)(event, {
                path: "/tmp/repository",
            }),
        ).resolves.toEqual(REPOSITORY);
        await expect(
            handler(TEST_TRPC_PATHS.terminalCreate)(event, createRequest),
        ).resolves.toEqual({
            requestId: REQUEST_ID,
            terminalId: "f6478d5c-5aa0-4d4a-b646-cb950b0ca555",
        });
        expect(terminalUtility.create).toHaveBeenCalledWith(
            {
                requestId: REQUEST_ID,
                repositoryId: REPOSITORY_ID,
                cwd: REPOSITORY.path,
                cols: 100,
                rows: 28,
                target: { kind: "default" },
            },
            expect.any(Function),
        );
        expect(send).toHaveBeenCalledWith({
            kind: "terminal.event",
            event: terminalEvent,
        });

        await expect(
            handler(TEST_TRPC_PATHS.gitCloseRepository)(event, {
                repositoryId: REPOSITORY_ID,
            }),
        ).resolves.toBe(true);
        expect(terminalUtility.closeRepository).toHaveBeenCalledWith({
            repositoryId: REPOSITORY_ID,
        });
        unregisterPlatformHandlers();
    });

    it("[실패] 연결 해제 시 스트림 소유 Git 작업, 감시자 및 터미널을 취소함", async () => {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const disconnectListeners = new Set<() => void>();
        const stream = {
            publish: vi.fn(),
            onDisconnect(listener: () => void): () => void {
                disconnectListeners.add(listener);
                return () => disconnectListeners.delete(listener);
            },
        };
        let completeQuery: ((terminal: GitTerminalEvent) => void) | undefined;
        const executeQuery = vi.fn(
            () =>
                new Promise<GitTerminalEvent>((resolve) => {
                    completeQuery = resolve;
                }),
        );
        const cancelQuery = vi.fn(async () => true);
        const watchRepository = vi.fn(async () => undefined);
        const unwatchRepository = vi.fn(async () => undefined);
        const closeTerminal = vi.fn(async () => undefined);
        const terminalId = "f6478d5c-5aa0-4d4a-b646-cb950b0ca555";

        registerPlatformHandlers({
            window: { isDestroyed: () => false, webContents },
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: {
                openRepository: vi.fn(async () => REPOSITORY),
                executeQuery,
                cancelQuery,
                watchRepository,
                unwatchRepository,
            },
            terminalUtility: {
                create: vi.fn(async (request: { requestId: string }) => ({
                    requestId: request.requestId,
                    terminalId,
                })),
                close: closeTerminal,
            },
            stream,
            runtime: {
                kind: "electron",
                appVersion: "0.1.0",
                electronVersion: "43.3.0",
                platform: "darwin",
                architecture: "arm64",
                qaFixture: false,
            },
        } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
        const event = { sender: webContents, senderFrame: mainFrame };
        await handler(TEST_TRPC_PATHS.gitOpenRepository)(event, {
            path: REPOSITORY.path,
        });
        await handler(TEST_TRPC_PATHS.gitWatchRepository)(event, {
            repositoryId: REPOSITORY_ID,
        });
        await handler(TEST_TRPC_PATHS.terminalCreate)(event, {
            requestId: REQUEST_ID,
            repositoryId: REPOSITORY_ID,
            cols: 100,
            rows: 28,
        });
        const query = Promise.resolve(
            handler(TEST_TRPC_PATHS.gitQuery)(event, {
                kind: "status",
                requestId: REQUEST_ID,
                repositoryId: REPOSITORY_ID,
            }),
        );
        await vi.waitFor(() => expect(executeQuery).toHaveBeenCalledOnce());

        for (const disconnect of disconnectListeners) disconnect();
        await vi.waitFor(() =>
            expect(cancelQuery).toHaveBeenCalledWith(REQUEST_ID),
        );
        expect(unwatchRepository).toHaveBeenCalledWith(REPOSITORY_ID);
        expect(closeTerminal).toHaveBeenCalledWith({ terminalId });

        completeQuery?.({
            kind: "cancelled",
            requestId: REQUEST_ID,
            reason: "requested",
            durationMs: 1,
        });
        await expect(query).resolves.toMatchObject({ kind: "cancelled" });
        expect(stream.publish).not.toHaveBeenCalledWith(
            expect.objectContaining({ kind: "git.barrier" }),
        );
        unregisterPlatformHandlers();
    });
});
