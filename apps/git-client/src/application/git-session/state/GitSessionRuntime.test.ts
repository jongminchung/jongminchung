import { describe, expect, it } from "vitest";
import { createGitSessionRuntime } from "./GitSessionRuntime";

describe("GitSession런타임", () => {
    it("[성공] 임시로 요청한 상태를 불확실함", () => {
        const first = createGitSessionRuntime("repository-1");
        const second = createGitSessionRuntime("repository-2");

        first.logGenerations.set("repository-1", 2);
        first.rawRepositoryData.set("repository-1", {
            refs: "refs",
            log: "log",
            status: "status",
            stash: "stash",
        });

        expect(second.logGenerations.size).toBe(0);
        expect(second.rawRepositoryData.size).toBe(0);
    });

    it("[성공] 모든 장소가 인식을 인식함", () => {
        const runtime = createGitSessionRuntime("repository-1");
        runtime.activeSnapshot = {
            id: "repository-1",
            path: "/repository-1",
            name: "repository-1",
            gitDirectory: "/repository-1/.git",
            commonDirectory: "/repository-1/.git",
            currentBranch: "main",
            headOid: "abc",
            upstream: null,
            remoteUrl: null,
            ahead: 0,
            behind: 0,
            isBare: false,
            isShallow: false,
            isDetached: false,
            hasCommits: true,
            operation: null,
            gitVersion: { major: 2, minor: 51, patch: 0, display: "2.51.0" },
        };
        runtime.logGenerations.set("repository-1", 3);
        runtime.activeLogRequests.set("repository-1", "request-1");
        runtime.logCommitCounts.set("repository-1", 5);

        runtime.forgetRepository("repository-1");

        expect(runtime.activeRepositoryId).toBeNull();
        expect(runtime.activeSnapshot).toBeNull();
        expect(runtime.logGenerations.has("repository-1")).toBe(false);
        expect(runtime.activeLogRequests.has("repository-1")).toBe(false);
        expect(runtime.logCommitCounts.has("repository-1")).toBe(false);
    });
});
