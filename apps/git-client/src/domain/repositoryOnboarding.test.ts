import { describe, expect, it } from "vitest";
import { deriveRepositoryOnboardingTasks } from "./repositoryOnboarding";
import type { RepositoryView } from "./types";

function repository(
    overrides: Partial<RepositoryView["snapshot"]> = {},
    changes: RepositoryView["status"]["changes"] = [],
): RepositoryView {
    return {
        snapshot: {
            id: "repo-1",
            name: "example",
            path: "/tmp/example",
            gitDirectory: "/tmp/example/.git",
            commonDirectory: "/tmp/example/.git",
            currentBranch: "main",
            headOid: "abc",
            upstream: "origin/main",
            remoteUrl: "https://github.com/acme/example.git",
            ahead: 0,
            behind: 0,
            isBare: false,
            isShallow: false,
            isDetached: false,
            hasCommits: true,
            operation: null,
            gitVersion: { major: 2, minor: 50, patch: 0, display: "2.50.0" },
            ...overrides,
        },
        refs: [],
        commits: [],
        status: {
            branch: "main",
            upstream: overrides.upstream ?? "origin/main",
            ahead: overrides.ahead ?? 0,
            behind: 0,
            stashCount: 0,
            changes,
        },
    };
}

describe("repository onboarding predicates", () => {
    it("[성공] local-only와 unpublished branch의 다음 command를 계산함", () => {
        const tasks = deriveRepositoryOnboardingTasks({
            hostingAccountConnected: false,
            online: true,
            remotes: [],
            repository: repository({
                remoteUrl: null,
                upstream: null,
                ahead: 2,
            }),
            safeMode: false,
        });
        expect(
            tasks.find((task) => task.id === "configure-remote"),
        ).toMatchObject({
            commandId: "repository.manageRemotes",
            complete: false,
        });
        expect(
            tasks.find((task) => task.id === "configure-upstream")
                ?.disabledReason,
        ).toContain("Configure a remote");
        expect(
            tasks.find((task) => task.id === "publish-commits"),
        ).toMatchObject({
            commandId: "repository.push",
            complete: false,
        });
        expect(
            tasks.find((task) => task.id === "connect-hosting"),
        ).toMatchObject({
            commandId: "repository.manageAccounts",
            complete: false,
        });
    });

    it("[성공] safe mode, offline, detached HEAD와 conflict 사유를 구분함", () => {
        const conflict = {
            path: "src/a.ts",
            status: "conflicted" as const,
            staged: false,
            worktree: true,
        };
        const tasks = deriveRepositoryOnboardingTasks({
            hostingAccountConnected: false,
            online: false,
            remotes: [{}],
            repository: repository(
                {
                    currentBranch: null,
                    isDetached: true,
                    upstream: null,
                    operation: "merge",
                },
                [conflict],
            ),
            safeMode: true,
        });
        expect(tasks.map((task) => task.id).slice(0, 2)).toEqual([
            "resolve-conflicts",
            "choose-branch",
        ]);
        expect(tasks[0]?.disabledReason).toContain("Trust this repository");

        const offline = deriveRepositoryOnboardingTasks({
            hostingAccountConnected: true,
            online: false,
            remotes: [{}],
            repository: repository({ ahead: 1 }),
            safeMode: false,
        });
        expect(
            offline.find((task) => task.id === "publish-commits")
                ?.disabledReason,
        ).toContain("Reconnect");
        expect(
            offline.find((task) => task.id === "connect-hosting")?.complete,
        ).toBe(true);
    });
});
