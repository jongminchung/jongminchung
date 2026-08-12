import { describe, expect, it } from "vitest";
import {
    assertGitRequestAllowed,
    RepositoryAccessPolicy,
    restoreRepositoryAccess,
    SafeModeViolationError,
} from "./repositoryAccess";

describe("RepositoryAccessPolicy", () => {
    it("allows repository queries while blocking every executable capability in safe mode", () => {
        const policy = RepositoryAccessPolicy.create();
        policy.open("repository-a", "/tmp/project-a", "safe");
        policy.activate("repository-a");

        expect(policy.allows("repository-a", "query")).toBe(true);
        expect(policy.allows("repository-a", "gitMutation")).toBe(false);
        expect(policy.allows("repository-a", "terminal")).toBe(false);
        expect(policy.allows("repository-a", "hosting")).toBe(false);
        expect(policy.allows("repository-a", "externalExecution")).toBe(false);
        expect(() => policy.assertActive("gitMutation")).toThrow(
            SafeModeViolationError,
        );
    });

    it("keeps trusted and unregistered repositories fully enabled", () => {
        const policy = RepositoryAccessPolicy.create();
        policy.open("repository-a", "/tmp/project-a", "trusted");

        expect(policy.allows("repository-a", "gitMutation")).toBe(true);
        expect(policy.allows("repository-b", "terminal")).toBe(true);
    });

    it("allows Git queries and rejects operation requests before they reach the bridge", () => {
        const policy = RepositoryAccessPolicy.create();
        policy.open("repository-a", "/tmp/project-a", "safe");

        expect(() =>
            assertGitRequestAllowed(policy, {
                kind: "status",
                repositoryId: "repository-a",
            }),
        ).not.toThrow();
        expect(() =>
            assertGitRequestAllowed(policy, {
                kind: "operation",
                repositoryId: "repository-a",
                operation: { kind: "stageAll" },
            }),
        ).toThrow(SafeModeViolationError);
    });

    it("remembers safe paths without leaking repository identity across sessions", () => {
        const policy = RepositoryAccessPolicy.create();
        policy.open("repository-a", "/tmp/project-a", "safe");
        policy.forget("repository-a");

        expect(policy.modeForPath("/tmp/project-a")).toBe("safe");
        policy.open(
            "repository-b",
            "/tmp/project-a",
            policy.modeForPath("/tmp/project-a"),
        );
        expect(policy.allows("repository-b", "gitMutation")).toBe(false);

        policy.open("repository-b", "/tmp/project-a", "trusted");
        expect(policy.modeForPath("/tmp/project-a")).toBe("trusted");
    });

    it("restores safe mode after restart when Electron settings contain the path", () => {
        const restartedPolicy = RepositoryAccessPolicy.create();

        restoreRepositoryAccess(
            restartedPolicy,
            [
                { id: "new-safe-id", path: "/tmp/project-a" },
                { id: "new-trusted-id", path: "/tmp/project-b" },
            ],
            ["/tmp/project-a", "/tmp/recent-only"],
        );

        expect(restartedPolicy.mode("new-safe-id")).toBe("safe");
        expect(restartedPolicy.mode("new-trusted-id")).toBe("trusted");
        expect(restartedPolicy.modeForPath("/tmp/recent-only")).toBe("safe");
    });

    it("retains a closed Safe Mode repository while it remains recent", () => {
        const policy = RepositoryAccessPolicy.create();
        policy.open("repository-a", "/tmp/project-a", "safe");
        policy.forget("repository-a");

        expect(policy.safePaths(["/tmp/project-a", "/tmp/project-b"])).toEqual([
            "/tmp/project-a",
        ]);
    });

    it("forgets Safe Mode only when Recent is removed or the path is explicitly trusted", () => {
        const policy = RepositoryAccessPolicy.create();
        policy.remember("/tmp/project-a", "safe");
        policy.forgetPath("/tmp/project-a");
        expect(policy.modeForPath("/tmp/project-a")).toBe("trusted");

        policy.remember("/tmp/project-a", "safe");
        policy.remember("/tmp/project-a", "trusted");
        expect(policy.modeForPath("/tmp/project-a")).toBe("trusted");
    });

    it("keeps an open Safe Mode repository persisted when its Recent entry is removed", () => {
        const policy = RepositoryAccessPolicy.create();
        policy.open("repository-a", "/tmp/project-a", "safe");
        policy.forgetPath("/tmp/project-a");

        expect(policy.safePaths(["/tmp/project-a"])).toEqual([
            "/tmp/project-a",
        ]);
        policy.forget("repository-a");
        expect(policy.safePaths(["/tmp/project-a"])).toEqual([]);
    });
});
