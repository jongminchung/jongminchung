import type { WorkspaceState } from "../GitSessionState";
import type {
    HandleSessionRefreshError,
    SessionLifecycleSlice,
    SessionRefresh,
    SessionSliceCreator,
} from "../GitSessionStoreTypes";

export function createSessionLifecycleSlice({
    bridge,
    runtime,
    refreshCoordinator,
    initialWorkspace,
    configureCoordinator,
}: {
    readonly bridge: SessionLifecycleSlice["bridge"];
    readonly runtime: SessionLifecycleSlice["runtime"];
    readonly refreshCoordinator: SessionLifecycleSlice["refreshCoordinator"];
    readonly initialWorkspace: WorkspaceState;
    readonly configureCoordinator: (
        refresh: SessionRefresh,
        handleError: HandleSessionRefreshError,
    ) => void;
}): SessionSliceCreator<SessionLifecycleSlice> {
    return (set, get) => ({
        bridge,
        runtime,
        refreshCoordinator,
        configureRefreshCoordinator: configureCoordinator,
        resetSession: () => {
            for (const session of get().workspace.sessions) {
                if (session.kind !== "repository") continue;
                const repositoryId = session.repository.snapshot.id;
                refreshCoordinator.forget(repositoryId);
                runtime.forgetRepository(repositoryId);
            }
            set({
                workspace: initialWorkspace,
                activity: null,
                consoleEntries: [],
                pendingMutationIds: new Set(),
                recoveryRevision: 0,
            });
        },
    });
}
