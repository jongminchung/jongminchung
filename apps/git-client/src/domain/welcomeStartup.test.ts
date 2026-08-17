import { describe, expect, it, vi } from "vitest";
import {
    loadWorkspaceStartupState,
    recentProjectsWithRestoreFailures,
} from "./welcomeStartup";

describe("작업공간 시작", () => {
    it("[성공] 휴일이 열리는 날과 활동적인 노선을 로드함", async () => {
        const settings = new Map<string, unknown>([
            ["openRepositoryPaths", ["/work/one", "/work/two", "/work/one", 3]],
            ["activeRepositoryPath", "/work/two"],
            ["safeRepositoryPaths", ["/work/one"]],
            ["recentRepositories", ["/work/recent"]],
        ]);
        const readSetting = vi.fn(
            async (key: string): Promise<unknown> => settings.get(key),
        );

        await expect(loadWorkspaceStartupState(readSetting)).resolves.toEqual({
            activeRepositoryPath: "/work/two",
            openRepositoryPaths: ["/work/one", "/work/two"],
            safeRepositoryPaths: ["/work/one"],
            recentProjects: [
                {
                    path: "/work/recent",
                    name: "recent",
                    branch: null,
                    lastOpenedAt: 1,
                },
            ],
        });
        expect(readSetting.mock.calls.map(([key]) => key)).toEqual([
            "openRepositoryPaths",
            "activeRepositoryPath",
            "safeRepositoryPaths",
            "recentProjects",
            "recentRepositories",
        ]);
    });

    it("[성공] 레거시 목록보다 메타데이터가 풍부한 최신 프로젝트를 선호함", async () => {
        const readSetting = async (key: string): Promise<unknown> => {
            if (key === "recentProjects") {
                return [
                    {
                        path: "/work/current",
                        name: "Current",
                        branch: "main",
                        lastOpenedAt: 42,
                    },
                ];
            }
            if (key === "recentRepositories") return ["/work/legacy"];
            return null;
        };

        const startup = await loadWorkspaceStartupState(readSetting);

        expect(startup.activeRepositoryPath).toBeNull();
        expect(startup.openRepositoryPaths).toEqual([]);
        expect(startup.safeRepositoryPaths).toEqual([]);
        expect(startup.recentProjects).toEqual([
            {
                path: "/work/current",
                name: "Current",
                branch: "main",
                lastOpenedAt: 42,
            },
        ]);
    });

    it("[실패] 스토리지 경계에서 유효하지 않은 위치에 있음", async () => {
        const startup = await loadWorkspaceStartupState(async (key) => {
            if (key === "openRepositoryPaths") return ["", null, "/work/valid"];
            if (key === "activeRepositoryPath") return 42;
            return null;
        });

        expect(startup).toEqual({
            activeRepositoryPath: null,
            openRepositoryPaths: ["/work/valid"],
            safeRepositoryPaths: [],
            recentProjects: [],
        });
    });

    it("[성공] 유죄화된 처벌 모드", async () => {
        const startup = await loadWorkspaceStartupState(async (key) => {
            if (key === "openRepositoryPaths")
                return ["/work/safe", "/work/trusted"];
            if (key === "safeRepositoryPaths")
                return ["/work/safe", "", 42, "/work/safe"];
            return null;
        });

        expect(startup.safeRepositoryPaths).toEqual(["/work/safe"]);
    });

    it("[성공] 재시도 또는 제거를 위해 오류 복구를 유지함", () => {
        expect(
            recentProjectsWithRestoreFailures(
                [
                    {
                        path: "/work/existing",
                        name: "Existing",
                        branch: "main",
                        lastOpenedAt: 10,
                    },
                ],
                ["/missing/one", "/missing/two"],
                100,
            ),
        ).toEqual([
            {
                path: "/missing/one",
                name: "one",
                branch: null,
                lastOpenedAt: 100,
            },
            {
                path: "/missing/two",
                name: "two",
                branch: null,
                lastOpenedAt: 99,
            },
            {
                path: "/work/existing",
                name: "Existing",
                branch: "main",
                lastOpenedAt: 10,
            },
        ]);
    });
});
