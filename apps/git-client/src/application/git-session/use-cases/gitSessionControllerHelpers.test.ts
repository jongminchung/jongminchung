import { describe, expect, it, vi } from "vitest";
import { sampleRepository } from "../../../domain/sampleData";
import type { GitBridge } from "../ports/GitBridge";
import type { WorkspaceState } from "../state/GitSessionState";
import {
  cancelRequests,
  createLogRequest,
  DEFAULT_LOG_FILTERS,
  emptyRepository,
  loadingSession,
  sameValue,
  updateRepositorySession,
} from "./gitSessionControllerHelpers";

const snapshot = sampleRepository.snapshot;

function workspace(): WorkspaceState {
  return {
    sessions: [loadingSession(snapshot)],
    activeTab: { kind: "repository", repositoryId: snapshot.id },
    recentProjects: [],
    restoring: false,
    error: null,
  };
}

describe("Git 세션 컨트롤러 패널", () => {
  it("[성공] 비어 있고 로드하는 동안 상태를 생성함", () => {
    expect(emptyRepository(snapshot)).toMatchObject({
      snapshot,
      refs: [],
      commits: [],
      status: {
        ahead: snapshot.ahead,
        behind: snapshot.behind,
        stashCount: 0,
        changes: [],
      },
    });
    expect(loadingSession(snapshot)).toMatchObject({
      kind: "repository",
      status: "loading",
      stale: false,
      error: null,
    });
  });

  it("[성공] 제외 다른 세션만 업데이트함", () => {
    const current = workspace();
    const updated = updateRepositorySession(
      current,
      snapshot.id,
      (session) => ({ ...session, stale: true }),
    );

    expect(updated).not.toBe(current);
    expect(updated.sessions[0]).toMatchObject({ stale: true });
    expect(
      updateRepositorySession(current, "missing", (session) => ({
        ...session,
        stale: true,
      })),
    ).toBe(current);
    expect(
      updateRepositorySession(current, snapshot.id, (session) => session),
    ).toBe(current);
  });

  it("[성공] 로그인 요청을 작성하고 직렬화된 값을 비교함", () => {
    expect(createLogRequest(snapshot.id)).toEqual({
      kind: "log",
      repositoryId: snapshot.id,
      skip: 0,
      limit: 500,
      order: "topology",
      filters: DEFAULT_LOG_FILTERS,
    });
    expect(
      createLogRequest(
        snapshot.id,
        { filters: DEFAULT_LOG_FILTERS, order: "date" },
        25,
      ),
    ).toMatchObject({ order: "date", skip: 25 });
    expect(sameValue({ value: 1 }, { value: 1 })).toBe(true);
    expect(sameValue({ value: 1 }, { value: 2 })).toBe(false);
  });

  it("[성공] 모든 취소를 응답으로 처리", async () => {
    const cancel = vi
      .fn<GitBridge["cancel"]>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("cancel failed"));
    const results = await cancelRequests({ cancel } as unknown as GitBridge, [
      "request-1",
      "request-2",
    ]);

    expect(cancel).toHaveBeenCalledTimes(2);
    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
  });
});
