import type {
  GitSessionBackend,
  GitSessionHistoryPort,
  GitSessionMutationPort,
  GitSessionQueryPort,
  GitSessionRepositoryPort,
} from "../../application/git-session/ports/GitSessionBackend";
import type { WorkspaceState } from "../../application/git-session/state/GitSessionState";
import type { RepositorySession } from "../../application/git-session/state/GitSessionState";
import {
  buildFixtureHistoryRewritePreview,
  buildFixturePushPreview,
} from "../../application/git-session/use-cases/buildFixturePreviews";
import { UNAVAILABLE_TERMINAL } from "../../application/terminal/ports/TerminalAvailability";
import { FIXTURE_REPOSITORY_ACTION_ERROR } from "../../domain/fixtureMode";
import { WELCOME_RECENT_PROJECT_FIXTURE } from "../../domain/fixtureWorkspace";

const ignore = async (): Promise<void> => undefined;
const empty = async <T>(): Promise<readonly T[]> => [];
type FixtureData = typeof import("../../domain/sampleData");
const requireFixtureData = (): Promise<FixtureData> =>
  import("../../domain/sampleData");

function fixtureSession(fixtureData: FixtureData): RepositorySession {
  return {
    kind: "repository",
    status: "ready",
    repository: fixtureData.sampleRepository,
    shelves: fixtureData.sampleShelves,
    stashes: fixtureData.sampleStashes,
    changelists: [],
    recoveryEntries: [],
    conflicts: [],
    remotes: [],
    worktrees: [],
    stale: false,
    hasMoreCommits: false,
    logLoading: false,
    logError: null,
    error: null,
  };
}

const repository: GitSessionRepositoryPort<WorkspaceState> = {
  async initialWorkspace(): Promise<WorkspaceState> {
    const fixtureData = await requireFixtureData();
    return {
      sessions: [fixtureSession(fixtureData)],
      activeTab: {
        kind: "repository",
        repositoryId: fixtureData.sampleRepository.snapshot.id,
      },
      recentProjects: [WELCOME_RECENT_PROJECT_FIXTURE],
      restoring: false,
      error: null,
    };
  },
  restore: ignore,
  persist: ignore,
  refresh: ignore,
  watch: ignore,
  assertActionsAllowed: () => {
    throw new Error(FIXTURE_REPOSITORY_ACTION_ERROR);
  },
  closeResources: ignore,
};

const queries: GitSessionQueryPort = {
  async executeRequest(requestKind) {
    return requestKind === "diff"
      ? (await requireFixtureData()).samplePatch
      : "";
  },
  commitFiles: (_live, fixture) => fixture(),
  diff: (_live, fixture) => fixture(),
  tree: empty,
  files: empty,
  search: empty,
  blame: empty,
  readFile: (_source, _path, _live, fixture) => fixture(),
  readFilePreview: async (path) => ({ kind: "binary", path, sizeBytes: 0 }),
  submoduleDiff: async (path) => ({
    path,
    beforeOid: null,
    afterOid: null,
    beforeSubject: null,
    afterSubject: null,
    ahead: null,
    behind: null,
  }),
  openWorkingTreeFile: ignore,
};

const mutations: GitSessionMutationPort = {
  enabled: false,
  execute: ignore,
  nativeOnly: async (message) => {
    throw new Error(message);
  },
  createShelf: async () => null,
  applyShelf: async () => false,
  recoveryEntries: empty,
};

const history: GitSessionHistoryPort = {
  loadLog: ignore,
  fileHistory: (_live, fixture) => fixture(),
  stashFiles: (_live, fixture) => fixture(),
  stashPatch: (_live, fixture) => fixture(),
  listLocalActivities: async () => ({ activities: [], nextCursor: null }),
  readLocalActivity: async () => {
    throw new Error("Local History requires the native app");
  },
  localDiff: (_live, fixture) => fixture(),
  nativeOnly: async (message) => {
    throw new Error(message);
  },
  loadPushPreview: async (request) => buildFixturePushPreview(request),
  loadHistoryRewritePreview: async (request) =>
    buildFixtureHistoryRewritePreview(request),
};

export const fixtureGitSessionBackend: GitSessionBackend<WorkspaceState> = {
  kind: "fixture",
  fixtureMode: true,
  terminal: UNAVAILABLE_TERMINAL,
  repository,
  queries,
  mutations,
  history,
};
