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

describe("힘내 운영", () => {
  it("[성공] 벽돌적인 것으로 모든 작업 종류를 다뤄", () => {
    expect(Object.keys(gitOperationPolicies).sort()).toEqual(
      [...operationKinds].sort(),
    );
  });

  it("[성공] 효과, 숨김, 관리, 밀어넣기 및 기본 기능화를 유지함", () => {
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

  it("[성공] 복구 기록 및 재시도 동작을 중앙 집중화함", () => {
    expect(gitOperationPolicies.commit.recordsRecovery).toBe(true);
    expect(gitOperationPolicies.stashPush.recordsRecovery).toBe(true);
    expect(gitOperationPolicies.checkout.recordsRecovery).toBe(false);
    expect(
      operationKinds.filter((kind) => gitOperationPolicies[kind].retryable),
    ).toEqual(["fetch"]);
  });
});
