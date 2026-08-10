import { describe, expect, it, vi } from "vitest";
import type { GitBridge } from "../bridge/GitBridge";
import type { GitSessionRefreshCoordinator } from "./gitSessionStore";
import { createGitSessionStore } from "./gitSessionStore";
import type { WorkspaceState } from "./sessionTypes";

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
  it("injects bridge/coordinator dependencies and resets transient slices", () => {
    const bridge = {} as GitBridge;
    const refreshCoordinator = fakeCoordinator();
    const store = createGitSessionStore({
      bridge,
      refreshCoordinator,
      initialWorkspace: INITIAL_WORKSPACE,
    });

    store.getState().beginMutation("operation-1");
    store.getState().setWorkspace((workspace) => ({ ...workspace, error: "failed" }));
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

  it("always closes mutation state on explicit success, failure, or cancellation paths", () => {
    const store = createGitSessionStore({
      bridge: {} as GitBridge,
      initialWorkspace: INITIAL_WORKSPACE,
    });

    for (const id of ["success", "failure", "cancelled"]) store.getState().beginMutation(id);
    for (const id of ["success", "failure", "cancelled"]) store.getState().finishMutation(id);

    expect(store.getState().pendingMutationIds.size).toBe(0);
  });
});
