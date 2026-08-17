import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopApi } from "../shared/contracts/desktop-api";

const platformMock = vi.hoisted(() => ({
    electronApi: vi.fn(),
}));

vi.mock("../platform/electron", () => platformMock);

import {
    loadHostingAccounts,
    loadViewedFiles,
    openHostingUrl,
    persistHostingAccounts,
    persistViewedFiles,
    viewedFilesKey,
} from "./hosting-persistence";

const ACCOUNT = Object.freeze({
    id: "account-1",
    provider: "gitHub" as const,
    baseUrl: "https://github.com",
    login: "octocat",
});

function electronApi(
    get: ReturnType<typeof vi.fn>,
    set: ReturnType<typeof vi.fn>,
    openExternal: ReturnType<typeof vi.fn>,
): DesktopApi {
    return {
        settings: { get, set, delete: vi.fn() },
        shell: { openExternal },
    } as unknown as DesktopApi;
}

describe("HostingPanel을 실제로 사용하는 방법", () => {
    beforeEach(() => {
        platformMock.electronApi.mockReset();
    });

    it("[성공] 전자 설정을 사용하고 로그에 기록을 남기며 유지하지 마십시오", async () => {
        const get = vi.fn(async (key: string): Promise<unknown> => {
            if (key === "hostingAccounts") {
                return [
                    ACCOUNT,
                    { ...ACCOUNT, provider: "unknown" },
                    "not-an-account",
                ];
            }
            return ["z.ts", 42, "a.ts"];
        });
        const set = vi.fn(async () => undefined);
        const openExternal = vi.fn(async () => undefined);
        platformMock.electronApi.mockReturnValue(
            electronApi(get, set, openExternal),
        );

        await expect(loadHostingAccounts()).resolves.toEqual([ACCOUNT]);
        await persistHostingAccounts([ACCOUNT]);
        await expect(
            loadViewedFiles("account-1", "owner/repo", 7),
        ).resolves.toEqual(new Set(["z.ts", "a.ts"]));
        await persistViewedFiles(
            "account-1",
            "owner/repo",
            7,
            new Set(["z.ts", "a.ts"]),
        );
        await openHostingUrl("https://github.com/owner/repo/pull/7");

        expect(set).toHaveBeenNthCalledWith(1, "hostingAccounts", [ACCOUNT]);
        expect(JSON.stringify(set.mock.calls)).not.toContain("token");
        expect(set).toHaveBeenNthCalledWith(
            2,
            viewedFilesKey("account-1", "owner/repo", 7),
            ["a.ts", "z.ts"],
        );
        expect(openExternal).toHaveBeenCalledWith(
            "https://github.com/owner/repo/pull/7",
        );
    });

    it("[실패] 전자 설정 경계가 사라지지 않음", async () => {
        platformMock.electronApi.mockReturnValue(null);

        await expect(loadHostingAccounts()).rejects.toThrow(
            "Electron settings are unavailable",
        );
    });
});
