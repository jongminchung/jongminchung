import { describe, expect, it, vi } from "vitest";
import type { GitBridge } from "../ports/GitBridge";
import type { WorkspaceState } from "./GitSessionState";
import type { GitSessionRefreshCoordinator } from "./GitSessionStore";
import { createGitSessionStore } from "./GitSessionStore";

const INITIAL_WORKSPACE: WorkspaceState = {
  sessions: [],
  activeTab: { kind: "welcome" },
  recentProjects: [],
  restoring: false,
  error: null,
};

function fakeCoordinator(): GitSessionRefreshCoordinator {
  return {
    invalidate: vi.fn(),
    defer: vi.fn(),
    resume: vi.fn(async () => false),
    flush: vi.fn(async () => undefined),
    forget: vi.fn(),
  };
}

describe("GitSessionStore", () => {
  it("[성공] 다리/코디네이터 활력성을 완화하고 임시 보호를 위해", () => {
    const bridge = {} as GitBridge;
    const refreshCoordinator = fakeCoordinator();
    const store = createGitSessionStore({
      bridge,
      refreshCoordinator,
      initialWorkspace: INITIAL_WORKSPACE,
    });

    store.getState().beginMutation("operation-1");
    store
      .getState()
      .setWorkspace((workspace) => ({ ...workspace, error: "failed" }));
    store.getState().setConsoleEntries([
      {
        repositoryId: "repository-1",
        requestId: "request-1",
        command: "git status",
        startedAt: 1,
        completedAt: null,
        output: "",
        status: "running",
      },
    ]);

    store.getState().resetSession();

    expect(store.getState().bridge).toBe(bridge);
    expect(store.getState().refreshCoordinator).toBe(refreshCoordinator);
    expect(store.getState().workspace).toBe(INITIAL_WORKSPACE);
    expect(store.getState().pendingMutationIds.size).toBe(0);
    expect(store.getState().consoleEntries).toEqual([]);
  });

  it("[성공] 벽돌같은 성공, 실패하거나 취소된 상태에서 변형된 상태를 유지함", () => {
    const store = createGitSessionStore({
      bridge: {} as GitBridge,
      initialWorkspace: INITIAL_WORKSPACE,
    });

    for (const id of ["success", "failure", "cancelled"])
      store.getState().beginMutation(id);
    for (const id of ["success", "failure", "cancelled"])
      store.getState().finishMutation(id);

    expect(store.getState().pendingMutationIds.size).toBe(0);
  });
});
