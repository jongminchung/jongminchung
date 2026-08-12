import type { WorkspaceState } from "../state/GitSessionState";
import type { GitSessionBackend } from "./GitSessionBackend";

let activeBackend: GitSessionBackend<WorkspaceState> | undefined;

export function installGitSessionBackend(
    backend: GitSessionBackend<WorkspaceState>,
): () => void {
    const previous = activeBackend;
    activeBackend = backend;
    return () => {
        if (activeBackend === backend) activeBackend = previous;
    };
}

export function getGitSessionBackend(): GitSessionBackend<WorkspaceState> {
    if (activeBackend === undefined) {
        throw new Error("Git session backend was not installed");
    }
    return activeBackend;
}
