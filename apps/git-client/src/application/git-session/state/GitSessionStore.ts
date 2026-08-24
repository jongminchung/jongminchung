import { createStore } from "zustand/vanilla";
import { RefreshCoordinator } from "../../../domain/RefreshCoordinator";
import { createGitSessionRuntime } from "./GitSessionRuntime";
import type {
  GitSessionStore,
  GitSessionStoreDependencies,
  HandleSessionRefreshError,
  SessionRefresh,
} from "./GitSessionStoreTypes";
import { createSessionLifecycleSlice } from "./slices/lifecycleSlice";
import { createSessionMutationSlice } from "./slices/mutationSlice";
import { createSessionQuerySlice } from "./slices/querySlice";
import {
  createSessionActivitySlice,
  createSessionRecoverySlice,
} from "./slices/recoveryActivitySlice";

export type * from "./GitSessionStoreTypes";

export function createGitSessionStore({
  bridge,
  initialWorkspace,
  refreshCoordinator: injectedRefreshCoordinator,
  runtime: injectedRuntime,
}: GitSessionStoreDependencies) {
  const coordinatorCallbacks: {
    refresh: SessionRefresh;
    handleError: HandleSessionRefreshError;
  } = {
    refresh: async () => undefined,
    handleError: () => undefined,
  };
  const refreshCoordinator =
    injectedRefreshCoordinator ??
    RefreshCoordinator.of(
      (repositoryId, invalidations) =>
        coordinatorCallbacks.refresh(repositoryId, invalidations),
      (repositoryId, error) =>
        coordinatorCallbacks.handleError(repositoryId, error),
    );
  const initialRepositoryId =
    initialWorkspace.activeTab.kind === "repository"
      ? initialWorkspace.activeTab.repositoryId
      : null;
  const runtime =
    injectedRuntime ?? createGitSessionRuntime(initialRepositoryId);
  const createLifecycleSlice = createSessionLifecycleSlice({
    bridge,
    runtime,
    refreshCoordinator,
    initialWorkspace,
    configureCoordinator: (refresh, handleError) => {
      coordinatorCallbacks.refresh = refresh;
      coordinatorCallbacks.handleError = handleError;
    },
  });
  const createQuerySlice = createSessionQuerySlice(initialWorkspace);

  return createStore<GitSessionStore>()((...arguments_) => ({
    ...createLifecycleSlice(...arguments_),
    ...createQuerySlice(...arguments_),
    ...createSessionMutationSlice(...arguments_),
    ...createSessionRecoverySlice(...arguments_),
    ...createSessionActivitySlice(...arguments_),
  }));
}

export type GitSessionStoreApi = ReturnType<typeof createGitSessionStore>;
