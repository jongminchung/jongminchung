import { useCallback, useEffect, useMemo } from "react";
import {
  isGitRequestCancelled,
  isRetryableOperation,
  operationActivityLabel,
  sanitizeGitError,
} from "../domain/gitActivity";
import { operationPolicyFor } from "../domain/gitOperationPolicy";
import { repositoryAccessPolicy, type RepositoryAccessMode } from "../domain/repositoryAccess";
import { workspacePaths } from "../domain/workspacePersistence";
import { useGitSessionStore } from "./GitSessionStoreProvider";
import {
  fixtureEnabled,
  welcomeRecentFixtureEnabled,
  WELCOME_RECENT_PROJECT_FIXTURE,
} from "./sessionBootstrap";
import type { RepositorySession } from "./sessionTypes";
export type {
  RepositoryErrorSession,
  RepositorySession,
  WorkspaceRepositorySession,
  WorkspaceState,
  WorkspaceTab,
} from "./sessionTypes";
import type {
  GitOperation,
  PushPreview,
  HistoryRewritePreview,
  RecoveryEntry,
  RepositorySnapshot,
} from "../shared/contracts/model";
import { useGitRequestRuntime } from "./useGitRequestRuntime";
import { useGitSessionLifecycle } from "./useGitSessionLifecycle";
import { useGitSessionLog } from "./useGitSessionLog";
import { useGitSessionMutationActions } from "./useGitSessionMutationActions";
import { useGitSessionQueryActions } from "./useGitSessionQueryActions";
import { useGitSessionRefresh } from "./useGitSessionRefresh";

const EMPTY_ARRAY: readonly never[] = [];

import {
  cancelRequests,
  fixtureSession,
  requireFixtureData,
  sameValue,
  updateRepositorySession,
} from "./gitSessionControllerHelpers";

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
  const { refreshAll, refreshOnce, watch } = useGitSessionRefresh({
    configureRefreshCoordinator,
    fixture,
    gitBridge,
    refreshCoordinator,
    runRequest,
    runtime,
    setState,
  });

  const {
    activateTab,
    cancelRepositoryCreation,
    cloneRepository,
    closeProject,
    closeRepository,
    initializeRepository,
    openRepository,
    switchRepository,
  } = useGitSessionLifecycle({
    activeRepositoryPath,
    fixture,
    gitBridge,
    openRepositoryPathsJson,
    recentProjectsJson,
    refreshCoordinator,
    refreshOnce,
    runtime,
    safeRepositoryPathsJson,
    setState,
    state,
    watch,
    welcomeRecentFixture,
  });

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

  const { indexLog, loadLog, reload } = useGitSessionLog({
    activeSession,
    activeSnapshot,
    beginActivity,
    finishActivity,
    fixture,
    gitBridge,
    refreshAll,
    refreshCoordinator,
    runRequest,
    runtime,
    setState,
  });

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

  return capabilities;
}

export type GitSessionController = ReturnType<typeof useGitSessionController>;
export type GitSessionCapabilities = GitSessionController;
