import type { GitBridge } from "../../application/git-session/ports/GitBridge";
import type { GitSessionBackend } from "../../application/git-session/ports/GitSessionBackend";
import type { WorkspaceState } from "../../application/git-session/state/GitSessionState";
import { createInitialWorkspaceState } from "../../application/git-session/use-cases/createInitialWorkspaceState";
import { createGitBridge } from "../../bridge/createGitBridge";
import { WELCOME_RECENT_PROJECT_FIXTURE } from "../../domain/fixtureWorkspace";
import { electronApi, isElectronRuntime } from "../../platform/electron";
import { createGitSessionBackend } from "./createGitSessionBackend";

export interface GitSessionComposition {
  readonly backend: GitSessionBackend<WorkspaceState>;
  readonly bridge: GitBridge;
  readonly initialWorkspace: WorkspaceState;
}

function queryFixture(): string | null {
  return new URLSearchParams(window.location.search).get("fixture");
}

export function createGitSessionComposition(): GitSessionComposition {
  const electronRuntime = isElectronRuntime();
  const fixture = queryFixture();
  const fixtureMode = electronApi()?.runtime.qaFixture ?? fixture === "qa";
  const welcomeRecentFixture = !electronRuntime && fixture === "welcome-recent";
  const workspacePersistence = electronRuntime && !fixtureMode;

  return {
    backend: createGitSessionBackend(fixtureMode, {
      electronRuntime,
      workspacePersistence,
    }),
    bridge: createGitBridge(),
    initialWorkspace: createInitialWorkspaceState({
      recentProjects: welcomeRecentFixture
        ? [WELCOME_RECENT_PROJECT_FIXTURE]
        : [],
      restoring: fixtureMode || workspacePersistence,
    }),
  };
}
