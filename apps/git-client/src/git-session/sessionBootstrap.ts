import type { RecentProject } from "../domain/recentProjects";
import { electronApi, isElectronRuntime } from "../platform/electron";
import type { WorkspaceState } from "./sessionTypes";

export const WELCOME_RECENT_PROJECT_FIXTURE: RecentProject = Object.freeze({
  path: "/Users/jaime/workspace/gcloud-manifest/services/gcloud-cloudlog",
  name: "gcloud-cloudlog",
  branch: "feat/opensearch",
  lastOpenedAt: 1,
});

export function fixtureEnabled(): boolean {
  const api = electronApi();
  if (api !== null) return api.runtime.qaFixture;
  return new URLSearchParams(window.location.search).get("fixture") === "qa";
}

export function welcomeRecentFixtureEnabled(): boolean {
  return (
    !isElectronRuntime() &&
    new URLSearchParams(window.location.search).get("fixture") === "welcome-recent"
  );
}

export function createInitialWorkspaceState(): WorkspaceState {
  const welcomeRecentFixture = welcomeRecentFixtureEnabled();
  return {
    sessions: [],
    activeTab: { kind: "welcome" },
    recentProjects: welcomeRecentFixture ? [WELCOME_RECENT_PROJECT_FIXTURE] : [],
    restoring: fixtureEnabled() || (!welcomeRecentFixture && isElectronRuntime()),
    error: null,
  };
}
