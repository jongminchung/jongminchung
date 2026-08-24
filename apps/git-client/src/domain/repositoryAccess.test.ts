import { describe, expect, it } from "vitest";
import {
  assertGitRequestAllowed,
  RepositoryAccessPolicy,
  restoreRepositoryAccess,
  SafeModeViolationError,
} from "./repositoryAccess";

describe("라우터액세스 정책", () => {
  it("[성공] 안전 모드에서는 모든 실행 가능 여부를 감시하는 동안 쿼리를 허용함", () => {
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

  it("[성공]할 수 있고 등록되지 않은 조치를 완료한 상태로 유지함", () => {
    const policy = RepositoryAccessPolicy.create();
    policy.open("repository-a", "/tmp/project-a", "trusted");

    expect(policy.allows("repository-a", "gitMutation")).toBe(true);
    expect(policy.allows("repository-b", "terminal")).toBe(true);
  });

  it("[성공] 활성 repository가 사라지면 기본 trusted 상태로 돌아감", () => {
    const policy = RepositoryAccessPolicy.create();

    expect(policy.activeMode()).toBe("trusted");
    policy.open("repository-a", "/tmp/project-a", "safe");
    policy.activate("repository-a");
    expect(policy.activeMode()).toBe("safe");

    policy.forget("repository-a");
    expect(policy.activeMode()).toBe("trusted");
    expect(() => policy.assertActive("gitMutation")).not.toThrow();
  });

  it("[실패] Git 쿼리를 허용하고 작업을 요청하기 위해 응답했습니다", () => {
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

  it("[실패] 세션에 구부러진 ID를 유지하지 않고 안전하게 저장함", () => {
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

  it("[성공] 전자 설정에 정상적으로 포함된 경우 다시 도움말 후 안전 모드를 복원함", () => {
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

  it("[성공] 최신 상태로 유지되는 동안 안전한 모드를 유지함", () => {
    const policy = RepositoryAccessPolicy.create();
    policy.open("repository-a", "/tmp/project-a", "safe");
    policy.forget("repository-a");

    expect(policy.safePaths(["/tmp/project-a", "/tmp/project-b"])).toEqual([
      "/tmp/project-a",
    ]);
  });

  it("[성공] 이후 항목이 제거되어 경로가 확실하게 신뢰되는 경우에만 안전 모드를 인식하게 됨", () => {
    const policy = RepositoryAccessPolicy.create();
    policy.remember("/tmp/project-a", "safe");
    policy.forgetPath("/tmp/project-a");
    expect(policy.modeForPath("/tmp/project-a")).toBe("trusted");

    policy.remember("/tmp/project-a", "safe");
    policy.remember("/tmp/project-a", "trusted");
    expect(policy.modeForPath("/tmp/project-a")).toBe("trusted");
  });

  it("[성공] 최근 항목이 제거될 때 임시 모드를 유지함", () => {
    const policy = RepositoryAccessPolicy.create();
    policy.open("repository-a", "/tmp/project-a", "safe");
    policy.forgetPath("/tmp/project-a");

    expect(policy.safePaths(["/tmp/project-a"])).toEqual(["/tmp/project-a"]);
    policy.forget("repository-a");
    expect(policy.safePaths(["/tmp/project-a"])).toEqual([]);
  });
});
