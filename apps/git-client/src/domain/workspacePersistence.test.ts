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

describe("workspace persistence", () => {
    it("migrates missing preferences without trusting stored values", () => {
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

    it("preserves validated hosting metadata without storing secrets", () => {
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

    it("migrates schema v2 state to the current schema without losing workspace preferences", () => {
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

    it("migrates repository panel state with safe height defaults and bounds", () => {
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

    it("migrates schema v3 review state and validates drafts and pane widths", () => {
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
        ).toBe(210);
    });

    it("preserves repository and failed-path tab order", () => {
        expect(workspacePaths(sessions)).toEqual([
            "/work/a",
            "/missing",
            "/work/b",
        ]);
    });

    it("restores the active repository and falls back to the first valid repository", () => {
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

    it("selects the adjacent session when the active repository closes", () => {
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
