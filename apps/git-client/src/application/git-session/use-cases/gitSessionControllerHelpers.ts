import type { RepositoryView } from "../../../domain/types";
import type {
  GitRequest,
  LogFilters,
  RepositorySnapshot,
  RequestId,
} from "../../../shared/contracts/model/index";
import type { GitBridge } from "../ports/GitBridge";
import type { LogSelection } from "../state/GitSessionRuntime";
import type {
  RepositorySession,
  WorkspaceState,
} from "../state/GitSessionState";

export function emptyRepository(snapshot: RepositorySnapshot): RepositoryView {
  return {
    snapshot,
    refs: [],
    commits: [],
    status: {
      ahead: snapshot.ahead,
      behind: snapshot.behind,
      stashCount: 0,
      changes: [],
    },
  };
}

export function loadingSession(
  snapshot: RepositorySnapshot,
): RepositorySession {
  return {
    kind: "repository",
    status: "loading",
    repository: emptyRepository(snapshot),
    shelves: [],
    stashes: [],
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

export function updateRepositorySession(
  state: WorkspaceState,
  repositoryId: string,
  update: (session: RepositorySession) => RepositorySession,
): WorkspaceState {
  let changed = false;
  const sessions = state.sessions.map((session) => {
    if (
      session.kind !== "repository" ||
      session.repository.snapshot.id !== repositoryId
    )
      return session;
    const next = update(session);
    if (next !== session) changed = true;
    return next;
  });
  return changed ? { ...state, sessions } : state;
}

export const DEFAULT_LOG_FILTERS: LogFilters = {
  query: null,
  branch: null,
  author: null,
  since: null,
  until: null,
  paths: [],
  noMerges: false,
  regex: false,
  matchCase: false,
};

export const DEFAULT_LOG_SELECTION: LogSelection = {
  filters: DEFAULT_LOG_FILTERS,
  order: "topology",
};

export function createLogRequest(
  repositoryId: string,
  selection: LogSelection = DEFAULT_LOG_SELECTION,
  skip = 0,
): GitRequest {
  return {
    kind: "log",
    repositoryId,
    skip,
    limit: 500,
    order: selection.order,
    filters: selection.filters,
  };
}

export function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function cancelRequests(
  gitBridge: GitBridge,
  requestIds: readonly RequestId[],
): Promise<readonly PromiseSettledResult<void>[]> {
  return Promise.allSettled(
    requestIds.map((requestId) => gitBridge.cancel(requestId)),
  );
}
