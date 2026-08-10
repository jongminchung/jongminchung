import { startTransition, useCallback, useEffect, useMemo } from "react";
import { assertLiveRepositoryActionAllowed } from "../domain/fixtureMode";
import {
  isGitRequestCancelled,
  isRetryableOperation,
  operationActivityLabel,
  sanitizeGitError,
} from "../domain/gitActivity";
import { operationPolicyFor } from "../domain/gitOperationPolicy";
import { parseLog, parseRefs, parseStashList, parseStatusV2 } from "../domain/parsers";
import { closeProjectResources } from "../domain/projectClose";
import { updateRecentProjects } from "../domain/recentProjects";
import {
  repositoryAccessPolicy,
  restoreRepositoryAccess,
  type RepositoryAccessMode,
} from "../domain/repositoryAccess";
import { updateRepositoryView } from "../domain/repositoryView";
import { terminalService } from "../domain/TerminalService";
import type { Commit, RepositoryView } from "../domain/types";
import {
  loadWorkspaceStartupState,
  recentProjectsWithRestoreFailures,
} from "../domain/welcomeStartup";
import {
  restoredWorkspaceTab,
  WORKSPACE_SCHEMA_VERSION,
  workspacePaths,
  workspaceTabAfterClose,
} from "../domain/workspacePersistence";
import { useGitSessionStore } from "./GitSessionStoreProvider";
import {
  fixtureEnabled,
  welcomeRecentFixtureEnabled,
  WELCOME_RECENT_PROJECT_FIXTURE,
} from "./sessionBootstrap";
import type { RepositorySession, WorkspaceState, WorkspaceTab } from "./sessionTypes";
export type {
  RepositoryErrorSession,
  RepositorySession,
  WorkspaceRepositorySession,
  WorkspaceState,
  WorkspaceTab,
} from "./sessionTypes";
import { isElectronRuntime } from "../platform/electron";
import { readElectronSetting, writeElectronSettings } from "../platform/electronSettings";
import type { GitCreationEventListener } from "../shared/contracts/git-utility";
import type {
  CloneOptions,
  ConflictFile,
  GitOperation,
  GitRequest,
  LogFilters,
  LogOrder,
  PushPreview,
  HistoryRewritePreview,
  RecoveryEntry,
  RemoteInfo,
  RequestId,
  RepositoryInvalidation,
  RepositorySnapshot,
  WorktreeInfo,
} from "../shared/contracts/model";
import type { LogSelection } from "./gitSessionRuntime";
import { useGitRequestRuntime } from "./useGitRequestRuntime";
import { useGitSessionMutationActions } from "./useGitSessionMutationActions";
import { useGitSessionQueryActions } from "./useGitSessionQueryActions";

const EMPTY_ARRAY: readonly never[] = [];

function emptyRepository(snapshot: RepositorySnapshot): RepositoryView {
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

function loadingSession(snapshot: RepositorySnapshot): RepositorySession {
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

type FixtureData = typeof import("../domain/sampleData");
const loadFixtureData = (): Promise<FixtureData> => import("../domain/sampleData");

async function requireFixtureData(): Promise<FixtureData> {
  return loadFixtureData();
}

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

function updateRepositorySession(
  state: WorkspaceState,
  repositoryId: string,
  update: (session: RepositorySession) => RepositorySession,
): WorkspaceState {
  let changed = false;
  const sessions = state.sessions.map((session) => {
    if (session.kind !== "repository" || session.repository.snapshot.id !== repositoryId)
      return session;
    const next = update(session);
    if (next !== session) changed = true;
    return next;
  });
  return changed ? { ...state, sessions } : state;
}

const DEFAULT_LOG_FILTERS: LogFilters = {
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

const DEFAULT_LOG_SELECTION: LogSelection = {
  filters: DEFAULT_LOG_FILTERS,
  order: "topology",
};

function createLogRequest(
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

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function cancelRequests(
  gitBridge: import("../bridge/GitBridge").GitBridge,
  requestIds: readonly RequestId[],
): Promise<readonly PromiseSettledResult<void>[]> {
  return Promise.allSettled(requestIds.map((requestId) => gitBridge.cancel(requestId)));
}

export function useGitSessionController() {
  const fixture = fixtureEnabled();
  const welcomeRecentFixture = welcomeRecentFixtureEnabled();
  const gitBridge = useGitSessionStore((store) => store.bridge);
  const state = useGitSessionStore((store) => store.workspace);
  const activity = useGitSessionStore((store) => store.activity);
  const gitConsoleEntries = useGitSessionStore((store) => store.consoleEntries);
  const setState = useGitSessionStore((store) => store.setWorkspace);
  const setActivity = useGitSessionStore((store) => store.setActivity);
  const setGitConsoleEntries = useGitSessionStore((store) => store.setConsoleEntries);
  const refreshCoordinator = useGitSessionStore((store) => store.refreshCoordinator);
  const configureRefreshCoordinator = useGitSessionStore(
    (store) => store.configureRefreshCoordinator,
  );
  const beginMutation = useGitSessionStore((store) => store.beginMutation);
  const finishMutation = useGitSessionStore((store) => store.finishMutation);
  const runtime = useGitSessionStore((store) => store.runtime);

  const activeSession = useMemo(() => {
    if (state.activeTab.kind !== "repository") return null;
    const repositoryId = state.activeTab.repositoryId;
    const session = state.sessions.find(
      (candidate) =>
        candidate.kind === "repository" && candidate.repository.snapshot.id === repositoryId,
    );
    return session?.kind === "repository" ? session : null;
  }, [state.activeTab, state.sessions]);
  const managementSession = useMemo(
    () =>
      state.sessions.find(
        (candidate): candidate is RepositorySession => candidate.kind === "repository",
      ) ?? null,
    [state.sessions],
  );
  const activeErrorSession = useMemo(() => {
    if (state.activeTab.kind !== "error") return null;
    const sessionId = state.activeTab.sessionId;
    const session = state.sessions.find(
      (candidate) => candidate.kind === "error" && candidate.id === sessionId,
    );
    return session?.kind === "error" ? session : null;
  }, [state.activeTab, state.sessions]);
  const openRepositoryPathsJson = JSON.stringify(workspacePaths(state.sessions));
  const safeRepositoryPathsJson = JSON.stringify(
    repositoryAccessPolicy.safePaths([
      ...workspacePaths(state.sessions),
      ...state.recentProjects.map((project) => project.path),
    ]),
  );
  const recentProjectsJson = JSON.stringify(state.recentProjects);
  const activeRepositoryPath =
    activeSession?.repository.snapshot.path ?? activeErrorSession?.path ?? null;

  useEffect(() => {
    runtime.activeRepositoryId = activeSession?.repository.snapshot.id ?? null;
    repositoryAccessPolicy.activate(runtime.activeRepositoryId);
    runtime.activeSnapshot =
      activeSession?.repository.snapshot ?? managementSession?.repository.snapshot ?? null;
    if (activeSession) {
      runtime.logCommitCounts.set(
        activeSession.repository.snapshot.id,
        activeSession.repository.commits.length,
      );
    }
  }, [
    activeSession?.repository.commits.length,
    activeSession?.repository.snapshot,
    managementSession?.repository.snapshot,
    activeSession,
    runtime,
  ]);

  useEffect(() => {
    if (!fixture) return;
    const load = async (): Promise<void> => {
      const fixtureData = await requireFixtureData();
      setState({
        sessions: [fixtureSession(fixtureData)],
        activeTab: {
          kind: "repository",
          repositoryId: fixtureData.sampleRepository.snapshot.id,
        },
        recentProjects: [WELCOME_RECENT_PROJECT_FIXTURE],
        restoring: false,
        error: null,
      });
    };
    void load();
  }, [fixture, setState]);

  const { beginActivity, clearGitConsole, dismissActivity, finishActivity, runRequest } =
    useGitRequestRuntime({
      activity,
      beginMutation,
      finishMutation,
      fixture,
      gitBridge,
      runtime,
      setActivity,
      setGitConsoleEntries,
    });
  const refreshAll = useCallback(
    async (repositoryId: string): Promise<void> => {
      if (fixture) return;
      const [
        refsOutput,
        logOutput,
        statusOutput,
        stashOutput,
        shelves,
        changelists,
        recoveryEntries,
        conflicts,
        remotes,
        worktrees,
      ] = await Promise.all([
        runRequest({ kind: "refs", repositoryId }),
        runRequest(createLogRequest(repositoryId, runtime.logSelections.get(repositoryId))),
        runRequest({ kind: "status", repositoryId }),
        runRequest({ kind: "stashList", repositoryId }),
        gitBridge.listShelves(repositoryId),
        gitBridge.listChangelists(repositoryId),
        gitBridge.listRecoveryEntries(repositoryId),
        gitBridge.listConflicts(repositoryId),
        gitBridge.listRemotes(repositoryId),
        gitBridge.listWorktrees(repositoryId),
      ]);
      const refreshedSnapshot = await gitBridge.refreshRepository(repositoryId);
      runtime.rawRepositoryData.set(repositoryId, {
        refs: refsOutput,
        log: logOutput,
        status: statusOutput,
        stash: stashOutput,
      });
      setState((current) => {
        const previousProject = current.recentProjects.find(
          (project) => project.path === refreshedSnapshot.path,
        );
        const updated = updateRepositorySession(current, repositoryId, (session) => ({
          ...session,
          status: "ready",
          repository: {
            snapshot: refreshedSnapshot,
            refs: parseRefs(refsOutput),
            commits: parseLog(logOutput),
            status: parseStatusV2(statusOutput),
          },
          shelves,
          stashes: parseStashList(stashOutput),
          changelists,
          recoveryEntries,
          conflicts,
          remotes,
          worktrees,
          stale: false,
          hasMoreCommits: parseLog(logOutput).length === 500,
          logLoading: false,
          logError: null,
          error: null,
        }));
        if (previousProject?.branch === refreshedSnapshot.currentBranch) return updated;
        return {
          ...updated,
          recentProjects: updateRecentProjects(updated.recentProjects, {
            path: refreshedSnapshot.path,
            name: refreshedSnapshot.name,
            branch: refreshedSnapshot.currentBranch,
            lastOpenedAt: previousProject?.lastOpenedAt ?? Date.now(),
          }),
        };
      });
    },
    [fixture, runRequest, gitBridge, runtime, setState],
  );

  const refreshOnce = useCallback(
    (repositoryId: string): Promise<void> => {
      const existing = runtime.refreshInFlight.get(repositoryId);
      if (existing) return existing;
      const run = async (): Promise<void> => {
        try {
          await refreshAll(repositoryId);
        } catch (error) {
          setState((current) =>
            updateRepositorySession(current, repositoryId, (session) => ({
              ...session,
              status: "ready",
              error: sanitizeGitError(error),
            })),
          );
        } finally {
          runtime.refreshInFlight.delete(repositoryId);
        }
      };
      const task = run();
      runtime.refreshInFlight.set(repositoryId, task);
      return task;
    },
    [refreshAll, runtime, setState],
  );

  const refreshInvalidations = useCallback(
    async (
      repositoryId: string,
      invalidations: readonly RepositoryInvalidation[],
    ): Promise<void> => {
      if (fixture) return;
      const scopes = new Set(invalidations);
      const refreshStatus = scopes.has("status");
      const refreshHistory = scopes.has("history");
      const refreshStash = scopes.has("stash");
      const refreshOperation = scopes.has("operation");
      const refreshManagement = scopes.has("management");
      const [
        statusOutput,
        refsOutput,
        logOutput,
        stashOutput,
        snapshot,
        conflicts,
        remotes,
        worktrees,
      ] = await Promise.all([
        refreshStatus
          ? runRequest({ kind: "status", repositoryId })
          : Promise.resolve<string | null>(null),
        refreshHistory
          ? runRequest({ kind: "refs", repositoryId })
          : Promise.resolve<string | null>(null),
        refreshHistory
          ? runRequest(createLogRequest(repositoryId, runtime.logSelections.get(repositoryId)))
          : Promise.resolve<string | null>(null),
        refreshStash
          ? runRequest({ kind: "stashList", repositoryId })
          : Promise.resolve<string | null>(null),
        refreshHistory || refreshOperation || refreshManagement
          ? gitBridge.refreshRepository(repositoryId)
          : Promise.resolve<RepositorySnapshot | null>(null),
        refreshStatus || refreshOperation
          ? gitBridge.listConflicts(repositoryId)
          : Promise.resolve<readonly ConflictFile[] | null>(null),
        refreshManagement
          ? gitBridge.listRemotes(repositoryId)
          : Promise.resolve<readonly RemoteInfo[] | null>(null),
        refreshManagement
          ? gitBridge.listWorktrees(repositoryId)
          : Promise.resolve<readonly WorktreeInfo[] | null>(null),
      ]);
      const previousRaw = runtime.rawRepositoryData.get(repositoryId);
      const statusChanged = statusOutput !== null && statusOutput !== previousRaw?.status;
      const refsChanged = refsOutput !== null && refsOutput !== previousRaw?.refs;
      const logChanged = logOutput !== null && logOutput !== previousRaw?.log;
      const stashChanged = stashOutput !== null && stashOutput !== previousRaw?.stash;
      runtime.rawRepositoryData.set(repositoryId, {
        refs: refsOutput ?? previousRaw?.refs ?? "",
        log: logOutput ?? previousRaw?.log ?? "",
        status: statusOutput ?? previousRaw?.status ?? "",
        stash: stashOutput ?? previousRaw?.stash ?? "",
      });

      startTransition(() => {
        setState((current) =>
          updateRepositorySession(current, repositoryId, (session) => {
            const repository = session.repository;
            const nextSnapshot =
              snapshot && !sameValue(snapshot, repository.snapshot)
                ? snapshot
                : repository.snapshot;
            const nextRefs =
              refsChanged && refsOutput !== null ? parseRefs(refsOutput) : repository.refs;
            const nextCommits =
              logChanged && logOutput !== null ? parseLog(logOutput) : repository.commits;
            const nextStatus =
              statusChanged && statusOutput !== null
                ? parseStatusV2(statusOutput)
                : repository.status;
            const nextRepository = updateRepositoryView(repository, {
              snapshot: nextSnapshot,
              refs: nextRefs,
              commits: nextCommits,
              status: nextStatus,
            });
            const nextStashes =
              stashChanged && stashOutput !== null ? parseStashList(stashOutput) : session.stashes;
            const nextConflicts =
              conflicts && !sameValue(conflicts, session.conflicts) ? conflicts : session.conflicts;
            const nextRemotes =
              remotes && !sameValue(remotes, session.remotes) ? remotes : session.remotes;
            const nextWorktrees =
              worktrees && !sameValue(worktrees, session.worktrees) ? worktrees : session.worktrees;
            if (
              nextRepository === session.repository &&
              nextStashes === session.stashes &&
              nextConflicts === session.conflicts &&
              nextRemotes === session.remotes &&
              nextWorktrees === session.worktrees &&
              !session.stale &&
              session.error === null
            ) {
              return session;
            }
            return {
              ...session,
              repository: nextRepository,
              stashes: nextStashes,
              conflicts: nextConflicts,
              remotes: nextRemotes,
              worktrees: nextWorktrees,
              stale: false,
              hasMoreCommits:
                logOutput === null ? session.hasMoreCommits : nextCommits.length === 500,
              error: null,
            };
          }),
        );
      });
    },
    [fixture, runRequest, gitBridge, runtime, setState],
  );

  useEffect(() => {
    configureRefreshCoordinator(refreshInvalidations, (repositoryId, error) => {
      setState((current) =>
        updateRepositorySession(current, repositoryId, (session) => ({
          ...session,
          error: sanitizeGitError(error),
        })),
      );
    });
  }, [configureRefreshCoordinator, refreshInvalidations, setState]);

  const watch = useCallback(
    async (snapshot: RepositorySnapshot): Promise<void> => {
      if (fixture) return;
      await runtime.repositoryWatchSession.ensure(snapshot.id, () =>
        gitBridge.watchRepository(snapshot.id, (event) => {
          const recordAndRefresh = async (): Promise<void> => {
            if (runtime.activeRepositoryId === snapshot.id) {
              refreshCoordinator.invalidate(snapshot.id, event.invalidations);
            } else {
              refreshCoordinator.defer(snapshot.id, event.invalidations);
              setState((current) =>
                updateRepositorySession(current, snapshot.id, (session) => ({
                  ...session,
                  stale: true,
                })),
              );
            }
          };
          void recordAndRefresh();
        }),
      );
    },
    [fixture, refreshCoordinator, gitBridge, runtime, setState],
  );

  const addSnapshot = useCallback(
    async (snapshot: RepositorySnapshot, activate: boolean): Promise<void> => {
      if (activate) repositoryAccessPolicy.activate(snapshot.id);
      setState((current) => ({
        ...current,
        sessions: [
          ...current.sessions.filter(
            (session) =>
              session.kind !== "repository" || session.repository.snapshot.id !== snapshot.id,
          ),
          loadingSession(snapshot),
        ],
        activeTab: activate ? { kind: "repository", repositoryId: snapshot.id } : current.activeTab,
        recentProjects: updateRecentProjects(current.recentProjects, {
          path: snapshot.path,
          name: snapshot.name,
          branch: snapshot.currentBranch,
          lastOpenedAt: Date.now(),
        }),
        error: null,
      }));
      await refreshOnce(snapshot.id);
      await watch(snapshot);
    },
    [refreshOnce, watch, setState],
  );

  useEffect(() => {
    if (fixture || welcomeRecentFixture || !isElectronRuntime() || runtime.restored) return;
    runtime.restored = true;
    const restore = async (): Promise<void> => {
      try {
        const startup = await loadWorkspaceStartupState(readElectronSetting);
        const results = await Promise.allSettled(
          startup.openRepositoryPaths.map((path) => gitBridge.openRepository(path)),
        );
        const snapshots = results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        restoreRepositoryAccess(repositoryAccessPolicy, snapshots, startup.safeRepositoryPaths);
        const sessions = snapshots.map(loadingSession);
        const failures = results.flatMap((result, index) =>
          result.status === "rejected"
            ? [
                `${startup.openRepositoryPaths[index] ?? "Unknown repository"}: ${sanitizeGitError(result.reason)}`,
              ]
            : [],
        );
        const failedPaths = results.flatMap((result, index) =>
          result.status === "rejected" && startup.openRepositoryPaths[index]
            ? [startup.openRepositoryPaths[index]]
            : [],
        );
        const activeTab = restoredWorkspaceTab(sessions, startup.activeRepositoryPath);
        repositoryAccessPolicy.activate(
          activeTab.kind === "repository" ? activeTab.repositoryId : null,
        );
        setState({
          sessions,
          activeTab,
          recentProjects: recentProjectsWithRestoreFailures(startup.recentProjects, failedPaths),
          restoring: false,
          error:
            failures.length > 0
              ? `Could not reopen ${failures.length} project(s): ${failures.join("; ")}`
              : null,
        });
        await Promise.allSettled(
          snapshots.map(async (snapshot) => {
            await refreshOnce(snapshot.id);
            await watch(snapshot);
          }),
        );
      } catch (error) {
        setState((current) => ({
          ...current,
          restoring: false,
          error: sanitizeGitError(error),
        }));
      }
    };
    void restore();
  }, [fixture, refreshOnce, runtime, watch, welcomeRecentFixture, gitBridge, setState]);

  useEffect(() => {
    if (fixture || welcomeRecentFixture || !isElectronRuntime() || state.restoring) return;
    const persist = async (): Promise<void> => {
      await writeElectronSettings({
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        openRepositoryPaths: JSON.parse(openRepositoryPathsJson),
        safeRepositoryPaths: JSON.parse(safeRepositoryPathsJson),
        activeRepositoryPath,
        recentProjects: JSON.parse(recentProjectsJson),
      });
    };
    void persist();
  }, [
    activeRepositoryPath,
    fixture,
    openRepositoryPathsJson,
    safeRepositoryPathsJson,
    recentProjectsJson,
    state.restoring,
    welcomeRecentFixture,
  ]);

  useEffect(
    () => () => {
      for (const repositoryId of runtime.repositoryWatchSession.trackedRepositoryIds()) {
        runtime.repositoryWatchSession.forget(repositoryId);
        void gitBridge.unwatchRepository(repositoryId);
      }
    },
    [gitBridge, runtime],
  );

  const openRepository = useCallback(
    async (
      path: string,
      mode: RepositoryAccessMode = repositoryAccessPolicy.modeForPath(path),
    ): Promise<void> => {
      try {
        assertLiveRepositoryActionAllowed(fixture);
        repositoryAccessPolicy.remember(path, mode);
        const intendedSafeRepositoryPaths = repositoryAccessPolicy
          .safePaths([
            ...workspacePaths(state.sessions),
            ...state.recentProjects.map((project) => project.path),
            path,
          ])
          .filter((safePath) => mode === "safe" || safePath !== path);
        await writeElectronSettings({
          safeRepositoryPaths: intendedSafeRepositoryPaths,
          activeRepositoryPath: path,
        });
        const snapshot = await gitBridge.openRepository(path);
        repositoryAccessPolicy.open(snapshot.id, snapshot.path, mode);
        await addSnapshot(snapshot, true);
      } catch (error) {
        setState((current) => ({
          ...current,
          error: sanitizeGitError(error),
        }));
      }
    },
    [addSnapshot, fixture, state.recentProjects, state.sessions, gitBridge, setState],
  );

  const initializeRepository = useCallback(
    async (path: string, bare: boolean, onEvent?: GitCreationEventListener): Promise<void> => {
      try {
        assertLiveRepositoryActionAllowed(fixture);
        repositoryAccessPolicy.assertActive("gitMutation");
        await addSnapshot(await gitBridge.initializeRepository(path, bare, onEvent), true);
      } catch (error) {
        const message = sanitizeGitError(error);
        setState((current) => ({
          ...current,
          error: message,
        }));
        throw new Error(message);
      }
    },
    [addSnapshot, fixture, gitBridge, setState],
  );

  const cloneRepository = useCallback(
    async (
      url: string,
      path: string,
      options: CloneOptions,
      onEvent?: GitCreationEventListener,
    ): Promise<void> => {
      try {
        assertLiveRepositoryActionAllowed(fixture);
        repositoryAccessPolicy.assertActive("gitMutation");
        await addSnapshot(await gitBridge.cloneRepository(url, path, options, onEvent), true);
      } catch (error) {
        const message = sanitizeGitError(error);
        setState((current) => ({
          ...current,
          error: message,
        }));
        throw new Error(message);
      }
    },
    [addSnapshot, fixture, gitBridge, setState],
  );

  const cancelRepositoryCreation = useCallback(
    async (requestId: RequestId): Promise<void> => {
      await gitBridge.cancel(requestId);
    },
    [gitBridge],
  );

  const activateTab = useCallback(
    async (tab: WorkspaceTab): Promise<void> => {
      const nextActiveSession = state.sessions.find((candidate) =>
        tab.kind === "repository"
          ? candidate.kind === "repository" && candidate.repository.snapshot.id === tab.repositoryId
          : tab.kind === "error"
            ? candidate.kind === "error" && candidate.id === tab.sessionId
            : false,
      );
      const nextActivePath =
        nextActiveSession === undefined
          ? null
          : nextActiveSession.kind === "repository"
            ? nextActiveSession.repository.snapshot.path
            : nextActiveSession.path;
      await writeElectronSettings({
        activeRepositoryPath: nextActivePath,
      });
      runtime.activeRepositoryId = tab.kind === "repository" ? tab.repositoryId : null;
      repositoryAccessPolicy.activate(runtime.activeRepositoryId);
      setState((current) => ({ ...current, activeTab: tab }));
      if (tab.kind !== "repository") return;
      const session = state.sessions.find(
        (candidate) =>
          candidate.kind === "repository" && candidate.repository.snapshot.id === tab.repositoryId,
      );
      if (session?.kind === "repository" && session.stale) {
        if (!(await refreshCoordinator.resume(tab.repositoryId))) {
          refreshCoordinator.invalidate(tab.repositoryId, [
            "status",
            "history",
            "stash",
            "operation",
            "management",
          ]);
          await refreshCoordinator.flush(tab.repositoryId);
        }
      }
    },
    [refreshCoordinator, runtime, state.sessions, setState],
  );

  const switchRepository = useCallback(
    async (repositoryId: string): Promise<void> =>
      activateTab({ kind: "repository", repositoryId }),
    [activateTab],
  );

  const closeRepository = useCallback(
    async (sessionId: string): Promise<void> => {
      const session = state.sessions.find((candidate) =>
        candidate.kind === "repository"
          ? candidate.repository.snapshot.id === sessionId
          : candidate.id === sessionId,
      );
      if (!session) return;
      if (!fixture && session.kind === "repository") {
        await Promise.all([
          gitBridge.unwatchRepository(sessionId),
          terminalService.closeRepository(sessionId),
        ]);
        runtime.forgetRepository(sessionId);
        refreshCoordinator.forget(sessionId);
        repositoryAccessPolicy.forget(sessionId);
      }
      setState((current) => ({
        ...current,
        sessions: current.sessions.filter((candidate) =>
          candidate.kind === "repository"
            ? candidate.repository.snapshot.id !== sessionId
            : candidate.id !== sessionId,
        ),
        activeTab: workspaceTabAfterClose(current.sessions, current.activeTab, sessionId),
      }));
    },
    [fixture, refreshCoordinator, runtime, state.sessions, gitBridge, setState],
  );

  const closeProject = useCallback(async (): Promise<void> => {
    const repositoryIds = state.sessions.flatMap((session) =>
      session.kind === "repository" ? [session.repository.snapshot.id] : [],
    );
    await writeElectronSettings({
      activeRepositoryPath: null,
      openRepositoryPaths: [],
    });
    await closeProjectResources(repositoryIds, {
      unwatchRepository: (repositoryId) =>
        fixture ? Promise.resolve() : gitBridge.unwatchRepository(repositoryId),
      closeRepositoryTerminals: (repositoryId) =>
        fixture ? Promise.resolve() : terminalService.closeRepository(repositoryId),
      forgetRepository: (repositoryId) => {
        runtime.forgetRepository(repositoryId);
        refreshCoordinator.forget(repositoryId);
        repositoryAccessPolicy.forget(repositoryId);
      },
    });
    runtime.activeRepositoryId = null;
    repositoryAccessPolicy.activate(null);
    runtime.activeSnapshot = null;
    setState((current) => ({
      ...current,
      sessions: [],
      activeTab: { kind: "welcome" },
    }));
  }, [fixture, refreshCoordinator, runtime, state.sessions, setState, gitBridge]);

  const activeSnapshot = useCallback((): RepositorySnapshot => {
    const snapshot = runtime.activeSnapshot;
    if (!snapshot) throw new Error("Open a repository first");
    return snapshot;
  }, [runtime]);

  const executeOperation = useCallback(
    async (operation: GitOperation, throwOnError = false): Promise<void> => {
      if (fixture) return;
      const snapshot = activeSnapshot();
      const policy = operationPolicyFor(operation);
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      const activityId = beginActivity(
        snapshot.id,
        operationActivityLabel(operation),
        isRetryableOperation(operation)
          ? {
              kind: "operation",
              repositoryId: snapshot.id,
              operation,
            }
          : null,
      );
      try {
        await runRequest(
          {
            kind: "operation",
            repositoryId: snapshot.id,
            operation,
          },
          { activityId },
        );
        refreshCoordinator.invalidate(snapshot.id, policy.invalidations);
        const recoveryEntries = policy.recordsRecovery
          ? fixture
            ? null
            : await gitBridge.listRecoveryEntries(snapshot.id)
          : null;
        await refreshCoordinator.flush(snapshot.id);
        if (recoveryEntries) {
          setState((current) =>
            updateRepositorySession(current, snapshot.id, (session) =>
              sameValue(recoveryEntries, session.recoveryEntries)
                ? session
                : { ...session, recoveryEntries },
            ),
          );
        }
        finishActivity(activityId, "succeeded");
      } catch (error) {
        if (isGitRequestCancelled(error)) {
          refreshCoordinator.invalidate(snapshot.id, [
            "status",
            "history",
            "stash",
            "operation",
            "management",
          ]);
          try {
            await refreshCoordinator.flush(snapshot.id);
          } catch (refreshError) {
            const message = sanitizeGitError(refreshError);
            setState((current) =>
              updateRepositorySession(current, snapshot.id, (session) => ({
                ...session,
                error: message,
              })),
            );
          }
          finishActivity(activityId, "cancelled");
          return;
        }
        refreshCoordinator.invalidate(snapshot.id, [
          "status",
          "history",
          "operation",
          "management",
        ]);
        try {
          await refreshCoordinator.flush(snapshot.id);
        } catch {
          // Preserve the original mutation failure; the next watcher refresh retries state hydration.
        }
        let recoveryEntries: readonly RecoveryEntry[] | null = null;
        if (policy.recordsRecovery && !fixture) {
          try {
            recoveryEntries = await gitBridge.listRecoveryEntries(snapshot.id);
          } catch {
            // Preserve the original mutation failure when recovery metadata cannot be refreshed.
          }
        }
        const message = sanitizeGitError(error);
        setState((current) =>
          updateRepositorySession(current, snapshot.id, (session) => ({
            ...session,
            error: message,
            recoveryEntries: recoveryEntries ?? session.recoveryEntries,
          })),
        );
        finishActivity(activityId, "failed", message);
        if (throwOnError) throw new Error(message);
      }
    },
    [
      activeSnapshot,
      beginActivity,
      finishActivity,
      fixture,
      gitBridge,
      refreshCoordinator,
      runRequest,
      setState,
    ],
  );

  const loadPushPreview = useCallback(
    async (
      remote: string | null = null,
      remoteRef: string | null = null,
      localRevision = "HEAD",
    ): Promise<PushPreview> => {
      if (fixture) {
        const snapshot = activeSnapshot();
        const branch = snapshot.currentBranch ?? "main";
        const oid = snapshot.headOid ?? "0000000000000000000000000000000000000000";
        const destination = remoteRef ?? `refs/heads/${branch}`;
        const destinationBranch = destination.replace(/^refs\/heads\//, "");
        const diverged = destinationBranch === "diverged";
        const divergedRemoteOid = "fedcba9876543210fedcba9876543210fedcba98";
        const reviewedRemoteOid = diverged ? divergedRemoteOid : snapshot.upstream ? oid : null;
        return {
          sourceBranch: snapshot.currentBranch,
          sourceRevision: localRevision,
          localOid: oid,
          remote: remote ?? "origin",
          remoteRef: destination,
          upstreamConfigured: Boolean(snapshot.upstream),
          setUpstreamDefault: !snapshot.upstream,
          remoteOid: reviewedRemoteOid,
          expectedLeaseOid: reviewedRemoteOid,
          ahead: diverged ? 2 : snapshot.ahead,
          behind: diverged ? 1 : snapshot.behind,
          fastForward: diverged ? false : true,
          newBranch: false,
          commits: [],
          remoteOnlyCommits: diverged
            ? [
                {
                  oid: divergedRemoteOid,
                  subject: "Remote-only fixture commit",
                },
              ]
            : [],
          protectedBranch: ["main", "master", "production", "release"].includes(destinationBranch),
          checkedAtMs: Date.now(),
          remoteStateError: null,
          warnings: diverged ? ["QA fixture: destination contains remote-only history."] : [],
        };
      }
      return gitBridge.loadPushPreview(activeSnapshot().id, remote, remoteRef, localRevision);
    },
    [activeSnapshot, fixture, gitBridge],
  );

  const loadHistoryRewritePreview = useCallback(
    async (fromRevision: string): Promise<HistoryRewritePreview> => {
      if (fixture) {
        const repository = activeSession?.repository;
        if (!repository) throw new Error("Open a repository first");
        const start = repository.commits.findIndex((commit) => commit.oid === fromRevision);
        const commits = (
          start < 0 ? repository.commits : repository.commits.slice(0, start + 1)
        ).toReversed();
        const upstreamBoundary = repository.status.ahead;
        return {
          branch: repository.snapshot.currentBranch ?? "main",
          headOid: repository.snapshot.headOid ?? commits.at(-1)?.oid ?? fromRevision,
          base: commits[0]?.parents[0] ?? null,
          root: (commits[0]?.parents.length ?? 0) === 0,
          entries: commits.map((commit, index) => ({
            oid: commit.oid,
            subject: commit.subject,
            parents: [...commit.parents],
            action: "pick",
            message: null,
            published: index < Math.max(0, commits.length - upstreamBoundary),
            mergeCommit: commit.parents.length > 1,
          })),
          publishedCommitCount: Math.max(0, commits.length - upstreamBoundary),
          descendantCount: commits.length,
          dependentRefs: [],
          hasMerges: commits.some((commit) => commit.parents.length > 1),
          protectedBranch: ["main", "master", "production", "release"].includes(
            repository.snapshot.currentBranch ?? "",
          ),
          warnings: [],
        };
      }
      return gitBridge.loadHistoryRewritePreview(activeSnapshot().id, fromRevision);
    },
    [activeSession?.repository, activeSnapshot, fixture, gitBridge],
  );

  const reload = useCallback(async (): Promise<void> => {
    if (!activeSession) return;
    const repositoryId = activeSession.repository.snapshot.id;
    const activityId = beginActivity(repositoryId, "Refreshing repository", {
      kind: "reload",
      repositoryId,
    });
    try {
      await refreshCoordinator.flush(repositoryId);
      await refreshAll(repositoryId);
      finishActivity(activityId, "succeeded");
    } catch (error) {
      const message = sanitizeGitError(error);
      setState((current) =>
        updateRepositorySession(current, repositoryId, (session) => ({
          ...session,
          status: "ready",
          error: message,
        })),
      );
      finishActivity(activityId, "failed", message);
    }
  }, [activeSession, beginActivity, finishActivity, refreshAll, refreshCoordinator, setState]);

  const loadLog = useCallback(
    async (filters: LogFilters, order: LogOrder, append: boolean): Promise<void> => {
      if (fixture) return;
      const snapshot = activeSnapshot();
      const selection = { filters, order } satisfies LogSelection;
      const activityId = beginActivity(
        snapshot.id,
        append ? "Loading more history" : "Searching history",
        {
          kind: "log",
          repositoryId: snapshot.id,
          filters,
          order,
          append,
        },
      );
      runtime.logSelections.set(snapshot.id, selection);
      const generation = (runtime.logGenerations.get(snapshot.id) ?? 0) + 1;
      runtime.logGenerations.set(snapshot.id, generation);
      const previousRequest = runtime.activeLogRequests.get(snapshot.id);
      if (previousRequest) await cancelRequests(gitBridge, [previousRequest]);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          logLoading: true,
          logError: null,
        })),
      );
      const skip = append ? (runtime.logCommitCounts.get(snapshot.id) ?? 0) : 0;
      try {
        const output = await runRequest(createLogRequest(snapshot.id, selection, skip), {
          activityId,
          onStarted: (requestId) => {
            if (runtime.logGenerations.get(snapshot.id) === generation) {
              runtime.activeLogRequests.set(snapshot.id, requestId);
            } else {
              void cancelRequests(gitBridge, [requestId]);
            }
          },
        });
        if (runtime.logGenerations.get(snapshot.id) !== generation) return;
        const page = parseLog(output);
        setState((current) =>
          updateRepositorySession(current, snapshot.id, (session) => {
            const known = new Set(session.repository.commits.map((commit) => commit.oid));
            const commits = append
              ? [...session.repository.commits, ...page.filter((commit) => !known.has(commit.oid))]
              : page;
            return {
              ...session,
              repository: { ...session.repository, commits },
              hasMoreCommits: page.length === 500,
            };
          }),
        );
        finishActivity(activityId, "succeeded");
      } catch (error) {
        if (isGitRequestCancelled(error)) {
          finishActivity(activityId, "cancelled");
        }
        if (
          runtime.logGenerations.get(snapshot.id) === generation &&
          !isGitRequestCancelled(error)
        ) {
          const message = sanitizeGitError(error);
          setState((current) =>
            updateRepositorySession(current, snapshot.id, (session) => ({
              ...session,
              logError: message,
            })),
          );
          finishActivity(activityId, "failed", message);
        }
      } finally {
        if (runtime.logGenerations.get(snapshot.id) === generation) {
          runtime.activeLogRequests.delete(snapshot.id);
          setState((current) =>
            updateRepositorySession(current, snapshot.id, (session) => ({
              ...session,
              logLoading: false,
            })),
          );
        }
      }
    },
    [
      activeSnapshot,
      beginActivity,
      finishActivity,
      fixture,
      runRequest,
      gitBridge,
      runtime,
      setState,
    ],
  );

  const indexLog = useCallback(
    async (filters: LogFilters, order: LogOrder): Promise<void> => {
      if (fixture) return;
      const snapshot = activeSnapshot();
      const selection = { filters, order } satisfies LogSelection;
      const activityId = beginActivity(snapshot.id, "Indexing Git history", {
        kind: "log",
        repositoryId: snapshot.id,
        filters,
        order,
        append: false,
      });
      runtime.logSelections.set(snapshot.id, selection);
      const generation = (runtime.logGenerations.get(snapshot.id) ?? 0) + 1;
      runtime.logGenerations.set(snapshot.id, generation);
      const previousRequest = runtime.activeLogRequests.get(snapshot.id);
      if (previousRequest) await cancelRequests(gitBridge, [previousRequest]);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          logLoading: true,
          logError: null,
        })),
      );
      try {
        let skip = 0;
        let indexed: readonly Commit[] = [];
        let hasMore = true;
        while (hasMore && runtime.logGenerations.get(snapshot.id) === generation) {
          const output = await runRequest(createLogRequest(snapshot.id, selection, skip), {
            activityId,
            onStarted: (requestId) => {
              if (runtime.logGenerations.get(snapshot.id) === generation) {
                runtime.activeLogRequests.set(snapshot.id, requestId);
              } else {
                void cancelRequests(gitBridge, [requestId]);
              }
            },
          });
          if (runtime.logGenerations.get(snapshot.id) !== generation) {
            return;
          }
          const page = parseLog(output);
          const known = new Set(indexed.map((commit) => commit.oid));
          indexed = [...indexed, ...page.filter((commit) => !known.has(commit.oid))];
          skip += page.length;
          hasMore = page.length === 500;
          setState((current) =>
            updateRepositorySession(current, snapshot.id, (session) => ({
              ...session,
              repository: {
                ...session.repository,
                commits: indexed,
              },
              hasMoreCommits: hasMore,
            })),
          );
        }
        finishActivity(activityId, "succeeded");
      } catch (error) {
        if (isGitRequestCancelled(error)) {
          finishActivity(activityId, "cancelled");
        } else if (runtime.logGenerations.get(snapshot.id) === generation) {
          const message = sanitizeGitError(error);
          setState((current) =>
            updateRepositorySession(current, snapshot.id, (session) => ({
              ...session,
              logError: message,
            })),
          );
          finishActivity(activityId, "failed", message);
        }
      } finally {
        if (runtime.logGenerations.get(snapshot.id) === generation) {
          runtime.activeLogRequests.delete(snapshot.id);
          setState((current) =>
            updateRepositorySession(current, snapshot.id, (session) => ({
              ...session,
              logLoading: false,
            })),
          );
        }
      }
    },
    [
      activeSnapshot,
      beginActivity,
      finishActivity,
      fixture,
      runRequest,
      gitBridge,
      runtime,
      setState,
    ],
  );

  const {
    loadCommitFiles,
    loadCommitDiff,
    loadWorkingDiff,
    loadLocalChangesPatch,
    loadRevisionDiff,
    listLocalHistoryActivities,
    readLocalHistoryActivity,
    loadLocalHistoryDiff,
    revertLocalHistory,
    createLocalHistoryPatch,
    putLocalHistoryLabel,
    exportPatch,
    createPatchText,
    importPatch,
    loadTree,
    loadFiles,
    searchProjectText,
    loadFileHistory,
    loadBlame,
    readFile,
    readFilePreview,
    writeWorkingTreeFile,
    loadSubmoduleDiff,
    openWorkingTreeFile,
    loadStashFiles,
    loadStashPatch,
  } = useGitSessionQueryActions({
    activeSnapshot,
    fixture,
    gitBridge,
    refreshAll,
    refreshCoordinator,
    runRequest,
    runtime,
  });

  const {
    createShelf,
    applyShelf,
    deleteShelf,
    saveChangelist,
    deleteChangelist,
    commitChangelist,
    preCommitCheck,
    loadGitConfig,
    loadSubmodules,
    loadMergedBranches,
    readIgnoreRules,
    writeIgnoreRules,
    compareBranches,
    loadCommitSignature,
    restoreRecoveryEntry,
    abortOperation,
    readConflict,
    saveConflictResult,
    resolveBinaryConflict,
    executeSynchronizedBranchOperation,
    applyMultiRootRollback,
  } = useGitSessionMutationActions({
    activeSession,
    activeSnapshot,
    executeOperation,
    fixture,
    gitBridge,
    refreshCoordinator,
    setState,
  });

  const cancelActivity = useCallback(async (): Promise<void> => {
    if (!activity || activity.status !== "running") return;
    const requestIds = activity.requestIds;
    if (requestIds.length === 0) return;
    setActivity((current) =>
      current?.id === activity.id ? { ...current, requestIds: [] } : current,
    );
    const results = await cancelRequests(gitBridge, requestIds);
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failed) finishActivity(activity.id, "failed", sanitizeGitError(failed.reason));
  }, [activity, finishActivity, setActivity, gitBridge]);

  const retryActivity = useCallback(async (): Promise<void> => {
    const retry = runtime.activityRetry;
    if (!activity || retry?.activityId !== activity.id) return;
    if (runtime.activeSnapshot?.id !== retry.retry.repositoryId) {
      finishActivity(activity.id, "failed", "Open the repository before retrying this operation.");
      return;
    }
    dismissActivity(activity.id);
    if (retry.retry.kind === "operation") {
      await executeOperation(retry.retry.operation);
    } else if (retry.retry.kind === "log") {
      await loadLog(retry.retry.filters, retry.retry.order, retry.retry.append);
    } else {
      await reload();
    }
  }, [activity, dismissActivity, executeOperation, finishActivity, loadLog, reload, runtime]);

  const dismissError = useCallback((): void => {
    setState((current) => {
      const repositoryId = runtime.activeRepositoryId;
      const withoutRepositoryError = repositoryId
        ? updateRepositorySession(current, repositoryId, (session) => ({
            ...session,
            error: null,
          }))
        : current;
      return withoutRepositoryError.error === null
        ? withoutRepositoryError
        : { ...withoutRepositoryError, error: null };
    });
  }, [runtime, setState]);

  const dismissNotice = useCallback((): void => {
    setState((current) => ({ ...current, notice: null }));
  }, [setState]);

  const removeRecentProject = useCallback(
    (path: string): void => {
      const openInSafeMode = state.sessions.some(
        (session) =>
          session.kind === "repository" &&
          session.repository.snapshot.path === path &&
          repositoryAccessPolicy.mode(session.repository.snapshot.id) === "safe",
      );
      if (!openInSafeMode) repositoryAccessPolicy.forgetPath(path);
      setState((current) => ({
        ...current,
        recentProjects: current.recentProjects.filter((project) => project.path !== path),
      }));
    },
    [state.sessions, setState],
  );

  const openRepositories = state.sessions.flatMap((session) =>
    session.kind === "repository" ? [session.repository.snapshot] : [],
  );
  const accessMode: RepositoryAccessMode =
    activeSession === null
      ? "trusted"
      : repositoryAccessPolicy.mode(activeSession.repository.snapshot.id);
  const activeActivity =
    activity?.repositoryId === activeSession?.repository.snapshot.id ? activity : null;
  const activeGitConsoleEntries = gitConsoleEntries.filter(
    (entry) => entry.repositoryId === activeSession?.repository.snapshot.id,
  );
  const capabilities = {
    workspace: {
      sessions: state.sessions,
      activeTab: state.activeTab,
      recentProjects: state.recentProjects,
      restoring: state.restoring,
      error: state.error ?? activeSession?.error ?? null,
      notice: state.notice ?? null,
      openRepositories,
      openRepository,
      initializeRepository,
      cloneRepository,
      cancelRepositoryCreation,
      activateTab,
      closeRepository,
      closeProject,
      switchRepository,
      removeRecentProject,
      dismissError,
      dismissNotice,
    },
    repository: {
      fixture,
      accessMode,
      repository: activeSession?.repository ?? null,
      repositoryError: activeErrorSession,
      loading: activeSession?.status === "loading",
      stale: activeSession?.stale ?? false,
      hasMoreCommits: activeSession?.hasMoreCommits ?? false,
      logLoading: activeSession?.logLoading ?? false,
      logError: activeSession?.logError ?? null,
      shelves: activeSession?.shelves ?? EMPTY_ARRAY,
      stashes: activeSession?.stashes ?? EMPTY_ARRAY,
      changelists: activeSession?.changelists ?? EMPTY_ARRAY,
      recoveryEntries: activeSession?.recoveryEntries ?? EMPTY_ARRAY,
      conflicts: activeSession?.conflicts ?? EMPTY_ARRAY,
      remotes: (activeSession ?? managementSession)?.remotes ?? EMPTY_ARRAY,
      worktrees: (activeSession ?? managementSession)?.worktrees ?? EMPTY_ARRAY,
    },
    queries: {
      reload,
      loadLog,
      indexLog,
      loadCommitFiles,
      loadCommitDiff,
      loadWorkingDiff,
      loadLocalChangesPatch,
      loadRevisionDiff,
      listLocalHistoryActivities,
      readLocalHistoryActivity,
      loadLocalHistoryDiff,
      createLocalHistoryPatch,
      exportPatch,
      createPatchText,
      loadFiles,
      searchProjectText,
      loadTree,
      loadFileHistory,
      loadBlame,
      readFile,
      readFilePreview,
      loadSubmoduleDiff,
      openWorkingTreeFile,
      loadStashFiles,
      loadStashPatch,
      loadPushPreview,
      loadHistoryRewritePreview,
      preCommitCheck,
      loadGitConfig,
      loadSubmodules,
      loadMergedBranches,
      readIgnoreRules,
      compareBranches,
      loadCommitSignature,
      readConflict,
    },
    mutations: {
      revertLocalHistory,
      putLocalHistoryLabel,
      importPatch,
      writeWorkingTreeFile,
      executeOperation,
      abortOperation,
      createShelf,
      applyShelf,
      deleteShelf,
      saveChangelist,
      deleteChangelist,
      commitChangelist,
      writeIgnoreRules,
      restoreRecoveryEntry,
      saveConflictResult,
      resolveBinaryConflict,
      executeSynchronizedBranchOperation,
      applyMultiRootRollback,
    },
    activity: {
      current: activeActivity,
      gitConsoleEntries: activeGitConsoleEntries,
      cancel: cancelActivity,
      retry: retryActivity,
      dismiss: dismissActivity,
      clearConsole: clearGitConsole,
    },
  };

  return {
    capabilities,
    sessions: state.sessions,
    activeTab: state.activeTab,
    recentProjects: state.recentProjects,
    restoring: state.restoring,
    error: state.error ?? activeSession?.error ?? null,
    notice: state.notice ?? null,
    fixture,
    accessMode,
    repository: activeSession?.repository ?? null,
    repositoryError: activeErrorSession,
    loading: activeSession?.status === "loading",
    stale: activeSession?.stale ?? false,
    hasMoreCommits: activeSession?.hasMoreCommits ?? false,
    logLoading: activeSession?.logLoading ?? false,
    logError: activeSession?.logError ?? null,
    activity: activeActivity,
    gitConsoleEntries: activeGitConsoleEntries,
    shelves: activeSession?.shelves ?? EMPTY_ARRAY,
    stashes: activeSession?.stashes ?? EMPTY_ARRAY,
    changelists: activeSession?.changelists ?? EMPTY_ARRAY,
    recoveryEntries: activeSession?.recoveryEntries ?? EMPTY_ARRAY,
    conflicts: activeSession?.conflicts ?? EMPTY_ARRAY,
    remotes: (activeSession ?? managementSession)?.remotes ?? EMPTY_ARRAY,
    worktrees: (activeSession ?? managementSession)?.worktrees ?? EMPTY_ARRAY,
    openRepositories,
    openRepository,
    initializeRepository,
    cloneRepository,
    cancelRepositoryCreation,
    activateTab,
    closeRepository,
    closeProject,
    switchRepository,
    removeRecentProject,
    reload,
    loadLog,
    indexLog,
    loadCommitFiles,
    loadCommitDiff,
    loadWorkingDiff,
    loadLocalChangesPatch,
    loadRevisionDiff,
    listLocalHistoryActivities,
    readLocalHistoryActivity,
    loadLocalHistoryDiff,
    revertLocalHistory,
    createLocalHistoryPatch,
    putLocalHistoryLabel,
    exportPatch,
    createPatchText,
    importPatch,
    loadFiles,
    searchProjectText,
    loadTree,
    loadFileHistory,
    loadBlame,
    readFile,
    readFilePreview,
    writeWorkingTreeFile,
    loadSubmoduleDiff,
    openWorkingTreeFile,
    loadStashFiles,
    loadStashPatch,
    executeOperation,
    abortOperation,
    loadPushPreview,
    loadHistoryRewritePreview,
    createShelf,
    applyShelf,
    deleteShelf,
    saveChangelist,
    deleteChangelist,
    commitChangelist,
    preCommitCheck,
    loadGitConfig,
    loadSubmodules,
    loadMergedBranches,
    readIgnoreRules,
    writeIgnoreRules,
    compareBranches,
    loadCommitSignature,
    restoreRecoveryEntry,
    readConflict,
    saveConflictResult,
    resolveBinaryConflict,
    executeSynchronizedBranchOperation,
    applyMultiRootRollback,
    cancelActivity,
    retryActivity,
    dismissActivity,
    dismissError,
    dismissNotice,
    clearGitConsole,
  };
}

export type GitSessionController = ReturnType<typeof useGitSessionController>;
export type GitSessionCapabilities = GitSessionController["capabilities"];
