import type { RecentProject } from "../../../domain/recentProjects";
import type { WorkspaceState } from "../state/GitSessionState";

export function createInitialWorkspaceState({
    recentProjects = [],
    restoring,
}: {
    readonly recentProjects?: readonly RecentProject[];
    readonly restoring: boolean;
}): WorkspaceState {
    return {
        sessions: [],
        activeTab: { kind: "welcome" },
        recentProjects,
        restoring,
        error: null,
    };
}
