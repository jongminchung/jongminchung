import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    DESKTOP_TRPC_CHANNELS,
    DESKTOP_TRPC_PROTOCOL_VERSION,
    DesktopTrpcResponseSchema,
} from "../../src/shared/contracts/desktop-trpc-wire";
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

describe("IPC 핸들러를 거부하는 플랫폼", () => {
    const account = Object.freeze({
        id: "account-1",
        provider: "gitHub" as const,
        baseUrl: "https://github.com",
        login: "octocat",
    });

    beforeEach(() => electronMock.handlers.clear());

    function setup() {
        const mainFrame = { url: "app://git-client/" };
        const webContents = {
            isDestroyed: () => false,
            mainFrame,
            ipc: webContentsIpc,
            send: vi.fn(),
        };
        const window = { isDestroyed: () => false, webContents };
        const hosting = {
            saveAccount: vi.fn(async () => account),
            restoreAccounts: vi.fn(),
            deleteAccount: vi.fn(async () => undefined),
            execute: vi.fn(async () => ({
                kind: "completed" as const,
                message: "done",
            })),
        };
        registerPlatformHandlers({
            window,
            settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
            menu: { sync: vi.fn() },
            gitUtility: {},
            terminalUtility: {},
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
        return {
            event: { sender: webContents, senderFrame: mainFrame },
            hosting,
            webContents,
        };
    }

    it("[성공] 모든 제외 채널을 입력하고 등록 취소함", async () => {
        const { event, hosting } = setup();
        const token = "ghp_super-secret-token";

        const saved = await handler(TEST_TRPC_PATHS.hostingSaveAccount)(event, {
            provider: "gitHub",
            baseUrl: "https://github.com/",
            token,
        });
        await expect(
            handler(TEST_TRPC_PATHS.hostingRestoreAccounts)(event, {
                accounts: [account],
            }),
        ).resolves.toBeUndefined();
        await expect(
            handler(TEST_TRPC_PATHS.hostingDeleteAccount)(event, {
                accountId: account.id,
            }),
        ).resolves.toBeUndefined();
        await expect(
            handler(TEST_TRPC_PATHS.hostingExecute)(event, {
                accountId: account.id,
                request: {
                    kind: "comment",
                    project: "owner/repo",
                    number: 7,
                    body: "Looks good",
                },
            }),
        ).resolves.toEqual({ kind: "completed", message: "done" });

        expect(saved).toEqual(account);
        expect(JSON.stringify(saved)).not.toContain(token);
        expect(hosting.saveAccount).toHaveBeenCalledWith(
            "gitHub",
            "https://github.com",
            token,
        );
        expect(hosting.restoreAccounts).toHaveBeenCalledWith([account]);
        expect(hosting.deleteAccount).toHaveBeenCalledWith(account.id);

        unregisterPlatformHandlers();
        for (const path of [
            TEST_TRPC_PATHS.hostingSaveAccount,
            TEST_TRPC_PATHS.hostingRestoreAccounts,
            TEST_TRPC_PATHS.hostingDeleteAccount,
            TEST_TRPC_PATHS.hostingExecute,
        ]) {
            expect(
                electronMock.handlers.has(
                    DESKTOP_TRPC_CHANNELS[testTrpcDomain(path)],
                ),
            ).toBe(false);
        }
    });

    it("[실패]하기 전에는 수 없는 전투원을 가지고 있었습니다", async () => {
        const { event, hosting } = setup();
        const untrusted = { ...event, sender: {} };

        await expect(
            handler(TEST_TRPC_PATHS.hostingDeleteAccount)(untrusted, {
                accountId: account.id,
            }),
        ).rejects.toThrow("IPC sender is not the main window");
        expect(hosting.deleteAccount).not.toHaveBeenCalled();
        unregisterPlatformHandlers();
    });

    it("[실패] 자격 증명을 수정하고 요청과 일치하지 않는 응답 종류를 가지고 있음", async () => {
        const { event, hosting } = setup();
        const token = "ghp_super-secret-token";
        hosting.saveAccount.mockRejectedValueOnce(
            new Error(`Authorization: Bearer ${token}; token=${token}`),
        );

        let saveError: unknown;
        try {
            await handler(TEST_TRPC_PATHS.hostingSaveAccount)(event, {
                provider: "gitHub",
                baseUrl: "https://github.com",
                token,
            });
        } catch (error) {
            saveError = error;
        }
        expect(String(saveError)).toContain("[redacted]");
        expect(String(saveError)).not.toContain(token);

        hosting.execute.mockResolvedValueOnce({
            kind: "completed",
            message: "wrong kind",
        });
        await expect(
            handler(TEST_TRPC_PATHS.hostingExecute)(event, {
                accountId: account.id,
                request: { kind: "files", project: "owner/repo", number: 7 },
            }),
        ).rejects.toThrow("Hosting response did not match its request");
        unregisterPlatformHandlers();
    });
});
