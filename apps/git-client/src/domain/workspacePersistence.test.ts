import { describe, expect, it } from "vitest";
import {
    DEFAULT_WORKSPACE_PREFERENCES,
    MAX_BOTTOM_PANEL_HEIGHT,
    migrateRepositoryUiState,
    migrateWorkspacePreferences,
    restoredWorkspaceTab,
    workspaceTabAfterClose,
    workspacePaths,
} from "./workspacePersistence";

const sessions = [
    {
        kind: "repository" as const,
        repository: { snapshot: { id: "repo-a", path: "/work/a" } },
    },
    { kind: "error" as const, id: "error:/missing", path: "/missing" },
    {
        kind: "repository" as const,
        repository: { snapshot: { id: "repo-b", path: "/work/b" } },
    },
];

describe("작업과정을 거치는 과정", () => {
    it("[실패] 커밋을 선택하지 않고 프로젝트 기록에서 새로운 내용을 다루다", () => {
        expect(migrateRepositoryUiState(null)).toMatchObject({
            activeView: "history",
            selectedOids: [],
            selectedRef: null,
            projectOpen: true,
            bookmarksOpen: false,
            logOpen: true,
        });
    });

    it("[성공] 유일하게 수용되는 셸 상태를 유지함", () => {
        expect(
            migrateRepositoryUiState({
                activeView: "changes",
                selectedOids: ["abc123"],
                selectedRef: "refs/heads/topic",
                projectOpen: false,
                bookmarksOpen: true,
                logOpen: false,
            }),
        ).toMatchObject({
            activeView: "changes",
            selectedOids: ["abc123"],
            selectedRef: "refs/heads/topic",
            projectOpen: false,
            bookmarksOpen: true,
            logOpen: false,
        });
    });

    it("[실패] 값을 신뢰하지 않고 반환된 기본 설정을 마이그레이션함", () => {
        expect(migrateWorkspacePreferences(null)).toEqual(
            DEFAULT_WORKSPACE_PREFERENCES,
        );
        expect(
            migrateWorkspacePreferences({
                autoFetchMinutes: -1,
                fetchTagMode: "invalid",
                forceWithLease: true,
                recurseSubmodules: false,
            }),
        ).toMatchObject({
            autoFetchMinutes: null,
            fetchTagMode: "auto",
            recurseSubmodules: false,
        });
        expect(
            "forceWithLease" in
                migrateWorkspacePreferences({ forceWithLease: true }),
        ).toBe(false);
    });

    it("[실패] 비밀을 저장하지 않고 인증된 타이머 데이터를 저장하지 않음", () => {
        expect(
            migrateWorkspacePreferences({
                hostingAccounts: [
                    {
                        id: "account-1",
                        provider: "gitHub",
                        baseUrl: "https://github.com",
                        login: "octo",
                    },
                    { id: "bad", provider: "github", baseUrl: 1, login: null },
                ],
            }).hostingAccounts,
        ).toEqual([
            {
                id: "account-1",
                provider: "gitHub",
                baseUrl: "https://github.com",
                login: "octo",
            },
        ]);
    });

    it("[실패] 작업 공간 기본 설정을 실행하고 v2상태를 현재로서는 마이그레이션함", () => {
        expect(
            migrateWorkspacePreferences({
                schemaVersion: 2,
                autoFetchMinutes: 15,
                fetchTagMode: "sync",
                managementSection: "refs",
            }),
        ).toMatchObject({
            schemaVersion: 10,
            autoFetchMinutes: 15,
            fetchTagMode: "sync",
        });
        expect(
            "managementSection" in
                migrateWorkspacePreferences({
                    managementSection: "refs",
                }),
        ).toBe(false);
    });

    it("[성공] 대피 장소와 경계를 사용하여 선반 패널 상태를 마이그레이션함", () => {
        expect(
            migrateRepositoryUiState({
                selectedOids: ["abc", 1],
                selectedRef: "refs/heads/main",
                bottomCollapsed: true,
            }),
        ).toMatchObject({
            selectedOids: ["abc"],
            selectedRef: "refs/heads/main",
            bottomCollapsed: true,
            bottomPanelHeight: 248,
            bottomPanelTab: "shelf",
            activeView: "history",
            selectedChange: null,
            historySelectedPath: null,
            projectOpen: true,
            logOpen: true,
            logTabIds: ["log-1"],
            activeLogTabId: "log-1",
        });
        expect(
            migrateRepositoryUiState({ bottomPanelHeight: 999 })
                .bottomPanelHeight,
        ).toBe(MAX_BOTTOM_PANEL_HEIGHT);
    });

    it("[성공] v3 검토 상태를 마이그레이션하고 초안 및 창의 경량화를 확인함", () => {
        expect(
            migrateRepositoryUiState({
                activeView: "changes",
                selectedChange: { path: "src/app.ts", layer: "worktree" },
                historySelectedPath: "README.md",
                diffPreferences: {
                    viewMode: "unified",
                    contextLines: 10,
                    wordWrap: true,
                },
                commitDraft: { message: "WIP", runHooks: false },
                changesNavigatorWidth: 9999,
            }),
        ).toMatchObject({
            activeView: "changes",
            selectedChange: { path: "src/app.ts", layer: "worktree" },
            historySelectedPath: "README.md",
            diffPreferences: {
                viewMode: "unified",
                contextLines: 10,
                wordWrap: true,
            },
            commitDraft: { message: "WIP", runHooks: false },
            changesNavigatorWidth: 420,
        });
        expect(
            migrateRepositoryUiState({ historyReviewWidth: 760 })
                .historyReviewWidth,
        ).toBe(253);
    });

    it("[성공] 중단 및 중단 시간을 유지함", () => {
        expect(workspacePaths(sessions)).toEqual([
            "/work/a",
            "/missing",
            "/work/b",
        ]);
    });

    it("[성공] 활동적인 바깥쪽을 복구하고 첫 번째 손잡이로 교체함", () => {
        expect(restoredWorkspaceTab(sessions, "/work/b")).toEqual({
            kind: "repository",
            repositoryId: "repo-b",
        });
        expect(restoredWorkspaceTab(sessions, "/missing")).toEqual({
            kind: "error",
            sessionId: "error:/missing",
        });
        expect(restoredWorkspaceTab(sessions, "/unknown")).toEqual({
            kind: "repository",
            repositoryId: "repo-a",
        });
        expect(restoredWorkspaceTab([], "/unknown")).toEqual({
            kind: "welcome",
        });
    });

    it("[성공] 활력있는 에너지를 받을 때 세션을 선택함", () => {
        expect(
            workspaceTabAfterClose(
                sessions,
                { kind: "repository", repositoryId: "repo-a" },
                "repo-a",
            ),
        ).toEqual({ kind: "error", sessionId: "error:/missing" });
        expect(
            workspaceTabAfterClose(
                sessions,
                { kind: "repository", repositoryId: "repo-b" },
                "repo-b",
            ),
        ).toEqual({ kind: "error", sessionId: "error:/missing" });
        expect(
            workspaceTabAfterClose(
                sessions,
                { kind: "repository", repositoryId: "repo-b" },
                "repo-a",
            ),
        ).toEqual({ kind: "repository", repositoryId: "repo-b" });
        expect(
            workspaceTabAfterClose(
                sessions.slice(0, 1),
                { kind: "repository", repositoryId: "repo-a" },
                "repo-a",
            ),
        ).toEqual({ kind: "welcome" });
    });
});
