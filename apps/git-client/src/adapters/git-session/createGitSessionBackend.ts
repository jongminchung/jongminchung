import type { GitSessionBackend } from "../../application/git-session/ports/GitSessionBackend";
import type { WorkspaceState } from "../../application/git-session/state/GitSessionState";
import { createLiveGitSessionBackend } from "../electron/liveGitSessionBackend";
import { fixtureGitSessionBackend } from "../fixture/fixtureGitSessionBackend";

export function createGitSessionBackend(
    fixtureMode: boolean,
    options: {
        readonly electronRuntime?: boolean;
        readonly workspacePersistence?: boolean;
    } = {},
): GitSessionBackend<WorkspaceState> {
    return fixtureMode
        ? fixtureGitSessionBackend
        : createLiveGitSessionBackend({
              terminalAvailable: options.electronRuntime ?? false,
              workspacePersistence: options.workspacePersistence,
          });
}
