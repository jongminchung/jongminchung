import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createGitBridge } from "../bridge/createGitBridge";
import { assertLiveRepositoryActionAllowed } from "../domain/fixtureMode";
import {
  GitRequestCancelledError,
  isGitRequestCancelled,
  isRetryableOperation,
  operationActivityLabel,
  sanitizeGitError,
} from "../domain/gitActivity";
import type { GitActivity } from "../domain/gitActivity";
import { recordGitConsoleEvent } from "../domain/gitConsole";
import type { GitConsoleEntry } from "../domain/gitConsole";
import { GitRequestEventBuffer } from "../domain/gitRequestEvents";
import {
  parseBlame,
  parseCommitFiles,
  parseFileHistory,
  parseLog,
  parseNameStatus,
  parseRefs,
  parseStashList,
  parseStatusV2,
  parseTree,
} from "../domain/parsers";
import { closeProjectResources } from "../domain/projectClose";
import {
  parseProjectTextMatches,
  type ProjectSearchOptions,
  type ProjectTextMatch,
} from "../domain/projectSearch";
import { updateRecentProjects } from "../domain/recentProjects";
import type { RecentProject } from "../domain/recentProjects";
import { RefreshCoordinator } from "../domain/RefreshCoordinator";
import { updateRepositoryView } from "../domain/repositoryView";
import { terminalService } from "../domain/TerminalService";
import type {
  BlameLine,
  Commit,
  FileChange,
  RepositoryView,
  StashEntry,
  TreeEntry,
} from "../domain/types";
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
import { electronApi, isElectronRuntime } from "../platform/electron";
import { readElectronSetting, writeElectronSettings } from "../platform/electronSettings";
import type {
  GitCreationEventListener,
  GitLocalHistoryActivitiesPage,
  GitLocalHistoryActivity,
  GitLocalHistoryActivityDetail,
  GitLocalHistoryScope,
} from "../shared/contracts/git-utility";
import type {
  Changelist,
  BranchComparison,
  ChangelistCommitResult,
  CloneOptions,
  CommitSignature,
  ConflictContent,
  ConflictFile,
  DiffOptions,
  FileContent,
  FilePreview,
  FileSource,
  GitEvent,
  GitConfig,
  GitOperation,
  GitRequest,
  LogFilters,
  LogOrder,
  IgnoreRules,
  MultiRootOutcome,
  MultiRootResult,
  MultiRootRollbackStep,
  PatchExportResult,
  PreCommitCheck,
  PushPreview,
  HistoryRewritePreview,
  RecoveryEntry,
  RemoteInfo,
  RequestId,
  RepositoryInvalidation,
  RepositorySnapshot,
  ShelfEntry,
  SubmoduleInfo,
  SubmoduleDiff,
  WorktreeInfo,
} from "../shared/contracts/model";
import { RepositoryWatchSession } from "./repository-watch-session";

const gitBridge = createGitBridge();
const EMPTY_ARRAY: readonly never[] = [];

interface RawRepositoryData {
  readonly refs: string;
  readonly log: string;
  readonly status: string;
  readonly stash: string;
}

export type WorkspaceTab =
  | { readonly kind: "welcome" }
  | { readonly kind: "repository"; readonly repositoryId: string }
  | { readonly kind: "error"; readonly sessionId: string };

export interface RepositorySession {
  readonly kind: "repository";
  readonly status: "loading" | "ready";
  readonly repository: RepositoryView;
  readonly shelves: readonly ShelfEntry[];
  readonly stashes: readonly StashEntry[];
  readonly changelists: readonly Changelist[];
  readonly recoveryEntries: readonly RecoveryEntry[];
  readonly conflicts: readonly ConflictFile[];
  readonly remotes: readonly RemoteInfo[];
  readonly worktrees: readonly WorktreeInfo[];
  readonly stale: boolean;
  readonly hasMoreCommits: boolean;
  readonly logLoading: boolean;
  readonly logError: string | null;
  readonly error: string | null;
}

export interface RepositoryErrorSession {
  readonly kind: "error";
  readonly status: "error";
  readonly id: string;
  readonly path: string;
  readonly message: string;
}

export type WorkspaceRepositorySession = RepositorySession | RepositoryErrorSession;

interface WorkspaceState {
  readonly sessions: readonly WorkspaceRepositorySession[];
  readonly activeTab: WorkspaceTab;
  readonly recentProjects: readonly RecentProject[];
  readonly restoring: boolean;
  readonly error: string | null;
  readonly notice?: string | null;
}

function fixtureEnabled(): boolean {
  const api = electronApi();
  if (api !== null) return api.runtime.qaFixture;
  return new URLSearchParams(window.location.search).get("fixture") === "qa";
}

const WELCOME_RECENT_PROJECT_FIXTURE: RecentProject = Object.freeze({
  path: "/Users/jaime/workspace/gcloud-manifest/services/gcloud-cloudlog",
  name: "gcloud-cloudlog",
  branch: "feat/opensearch",
  lastOpenedAt: 1,
});

function welcomeRecentFixtureEnabled(): boolean {
  return (
    !isElectronRuntime() &&
    new URLSearchParams(window.location.search).get("fixture") === "welcome-recent"
  );
}

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

function initialState(): WorkspaceState {
  const welcomeRecentFixture = welcomeRecentFixtureEnabled();
  return {
    sessions: [],
    activeTab: { kind: "welcome" },
    recentProjects: welcomeRecentFixture ? [WELCOME_RECENT_PROJECT_FIXTURE] : [],
    restoring: fixtureEnabled() || (!welcomeRecentFixture && isElectronRuntime()),
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

interface LogSelection {
  readonly filters: LogFilters;
  readonly order: LogOrder;
}

interface RunRequestOptions {
  readonly activityId?: string;
  readonly onStarted?: (requestId: RequestId) => void;
}

type ActivityRetry =
  | { readonly kind: "reload"; readonly repositoryId: string }
  | {
      readonly kind: "log";
      readonly repositoryId: string;
      readonly filters: LogFilters;
      readonly order: LogOrder;
      readonly append: boolean;
    }
  | {
      readonly kind: "operation";
      readonly repositoryId: string;
      readonly operation: GitOperation;
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

function invalidationsForOperation(operation: GitOperation): readonly RepositoryInvalidation[] {
  if (
    operation.kind === "stage" ||
    operation.kind === "stageAll" ||
    operation.kind === "stageTracked" ||
    operation.kind === "addIntent" ||
    operation.kind === "unstage" ||
    operation.kind === "removeCached" ||
    operation.kind === "discard" ||
    operation.kind === "applyPatch" ||
    operation.kind === "partialPatch"
  ) {
    return ["status"];
  }
  if (
    operation.kind === "stashPush" ||
    operation.kind === "stashApply" ||
    operation.kind === "stashDrop" ||
    operation.kind === "stashClear" ||
    operation.kind === "stashBranch"
  ) {
    return ["status", "history", "stash"];
  }
  if (
    operation.kind === "worktreeAdd" ||
    operation.kind === "worktreeRemove" ||
    operation.kind === "remoteAdd" ||
    operation.kind === "remoteRemove" ||
    operation.kind === "remoteSetUrl"
  ) {
    return ["status", "history", "management"];
  }
  if (operation.kind === "push") {
    return ["status", "history"];
  }
  return ["status", "history", "operation"];
}

function recordsRecovery(operation: GitOperation): boolean {
  return (
    operation.kind === "commit" ||
    operation.kind === "commitAdvanced" ||
    operation.kind === "reset" ||
    operation.kind === "revert" ||
    operation.kind === "cherryPick" ||
    operation.kind === "merge" ||
    operation.kind === "rebase" ||
    operation.kind === "interactiveRebase" ||
    operation.kind === "dropCommits" ||
    operation.kind === "squashCommits" ||
    operation.kind === "rewordCommit" ||
    operation.kind === "undoCommit" ||
    operation.kind === "createFixupCommit" ||
    operation.kind === "createSquashCommit" ||
    operation.kind === "continue" ||
    operation.kind === "skip" ||
    operation.kind === "abort" ||
    operation.kind === "createBranch" ||
    operation.kind === "renameBranch" ||
    operation.kind === "deleteBranch" ||
    operation.kind === "createTag" ||
    operation.kind === "deleteTag" ||
    operation.kind === "stashPush" ||
    operation.kind === "stashApply" ||
    operation.kind === "stashDrop" ||
    operation.kind === "stashClear" ||
    operation.kind === "stashBranch"
  );
}

async function cancelRequests(
  requestIds: readonly RequestId[],
): Promise<readonly PromiseSettledResult<void>[]> {
  return Promise.allSettled(requestIds.map((requestId) => gitBridge.cancel(requestId)));
}

export function useGitSession() {
  const fixture = fixtureEnabled();
  const welcomeRecentFixture = welcomeRecentFixtureEnabled();
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [activity, setActivity] = useState<GitActivity | null>(null);
  const [gitConsoleEntries, setGitConsoleEntries] = useState<readonly GitConsoleEntry[]>([]);
  const activeRepositoryId = useRef<string | null>(
    state.activeTab.kind === "repository" ? state.activeTab.repositoryId : null,
  );
  const activeSnapshotRef = useRef<RepositorySnapshot | null>(null);
  const repositoryWatchSession = useRef(new RepositoryWatchSession());
  const refreshInFlight = useRef(new Map<string, Promise<void>>());
  const rawRepositoryData = useRef(new Map<string, RawRepositoryData>());
  const logSelections = useRef(new Map<string, LogSelection>());
  const logCommitCounts = useRef(new Map<string, number>());
  const logGenerations = useRef(new Map<string, number>());
  const activeLogRequests = useRef(new Map<string, RequestId>());
  const activeSearchRequest = useRef<RequestId | null>(null);
  const activityRetry = useRef<{
    readonly activityId: string;
    readonly retry: ActivityRetry;
  } | null>(null);
  const restored = useRef(false);

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
  const recentProjectsJson = JSON.stringify(state.recentProjects);
  const activeRepositoryPath =
    activeSession?.repository.snapshot.path ?? activeErrorSession?.path ?? null;

  useEffect(() => {
    activeRepositoryId.current = activeSession?.repository.snapshot.id ?? null;
    activeSnapshotRef.current =
      activeSession?.repository.snapshot ?? managementSession?.repository.snapshot ?? null;
    if (activeSession) {
      logCommitCounts.current.set(
        activeSession.repository.snapshot.id,
        activeSession.repository.commits.length,
      );
    }
  }, [
    activeSession?.repository.commits.length,
    activeSession?.repository.snapshot,
    managementSession?.repository.snapshot,
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
  }, [fixture]);

  const beginActivity = useCallback(
    (repositoryId: string, label: string, retry: ActivityRetry | null): string => {
      const id = crypto.randomUUID();
      activityRetry.current = retry ? { activityId: id, retry } : null;
      setActivity({
        id,
        repositoryId,
        label,
        status: "running",
        startedAt: Date.now(),
        requestIds: [],
        error: null,
        canRetry: retry !== null,
      });
      return id;
    },
    [],
  );

  const attachActivityRequest = useCallback((activityId: string, requestId: RequestId): void => {
    setActivity((current) => {
      if (current?.id !== activityId || current.requestIds.includes(requestId)) return current;
      return {
        ...current,
        requestIds: [...current.requestIds, requestId],
      };
    });
  }, []);

  const finishActivity = useCallback(
    (
      activityId: string,
      status: Exclude<GitActivity["status"], "running">,
      error: string | null = null,
    ): void => {
      setActivity((current) =>
        current?.id === activityId ? { ...current, status, requestIds: [], error } : current,
      );
    },
    [],
  );

  const dismissActivity = useCallback((activityId?: string): void => {
    setActivity((current) => {
      if (!current || (activityId && current.id !== activityId)) return current;
      if (activityRetry.current?.activityId === current.id) activityRetry.current = null;
      return null;
    });
  }, []);

  const recordConsoleEvent = useCallback((request: GitRequest, event: GitEvent): void => {
    setGitConsoleEntries((current) => recordGitConsoleEvent(current, request, event, Date.now()));
  }, []);

  const clearGitConsole = useCallback((repositoryId?: string): void => {
    const target = repositoryId ?? activeRepositoryId.current;
    if (!target) return;
    setGitConsoleEntries((current) => current.filter((entry) => entry.repositoryId !== target));
  }, []);

  useEffect(() => {
    if (!activity || (activity.status !== "succeeded" && activity.status !== "cancelled")) return;
    const timeout = window.setTimeout(() => dismissActivity(activity.id), 2_000);
    return () => window.clearTimeout(timeout);
  }, [activity, dismissActivity]);

  const runRequest = useCallback(
    async (request: GitRequest, options: RunRequestOptions = {}): Promise<string> => {
      if (fixture) {
        const { samplePatch } = await requireFixtureData();
        return request.kind === "diff" ? samplePatch : "";
      }
      return new Promise((resolve, reject) => {
        const eventBuffer = new GitRequestEventBuffer();
        let settled = false;
        let announcedRequestId: RequestId | null = null;
        const announceRequest = (requestId: RequestId): void => {
          if (announcedRequestId === requestId) return;
          announcedRequestId = requestId;
          options.onStarted?.(requestId);
          if (options.activityId) attachActivityRequest(options.activityId, requestId);
        };
        const resolveOnce = (output: string): void => {
          if (settled) return;
          settled = true;
          resolve(output);
        };
        const rejectOnce = (error: unknown): void => {
          if (settled) return;
          settled = true;
          eventBuffer.clear();
          reject(error);
        };
        const onEvent = (event: GitEvent): void => {
          announceRequest(event.requestId);
          const result = eventBuffer.consume(event);
          try {
            recordConsoleEvent(request, event);
          } catch (error) {
            console.warn("Could not record Git console event", error);
          }
          if (result.kind === "completed") {
            resolveOnce(result.output);
          } else if (result.kind === "cancelled") {
            rejectOnce(new GitRequestCancelledError());
          } else if (result.kind === "failed") {
            rejectOnce(new Error(result.message));
          }
        };
        const execute = async (): Promise<void> => {
          try {
            announceRequest(await gitBridge.execute(request, onEvent));
          } catch (error) {
            rejectOnce(error);
          }
        };
        void execute();
      });
    },
    [attachActivityRequest, fixture, recordConsoleEvent],
  );

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
        runRequest(createLogRequest(repositoryId, logSelections.current.get(repositoryId))),
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
      rawRepositoryData.current.set(repositoryId, {
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
    [fixture, runRequest],
  );

  const refreshOnce = useCallback(
    (repositoryId: string): Promise<void> => {
      const existing = refreshInFlight.current.get(repositoryId);
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
          refreshInFlight.current.delete(repositoryId);
        }
      };
      const task = run();
      refreshInFlight.current.set(repositoryId, task);
      return task;
    },
    [refreshAll],
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
          ? runRequest(createLogRequest(repositoryId, logSelections.current.get(repositoryId)))
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
      const previousRaw = rawRepositoryData.current.get(repositoryId);
      const statusChanged = statusOutput !== null && statusOutput !== previousRaw?.status;
      const refsChanged = refsOutput !== null && refsOutput !== previousRaw?.refs;
      const logChanged = logOutput !== null && logOutput !== previousRaw?.log;
      const stashChanged = stashOutput !== null && stashOutput !== previousRaw?.stash;
      rawRepositoryData.current.set(repositoryId, {
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
    [fixture, runRequest],
  );

  const refreshInvalidationsRef = useRef(refreshInvalidations);
  refreshInvalidationsRef.current = refreshInvalidations;
  const refreshCoordinator = useMemo(
    () =>
      RefreshCoordinator.of(
        (repositoryId, invalidations) =>
          refreshInvalidationsRef.current(repositoryId, invalidations),
        (repositoryId, error) => {
          setState((current) =>
            updateRepositorySession(current, repositoryId, (session) => ({
              ...session,
              error: sanitizeGitError(error),
            })),
          );
        },
      ),
    [],
  );

  const watch = useCallback(
    async (snapshot: RepositorySnapshot): Promise<void> => {
      if (fixture) return;
      await repositoryWatchSession.current.ensure(snapshot.id, () =>
        gitBridge.watchRepository(snapshot.id, (event) => {
          const recordAndRefresh = async (): Promise<void> => {
            if (activeRepositoryId.current === snapshot.id) {
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
    [fixture, refreshCoordinator],
  );

  const addSnapshot = useCallback(
    async (snapshot: RepositorySnapshot, activate: boolean): Promise<void> => {
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
    [refreshOnce, watch],
  );

  useEffect(() => {
    if (fixture || welcomeRecentFixture || !isElectronRuntime() || restored.current) return;
    restored.current = true;
    const restore = async (): Promise<void> => {
      try {
        const startup = await loadWorkspaceStartupState(readElectronSetting);
        const results = await Promise.allSettled(
          startup.openRepositoryPaths.map((path) => gitBridge.openRepository(path)),
        );
        const snapshots = results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
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
        setState({
          sessions,
          activeTab: restoredWorkspaceTab(sessions, startup.activeRepositoryPath),
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
  }, [fixture, refreshOnce, watch, welcomeRecentFixture]);

  useEffect(() => {
    if (fixture || welcomeRecentFixture || !isElectronRuntime() || state.restoring) return;
    const persist = async (): Promise<void> => {
      await writeElectronSettings({
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        openRepositoryPaths: JSON.parse(openRepositoryPathsJson),
        activeRepositoryPath,
        recentProjects: JSON.parse(recentProjectsJson),
      });
    };
    void persist();
  }, [
    activeRepositoryPath,
    fixture,
    openRepositoryPathsJson,
    recentProjectsJson,
    state.restoring,
    welcomeRecentFixture,
  ]);

  useEffect(
    () => () => {
      for (const repositoryId of repositoryWatchSession.current.trackedRepositoryIds()) {
        repositoryWatchSession.current.forget(repositoryId);
        void gitBridge.unwatchRepository(repositoryId);
      }
    },
    [],
  );

  const openRepository = useCallback(
    async (path: string): Promise<void> => {
      try {
        assertLiveRepositoryActionAllowed(fixture);
        await addSnapshot(await gitBridge.openRepository(path), true);
      } catch (error) {
        setState((current) => ({
          ...current,
          error: sanitizeGitError(error),
        }));
      }
    },
    [addSnapshot, fixture],
  );

  const initializeRepository = useCallback(
    async (path: string, bare: boolean, onEvent?: GitCreationEventListener): Promise<void> => {
      try {
        assertLiveRepositoryActionAllowed(fixture);
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
    [addSnapshot, fixture],
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
    [addSnapshot, fixture],
  );

  const cancelRepositoryCreation = useCallback(async (requestId: RequestId): Promise<void> => {
    await gitBridge.cancel(requestId);
  }, []);

  const activateTab = useCallback(
    async (tab: WorkspaceTab): Promise<void> => {
      activeRepositoryId.current = tab.kind === "repository" ? tab.repositoryId : null;
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
    [refreshCoordinator, state.sessions],
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
        repositoryWatchSession.current.forget(sessionId);
        refreshCoordinator.forget(sessionId);
        rawRepositoryData.current.delete(sessionId);
        logSelections.current.delete(sessionId);
        logCommitCounts.current.delete(sessionId);
        logGenerations.current.delete(sessionId);
        activeLogRequests.current.delete(sessionId);
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
    [fixture, refreshCoordinator, state.sessions],
  );

  const closeProject = useCallback(async (): Promise<void> => {
    const repositoryIds = state.sessions.flatMap((session) =>
      session.kind === "repository" ? [session.repository.snapshot.id] : [],
    );
    await closeProjectResources(repositoryIds, {
      unwatchRepository: (repositoryId) =>
        fixture ? Promise.resolve() : gitBridge.unwatchRepository(repositoryId),
      closeRepositoryTerminals: (repositoryId) =>
        fixture ? Promise.resolve() : terminalService.closeRepository(repositoryId),
      forgetRepository: (repositoryId) => {
        repositoryWatchSession.current.forget(repositoryId);
        refreshCoordinator.forget(repositoryId);
        rawRepositoryData.current.delete(repositoryId);
        logSelections.current.delete(repositoryId);
        logCommitCounts.current.delete(repositoryId);
        logGenerations.current.delete(repositoryId);
        activeLogRequests.current.delete(repositoryId);
      },
    });
    activeRepositoryId.current = null;
    activeSnapshotRef.current = null;
    setState((current) => ({
      ...current,
      sessions: [],
      activeTab: { kind: "welcome" },
    }));
  }, [fixture, refreshCoordinator, state.sessions]);

  const activeSnapshot = useCallback((): RepositorySnapshot => {
    const snapshot = activeSnapshotRef.current;
    if (!snapshot) throw new Error("Open a repository first");
    return snapshot;
  }, []);

  const executeOperation = useCallback(
    async (operation: GitOperation, throwOnError = false): Promise<void> => {
      if (fixture) return;
      const snapshot = activeSnapshot();
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
        refreshCoordinator.invalidate(snapshot.id, invalidationsForOperation(operation));
        const recoveryEntries = recordsRecovery(operation)
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
        const message = sanitizeGitError(error);
        setState((current) =>
          updateRepositorySession(current, snapshot.id, (session) => ({
            ...session,
            error: message,
          })),
        );
        finishActivity(activityId, "failed", message);
        if (throwOnError) throw new Error(message);
      }
    },
    [activeSnapshot, beginActivity, finishActivity, fixture, refreshCoordinator, runRequest],
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
    [activeSnapshot, fixture],
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
    [activeSession?.repository, activeSnapshot, fixture],
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
  }, [activeSession, beginActivity, finishActivity, refreshAll, refreshCoordinator]);

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
      logSelections.current.set(snapshot.id, selection);
      const generation = (logGenerations.current.get(snapshot.id) ?? 0) + 1;
      logGenerations.current.set(snapshot.id, generation);
      const previousRequest = activeLogRequests.current.get(snapshot.id);
      if (previousRequest) await cancelRequests([previousRequest]);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          logLoading: true,
          logError: null,
        })),
      );
      const skip = append ? (logCommitCounts.current.get(snapshot.id) ?? 0) : 0;
      try {
        const output = await runRequest(createLogRequest(snapshot.id, selection, skip), {
          activityId,
          onStarted: (requestId) => {
            if (logGenerations.current.get(snapshot.id) === generation) {
              activeLogRequests.current.set(snapshot.id, requestId);
            } else {
              void cancelRequests([requestId]);
            }
          },
        });
        if (logGenerations.current.get(snapshot.id) !== generation) return;
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
          logGenerations.current.get(snapshot.id) === generation &&
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
        if (logGenerations.current.get(snapshot.id) === generation) {
          activeLogRequests.current.delete(snapshot.id);
          setState((current) =>
            updateRepositorySession(current, snapshot.id, (session) => ({
              ...session,
              logLoading: false,
            })),
          );
        }
      }
    },
    [activeSnapshot, beginActivity, finishActivity, fixture, runRequest],
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
      logSelections.current.set(snapshot.id, selection);
      const generation = (logGenerations.current.get(snapshot.id) ?? 0) + 1;
      logGenerations.current.set(snapshot.id, generation);
      const previousRequest = activeLogRequests.current.get(snapshot.id);
      if (previousRequest) await cancelRequests([previousRequest]);
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
        while (hasMore && logGenerations.current.get(snapshot.id) === generation) {
          const output = await runRequest(createLogRequest(snapshot.id, selection, skip), {
            activityId,
            onStarted: (requestId) => {
              if (logGenerations.current.get(snapshot.id) === generation) {
                activeLogRequests.current.set(snapshot.id, requestId);
              } else {
                void cancelRequests([requestId]);
              }
            },
          });
          if (logGenerations.current.get(snapshot.id) !== generation) {
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
        } else if (logGenerations.current.get(snapshot.id) === generation) {
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
        if (logGenerations.current.get(snapshot.id) === generation) {
          activeLogRequests.current.delete(snapshot.id);
          setState((current) =>
            updateRepositorySession(current, snapshot.id, (session) => ({
              ...session,
              logLoading: false,
            })),
          );
        }
      }
    },
    [activeSnapshot, beginActivity, finishActivity, fixture, runRequest],
  );

  const loadCommitFiles = useCallback(
    async (revision: string): Promise<readonly FileChange[]> => {
      if (fixture) return (await requireFixtureData()).sampleCommitFiles;
      const snapshot = activeSnapshot();
      return parseCommitFiles(
        await runRequest({
          kind: "commitDetails",
          repositoryId: snapshot.id,
          revision,
        }),
      );
    },
    [activeSnapshot, fixture, runRequest],
  );

  const loadCommitDiff = useCallback(
    async (
      commit: Commit,
      path: string,
      options: DiffOptions,
      parentRevision?: string,
    ): Promise<string> => {
      if (fixture) return (await requireFixtureData()).samplePatch;
      const snapshot = activeSnapshot();
      return runRequest({
        kind: "diff",
        repositoryId: snapshot.id,
        from: parentRevision ?? commit.parents[0] ?? "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
        to: commit.oid,
        paths: [path],
        staged: false,
        options,
      });
    },
    [activeSnapshot, fixture, runRequest],
  );

  const loadWorkingDiff = useCallback(
    async (path: string, staged: boolean, options: DiffOptions): Promise<string> => {
      if (fixture) return (await requireFixtureData()).samplePatch;
      const snapshot = activeSnapshot();
      return runRequest({
        kind: "diff",
        repositoryId: snapshot.id,
        from: null,
        to: null,
        paths: [path],
        staged,
        options,
      });
    },
    [activeSnapshot, fixture, runRequest],
  );

  const loadLocalChangesPatch = useCallback(async (): Promise<string> => {
    if (fixture) return (await requireFixtureData()).samplePatch;
    const snapshot = activeSnapshot();
    return runRequest({
      kind: "diff",
      repositoryId: snapshot.id,
      from: snapshot.hasCommits ? "HEAD" : "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
      to: null,
      paths: [],
      staged: false,
      options: { whitespace: "show", contextLines: 3 },
    });
  }, [activeSnapshot, fixture, runRequest]);

  const loadRevisionDiff = useCallback(
    async (
      from: string,
      to: string | null,
      options: DiffOptions,
      paths: readonly string[] = [],
    ): Promise<string> => {
      if (fixture) return (await requireFixtureData()).samplePatch;
      const snapshot = activeSnapshot();
      return runRequest({
        kind: "diff",
        repositoryId: snapshot.id,
        from,
        to,
        paths: [...paths],
        staged: false,
        options,
      });
    },
    [activeSnapshot, fixture, runRequest],
  );

  const listLocalHistoryActivities = useCallback(
    async (
      scope: GitLocalHistoryScope,
      cursor: string | null,
      limit: number,
      query: string,
      showSystemEvents: boolean,
    ): Promise<GitLocalHistoryActivitiesPage> => {
      if (fixture) return { activities: [], nextCursor: null };
      if (gitBridge.listLocalHistoryActivities === undefined)
        throw new Error("Local History is unavailable");
      return gitBridge.listLocalHistoryActivities(scope, cursor, limit, query, showSystemEvents);
    },
    [fixture],
  );

  const readLocalHistoryActivity = useCallback(
    async (activityId: string): Promise<GitLocalHistoryActivityDetail> => {
      if (fixture) throw new Error("Local History requires the native app");
      if (gitBridge.readLocalHistoryActivity === undefined)
        throw new Error("Local History is unavailable");
      return gitBridge.readLocalHistoryActivity(activeSnapshot().id, activityId);
    },
    [activeSnapshot, fixture],
  );

  const loadLocalHistoryDiff = useCallback(
    async (activityId: string, path: string): Promise<string> => {
      if (fixture) return (await requireFixtureData()).samplePatch;
      if (gitBridge.readLocalHistoryDiff === undefined)
        throw new Error("Local History is unavailable");
      return gitBridge.readLocalHistoryDiff(activeSnapshot().id, activityId, path);
    },
    [activeSnapshot, fixture],
  );

  const revertLocalHistory = useCallback(
    async (activityId: string, paths: readonly string[], includeLater: boolean): Promise<void> => {
      if (fixture) throw new Error("Local History requires the native app");
      if (gitBridge.revertLocalHistory === undefined)
        throw new Error("Local History is unavailable");
      const snapshot = activeSnapshot();
      await gitBridge.revertLocalHistory(snapshot.id, activityId, paths, includeLater);
      await refreshAll(snapshot.id);
    },
    [activeSnapshot, fixture, refreshAll],
  );

  const createLocalHistoryPatch = useCallback(
    async (activityId: string, paths: readonly string[]): Promise<string> => {
      if (fixture) throw new Error("Local History requires the native app");
      if (gitBridge.createLocalHistoryPatch === undefined)
        throw new Error("Local History is unavailable");
      return gitBridge.createLocalHistoryPatch(activeSnapshot().id, activityId, paths);
    },
    [activeSnapshot, fixture],
  );

  const putLocalHistoryLabel = useCallback(
    async (label: string): Promise<GitLocalHistoryActivity> => {
      if (fixture) throw new Error("Local History requires the native app");
      if (gitBridge.putLocalHistoryLabel === undefined)
        throw new Error("Local History is unavailable");
      return gitBridge.putLocalHistoryLabel(activeSnapshot().id, label);
    },
    [activeSnapshot, fixture],
  );

  const exportPatch = useCallback(
    async (revisions: readonly string[], targetPath: string): Promise<PatchExportResult> => {
      if (fixture) throw new Error("Patch export requires the native app");
      return gitBridge.exportPatch(activeSnapshot().id, revisions, targetPath);
    },
    [activeSnapshot, fixture],
  );

  const createPatchText = useCallback(
    async (revisions: readonly string[]): Promise<string> => {
      return gitBridge.createPatchText(activeSnapshot().id, revisions);
    },
    [activeSnapshot],
  );

  const importPatch = useCallback(
    async (path: string): Promise<void> => {
      const snapshot = activeSnapshot();
      await gitBridge.importPatch(snapshot.id, path);
      refreshCoordinator.invalidate(snapshot.id, ["status", "history"]);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, refreshCoordinator],
  );

  const loadTree = useCallback(
    async (revision: string, path?: string): Promise<readonly TreeEntry[]> => {
      if (fixture) return [];
      const snapshot = activeSnapshot();
      return parseTree(
        await runRequest({
          kind: "tree",
          repositoryId: snapshot.id,
          revision,
          path: path ?? null,
        }),
      );
    },
    [activeSnapshot, fixture, runRequest],
  );

  const loadFiles = useCallback(async (): Promise<readonly string[]> => {
    if (fixture) return [];
    const snapshot = activeSnapshot();
    const output = await runRequest({
      kind: "files",
      repositoryId: snapshot.id,
    });
    return [...new Set(output.split("\0").filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
  }, [activeSnapshot, fixture, runRequest]);

  const searchProjectText = useCallback(
    async (query: string, options: ProjectSearchOptions): Promise<readonly ProjectTextMatch[]> => {
      const previousRequest = activeSearchRequest.current;
      if (previousRequest !== null) {
        activeSearchRequest.current = null;
        void gitBridge.cancel(previousRequest);
      }
      if (fixture || query.length === 0) return [];
      const snapshot = activeSnapshot();
      let requestId: RequestId | null = null;
      try {
        const output = await runRequest(
          {
            kind: "searchText",
            repositoryId: snapshot.id,
            query,
            options,
          },
          {
            onStarted: (startedRequestId) => {
              requestId = startedRequestId;
              activeSearchRequest.current = startedRequestId;
            },
          },
        );
        return parseProjectTextMatches(output);
      } finally {
        if (requestId !== null && activeSearchRequest.current === requestId) {
          activeSearchRequest.current = null;
        }
      }
    },
    [activeSnapshot, fixture, runRequest],
  );

  const loadFileHistory = useCallback(
    async (path: string): Promise<readonly Commit[]> => {
      if (fixture) return (await requireFixtureData()).sampleRepository.commits.slice(0, 8);
      const snapshot = activeSnapshot();
      return parseFileHistory(
        await runRequest({
          kind: "fileHistory",
          repositoryId: snapshot.id,
          path,
          skip: 0,
          limit: 500,
        }),
      );
    },
    [activeSnapshot, fixture, runRequest],
  );

  const loadBlame = useCallback(
    async (path: string, revision?: string): Promise<readonly BlameLine[]> => {
      if (fixture) return [];
      const snapshot = activeSnapshot();
      return parseBlame(
        await runRequest({
          kind: "blame",
          repositoryId: snapshot.id,
          revision: revision ?? null,
          path,
        }),
      );
    },
    [activeSnapshot, fixture, runRequest],
  );

  const readFile = useCallback(
    async (source: FileSource, path: string): Promise<FileContent> => {
      if (fixture) {
        const { sampleFileContent } = await requireFixtureData();
        const content = sampleFileContent(path, source);
        return {
          kind: "text",
          path,
          content,
          sizeBytes: new TextEncoder().encode(content).byteLength,
          lineCount: content.split("\n").length,
        };
      }
      return gitBridge.readFile(activeSnapshot().id, source, path);
    },
    [activeSnapshot, fixture],
  );

  const readFilePreview = useCallback(
    async (source: FileSource, path: string): Promise<FilePreview> => {
      if (fixture) {
        return { kind: "binary", path, sizeBytes: 0 };
      }
      return gitBridge.readFilePreview(activeSnapshot().id, source, path);
    },
    [activeSnapshot, fixture],
  );

  const writeWorkingTreeFile = useCallback(
    async (path: string, content: string, activityName?: string): Promise<void> => {
      if (fixture) throw new Error("Editing files requires the native app");
      if (gitBridge.writeWorkingTreeFile === undefined)
        throw new Error("File editing is unavailable");
      const snapshot = activeSnapshot();
      await gitBridge.writeWorkingTreeFile(snapshot.id, path, content, activityName);
      refreshCoordinator.invalidate(snapshot.id, ["status"]);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, fixture, refreshCoordinator],
  );

  const loadSubmoduleDiff = useCallback(
    async (before: FileSource, after: FileSource, path: string): Promise<SubmoduleDiff> => {
      if (fixture) {
        return {
          path,
          beforeOid: null,
          afterOid: null,
          beforeSubject: null,
          afterSubject: null,
          ahead: null,
          behind: null,
        };
      }
      return gitBridge.loadSubmoduleDiff(activeSnapshot().id, before, after, path);
    },
    [activeSnapshot, fixture],
  );

  const openWorkingTreeFile = useCallback(
    async (path: string): Promise<void> => {
      if (fixture) return;
      await gitBridge.openWorkingTreeFile(activeSnapshot().id, path);
    },
    [activeSnapshot, fixture],
  );

  const loadStashFiles = useCallback(
    async (stash: string): Promise<readonly FileChange[]> => {
      if (fixture) return (await requireFixtureData()).sampleCommitFiles.slice(0, 2);
      const snapshot = activeSnapshot();
      return parseNameStatus(
        await runRequest({
          kind: "stashShow",
          repositoryId: snapshot.id,
          stash,
          mode: "files",
        }),
      );
    },
    [activeSnapshot, fixture, runRequest],
  );

  const loadStashPatch = useCallback(
    async (stash: string): Promise<string> => {
      if (fixture) return (await requireFixtureData()).samplePatch;
      const snapshot = activeSnapshot();
      return runRequest({
        kind: "stashShow",
        repositoryId: snapshot.id,
        stash,
        mode: "patch",
      });
    },
    [activeSnapshot, fixture, runRequest],
  );

  const mutateAndRefresh = useCallback(
    async (
      mutation: (repositoryId: string) => Promise<unknown>,
      invalidations: readonly RepositoryInvalidation[],
    ): Promise<void> => {
      const snapshot = activeSnapshot();
      await mutation(snapshot.id);
      refreshCoordinator.invalidate(snapshot.id, invalidations);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, refreshCoordinator],
  );

  const createShelf = useCallback(
    async (message: string, paths: readonly string[]): Promise<void> => {
      if (fixture) return;
      const snapshot = activeSnapshot();
      const shelf = await gitBridge.createShelf(snapshot.id, message, paths);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          shelves: [shelf, ...session.shelves.filter((item) => item.id !== shelf.id)],
        })),
      );
      refreshCoordinator.invalidate(snapshot.id, ["status"]);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, fixture, refreshCoordinator],
  );

  const applyShelf = useCallback(
    async (shelfId: string, dropAfterApply: boolean): Promise<void> => {
      if (fixture) return;
      const snapshot = activeSnapshot();
      await gitBridge.applyShelf(snapshot.id, shelfId, dropAfterApply);
      if (dropAfterApply) {
        setState((current) =>
          updateRepositorySession(current, snapshot.id, (session) => ({
            ...session,
            shelves: session.shelves.filter((shelf) => shelf.id !== shelfId),
          })),
        );
      }
      refreshCoordinator.invalidate(snapshot.id, ["status"]);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, fixture, refreshCoordinator],
  );

  const deleteShelf = useCallback(
    async (shelfId: string): Promise<void> => {
      const snapshot = activeSnapshot();
      await gitBridge.deleteShelf(snapshot.id, shelfId);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          shelves: session.shelves.filter((shelf) => shelf.id !== shelfId),
        })),
      );
    },
    [activeSnapshot],
  );

  const saveChangelist = useCallback(
    async (id: string | null, name: string, paths: readonly string[]): Promise<Changelist> => {
      const snapshot = activeSnapshot();
      const saved = await gitBridge.saveChangelist(snapshot.id, id, name, paths);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          changelists: [
            ...session.changelists.filter((changelist) => changelist.id !== saved.id),
            saved,
          ].sort((left, right) => left.createdAtMs - right.createdAtMs),
        })),
      );
      return saved;
    },
    [activeSnapshot],
  );

  const deleteChangelist = useCallback(
    async (changelistId: string): Promise<void> => {
      const snapshot = activeSnapshot();
      await gitBridge.deleteChangelist(snapshot.id, changelistId);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          changelists: session.changelists.filter((changelist) => changelist.id !== changelistId),
        })),
      );
    },
    [activeSnapshot],
  );

  const commitChangelist = useCallback(
    async (
      changelistId: string,
      message: string,
      amend: boolean,
      signOff: boolean,
      gpgSign: boolean,
    ): Promise<ChangelistCommitResult> => {
      const snapshot = activeSnapshot();
      const result = await gitBridge.commitChangelist(
        snapshot.id,
        changelistId,
        message,
        amend,
        signOff,
        gpgSign,
      );
      refreshCoordinator.invalidate(snapshot.id, ["status", "history"]);
      await refreshCoordinator.flush(snapshot.id);
      return result;
    },
    [activeSnapshot, refreshCoordinator],
  );

  const preCommitCheck = useCallback(async (): Promise<PreCommitCheck> => {
    const snapshot = activeSnapshot();
    return gitBridge.preCommitCheck(snapshot.id);
  }, [activeSnapshot]);

  const loadGitConfig = useCallback(async (): Promise<readonly GitConfig[]> => {
    return gitBridge.listGitConfig(activeSnapshot().id);
  }, [activeSnapshot]);

  const loadSubmodules = useCallback(async (): Promise<readonly SubmoduleInfo[]> => {
    return gitBridge.listSubmodules(activeSnapshot().id);
  }, [activeSnapshot]);

  const loadMergedBranches = useCallback(
    async (target: string): Promise<readonly string[]> => {
      return gitBridge.listMergedBranches(activeSnapshot().id, target);
    },
    [activeSnapshot],
  );

  const readIgnoreRules = useCallback(async (): Promise<IgnoreRules> => {
    return gitBridge.readIgnoreRules(activeSnapshot().id);
  }, [activeSnapshot]);

  const writeIgnoreRules = useCallback(
    async (rules: IgnoreRules): Promise<void> => {
      const snapshot = activeSnapshot();
      await gitBridge.writeIgnoreRules(snapshot.id, rules);
      refreshCoordinator.invalidate(snapshot.id, ["status"]);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, refreshCoordinator],
  );

  const compareBranches = useCallback(
    async (left: string, right: string): Promise<BranchComparison> => {
      return gitBridge.compareBranches(activeSnapshot().id, left, right);
    },
    [activeSnapshot],
  );

  const loadCommitSignature = useCallback(
    async (revision: string): Promise<CommitSignature> => {
      return gitBridge.loadCommitSignature(activeSnapshot().id, revision);
    },
    [activeSnapshot],
  );

  const restoreRecoveryEntry = useCallback(
    async (entryId: string): Promise<void> => {
      const snapshot = activeSnapshot();
      await gitBridge.restoreRecoveryEntry(snapshot.id, entryId);
      refreshCoordinator.invalidate(snapshot.id, ["status", "history"]);
      const [recoveryEntries] = await Promise.all([
        gitBridge.listRecoveryEntries(snapshot.id),
        refreshCoordinator.flush(snapshot.id),
      ]);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) =>
          sameValue(recoveryEntries, session.recoveryEntries)
            ? session
            : { ...session, recoveryEntries },
        ),
      );
    },
    [activeSnapshot, refreshCoordinator],
  );

  const readConflict = useCallback(
    async (path: string): Promise<ConflictContent> =>
      gitBridge.readConflict(activeSnapshot().id, path),
    [activeSnapshot],
  );

  const saveConflictResult = useCallback(
    async (path: string, result: string, stage: boolean): Promise<void> => {
      await mutateAndRefresh(
        (repositoryId) => gitBridge.writeConflictResult(repositoryId, path, result, stage),
        ["status", "operation"],
      );
    },
    [mutateAndRefresh],
  );

  const resolveBinaryConflict = useCallback(
    async (path: string, side: "ours" | "theirs"): Promise<void> => {
      await mutateAndRefresh(
        (repositoryId) => gitBridge.resolveBinaryConflict(repositoryId, path, side),
        ["status", "operation"],
      );
    },
    [mutateAndRefresh],
  );

  const executeSynchronizedBranchOperation = useCallback(
    async (repositoryIds: readonly string[], operation: GitOperation): Promise<MultiRootResult> => {
      const result = await gitBridge.executeSynchronizedBranchOperation(repositoryIds, operation);
      if (activeSession) {
        const repositoryId = activeSession.repository.snapshot.id;
        refreshCoordinator.invalidate(repositoryId, invalidationsForOperation(operation));
        await refreshCoordinator.flush(repositoryId);
      }
      return result;
    },
    [activeSession, refreshCoordinator],
  );

  const applyMultiRootRollback = useCallback(
    async (steps: readonly MultiRootRollbackStep[]): Promise<readonly MultiRootOutcome[]> => {
      const outcomes = await gitBridge.applyMultiRootRollback(steps);
      if (activeSession) {
        const repositoryId = activeSession.repository.snapshot.id;
        refreshCoordinator.invalidate(repositoryId, ["status", "history", "management"]);
        await refreshCoordinator.flush(repositoryId);
      }
      return outcomes;
    },
    [activeSession, refreshCoordinator],
  );

  const cancelActivity = useCallback(async (): Promise<void> => {
    if (!activity || activity.status !== "running") return;
    const requestIds = activity.requestIds;
    if (requestIds.length === 0) return;
    setActivity((current) =>
      current?.id === activity.id ? { ...current, requestIds: [] } : current,
    );
    const results = await cancelRequests(requestIds);
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failed) finishActivity(activity.id, "failed", sanitizeGitError(failed.reason));
  }, [activity, finishActivity]);

  const retryActivity = useCallback(async (): Promise<void> => {
    const retry = activityRetry.current;
    if (!activity || retry?.activityId !== activity.id) return;
    if (activeSnapshotRef.current?.id !== retry.retry.repositoryId) {
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
  }, [
    activity,
    dismissActivity,
    executeOperation,
    loadPushPreview,
    loadHistoryRewritePreview,
    finishActivity,
    loadLog,
    reload,
  ]);

  const dismissError = useCallback((): void => {
    setState((current) => {
      const repositoryId = activeRepositoryId.current;
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
  }, []);

  const dismissNotice = useCallback((): void => {
    setState((current) => ({ ...current, notice: null }));
  }, []);

  const removeRecentProject = useCallback((path: string): void => {
    setState((current) => ({
      ...current,
      recentProjects: current.recentProjects.filter((project) => project.path !== path),
    }));
  }, []);

  const openRepositories = state.sessions.flatMap((session) =>
    session.kind === "repository" ? [session.repository.snapshot] : [],
  );

  return {
    sessions: state.sessions,
    activeTab: state.activeTab,
    recentProjects: state.recentProjects,
    restoring: state.restoring,
    error: state.error ?? activeSession?.error ?? null,
    notice: state.notice ?? null,
    fixture,
    repository: activeSession?.repository ?? null,
    repositoryError: activeErrorSession,
    loading: activeSession?.status === "loading",
    stale: activeSession?.stale ?? false,
    hasMoreCommits: activeSession?.hasMoreCommits ?? false,
    logLoading: activeSession?.logLoading ?? false,
    logError: activeSession?.logError ?? null,
    activity: activity?.repositoryId === activeSession?.repository.snapshot.id ? activity : null,
    gitConsoleEntries: gitConsoleEntries.filter(
      (entry) => entry.repositoryId === activeSession?.repository.snapshot.id,
    ),
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
