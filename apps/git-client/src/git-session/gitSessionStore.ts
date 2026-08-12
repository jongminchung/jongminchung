import { createStore } from "zustand/vanilla";
import { RefreshCoordinator } from "../domain/RefreshCoordinator";
import { createGitSessionRuntime } from "./gitSessionRuntime";
import type {
    GitSessionStore,
    GitSessionStoreDependencies,
    HandleSessionRefreshError,
    SessionRefresh,
} from "./state/gitSessionStoreTypes";
import { createSessionLifecycleSlice } from "./state/slices/lifecycleSlice";
import { createSessionMutationSlice } from "./state/slices/mutationSlice";
import { createSessionQuerySlice } from "./state/slices/querySlice";
import {
    createSessionActivitySlice,
    createSessionRecoverySlice,
} from "./state/slices/recoveryActivitySlice";

export type * from "./state/gitSessionStoreTypes";

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
