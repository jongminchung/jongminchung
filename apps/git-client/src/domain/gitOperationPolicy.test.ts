import { describe, expect, it } from "vitest";
import type { GitOperation } from "../shared/contracts/model/index";
import { gitOperationPolicies } from "./gitOperationPolicy";

const operationKinds = [
    "stage",
    "stageAll",
    "stageTracked",
    "addIntent",
    "unstage",
    "removeCached",
    "discard",
    "applyPatch",
    "partialPatch",
    "commit",
    "commitAdvanced",
    "fetch",
    "pull",
    "push",
    "createBranch",
    "renameBranch",
    "deleteBranch",
    "setUpstream",
    "deleteRemoteBranch",
    "checkout",
    "createTag",
    "deleteTag",
    "pushTag",
    "reset",
    "revert",
    "cherryPick",
    "merge",
    "rebase",
    "interactiveRebase",
    "dropCommits",
    "squashCommits",
    "rewordCommit",
    "undoCommit",
    "createFixupCommit",
    "createSquashCommit",
    "continue",
    "skip",
    "abort",
    "stashPush",
    "stashApply",
    "stashDrop",
    "stashClear",
    "stashBranch",
    "unshallow",
    "updateSubmodules",
    "setConfig",
    "worktreeAdd",
    "worktreeRemove",
    "remoteAdd",
    "remoteRemove",
    "remoteSetUrl",
] as const satisfies readonly GitOperation["kind"][];

describe("Git operation policies", () => {
    it("covers every operation kind with an explicit policy", () => {
        expect(Object.keys(gitOperationPolicies).sort()).toEqual(
            [...operationKinds].sort(),
        );
    });

    it("keeps index, stash, management, push, and default invalidations distinct", () => {
        expect(gitOperationPolicies.stage.invalidations).toEqual(["status"]);
        expect(gitOperationPolicies.stashApply.invalidations).toEqual([
            "status",
            "history",
            "stash",
        ]);
        expect(gitOperationPolicies.remoteAdd.invalidations).toEqual([
            "status",
            "history",
            "management",
        ]);
        expect(gitOperationPolicies.push.invalidations).toEqual([
            "status",
            "history",
        ]);
        expect(gitOperationPolicies.checkout.invalidations).toEqual([
            "status",
            "history",
            "operation",
        ]);
    });

    it("centralizes recovery recording and retry behavior", () => {
        expect(gitOperationPolicies.commit.recordsRecovery).toBe(true);
        expect(gitOperationPolicies.stashPush.recordsRecovery).toBe(true);
        expect(gitOperationPolicies.checkout.recordsRecovery).toBe(false);
        expect(
            operationKinds.filter(
                (kind) => gitOperationPolicies[kind].retryable,
            ),
        ).toEqual(["fetch"]);
    });
});
