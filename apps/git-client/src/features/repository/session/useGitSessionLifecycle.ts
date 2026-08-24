import { useCallback, useEffect } from "react";
import {
  readDesktopSetting,
  writeDesktopSettings,
} from "../../../application/desktop/DesktopPort";
import type { GitBridge } from "../../../application/git-session/ports/GitBridge";
import type { GitSessionRepositoryPort } from "../../../application/git-session/ports/GitSessionBackend";
import type { GitSessionRuntime } from "../../../application/git-session/state/GitSessionRuntime";
import type {
  WorkspaceState,
  WorkspaceTab,
} from "../../../application/git-session/state/GitSessionState";
import type {
  GitSessionRefreshCoordinator,
  GitSessionStore,
} from "../../../application/git-session/state/GitSessionStore";
import { loadingSession } from "../../../application/git-session/use-cases/gitSessionControllerHelpers";
import { terminalService } from "../../../application/terminal/activeTerminalService";
import { sanitizeGitError } from "../../../domain/gitActivity";
import { closeProjectResources } from "../../../domain/projectClose";
import { updateRecentProjects } from "../../../domain/recentProjects";
import {
  repositoryAccessPolicy,
  restoreRepositoryAccess,
  type RepositoryAccessMode,
} from "../../../domain/repositoryAccess";
import { runInBackground } from "../../../domain/toVoidHandler";
import {
  loadWorkspaceStartupState,
  recentProjectsWithRestoreFailures,
} from "../../../domain/welcomeStartup";
import {
  restoredWorkspaceTab,
  WORKSPACE_SCHEMA_VERSION,
  workspacePaths,
  workspaceTabAfterClose,
} from "../../../domain/workspacePersistence";
import type { GitCreationEventListener } from "../../../shared/contracts/git-utility";
import type {
  CloneOptions,
  RequestId,
  RepositorySnapshot,
} from "../../../shared/contracts/model/index";

interface GitSessionLifecycleOptions {
  readonly activeRepositoryPath: string | null;
  readonly gitBridge: GitBridge;
  readonly openRepositoryPathsJson: string;
  readonly recentProjectsJson: string;
  readonly refreshCoordinator: GitSessionRefreshCoordinator;
  readonly refreshOnce: (repositoryId: string) => Promise<void>;
  readonly repositoryPort: GitSessionRepositoryPort;
  readonly runtime: GitSessionRuntime;
  readonly safeRepositoryPathsJson: string;
  readonly setState: GitSessionStore["setWorkspace"];
  readonly state: WorkspaceState;
  readonly watch: (snapshot: RepositorySnapshot) => Promise<void>;
}

export function useGitSessionLifecycle({
  activeRepositoryPath,
  gitBridge,
  openRepositoryPathsJson,
  recentProjectsJson,
  refreshCoordinator,
  refreshOnce,
  repositoryPort,
  runtime,
  safeRepositoryPathsJson,
  setState,
  state,
  watch,
}: GitSessionLifecycleOptions) {
  const addSnapshot = useCallback(
    async (snapshot: RepositorySnapshot, activate: boolean): Promise<void> => {
      if (activate) repositoryAccessPolicy.activate(snapshot.id);
      setState((current) => ({
        ...current,
        sessions: [
          ...current.sessions.filter(
            (session) =>
              session.kind !== "repository" ||
              session.repository.snapshot.id !== snapshot.id,
          ),
          loadingSession(snapshot),
        ],
        activeTab: activate
          ? { kind: "repository", repositoryId: snapshot.id }
          : current.activeTab,
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
    if (runtime.restored) return;
    runtime.restored = true;
    const restore = async (): Promise<void> => {
      try {
        const startup = await loadWorkspaceStartupState(readDesktopSetting);
        const results = await Promise.allSettled(
          startup.openRepositoryPaths.map((path) =>
            gitBridge.openRepository(path),
          ),
        );
        const snapshots = results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        restoreRepositoryAccess(
          repositoryAccessPolicy,
          snapshots,
          startup.safeRepositoryPaths,
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
        const activeTab = restoredWorkspaceTab(
          sessions,
          startup.activeRepositoryPath,
        );
        repositoryAccessPolicy.activate(
          activeTab.kind === "repository" ? activeTab.repositoryId : null,
        );
        setState({
          sessions,
          activeTab,
          recentProjects: recentProjectsWithRestoreFailures(
            startup.recentProjects,
            failedPaths,
          ),
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
    void repositoryPort.restore(restore);
  }, [refreshOnce, repositoryPort, runtime, watch, gitBridge, setState]);

  useEffect(() => {
    if (state.restoring) return;
    const persist = async (): Promise<void> => {
      await writeDesktopSettings({
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        openRepositoryPaths: JSON.parse(openRepositoryPathsJson),
        safeRepositoryPaths: JSON.parse(safeRepositoryPathsJson),
        activeRepositoryPath,
        recentProjects: JSON.parse(recentProjectsJson),
      });
    };
    runInBackground(repositoryPort.persist(persist), "Workspace persistence");
  }, [
    activeRepositoryPath,
    openRepositoryPathsJson,
    repositoryPort,
    safeRepositoryPathsJson,
    recentProjectsJson,
    state.restoring,
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
        repositoryPort.assertActionsAllowed();
        repositoryAccessPolicy.remember(path, mode);
        const intendedSafeRepositoryPaths = repositoryAccessPolicy
          .safePaths([
            ...workspacePaths(state.sessions),
            ...state.recentProjects.map((project) => project.path),
            path,
          ])
          .filter((safePath) => mode === "safe" || safePath !== path);
        await writeDesktopSettings({
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
    [
      addSnapshot,
      repositoryPort,
      state.recentProjects,
      state.sessions,
      gitBridge,
      setState,
    ],
  );

  const initializeRepository = useCallback(
    async (
      path: string,
      bare: boolean,
      onEvent?: GitCreationEventListener,
    ): Promise<void> => {
      try {
        repositoryPort.assertActionsAllowed();
        repositoryAccessPolicy.assertActive("gitMutation");
        await addSnapshot(
          await gitBridge.initializeRepository(path, bare, onEvent),
          true,
        );
      } catch (error) {
        const message = sanitizeGitError(error);
        setState((current) => ({
          ...current,
          error: message,
        }));
        throw new Error(message);
      }
    },
    [addSnapshot, repositoryPort, gitBridge, setState],
  );

  const cloneRepository = useCallback(
    async (
      url: string,
      path: string,
      options: CloneOptions,
      onEvent?: GitCreationEventListener,
    ): Promise<void> => {
      try {
        repositoryPort.assertActionsAllowed();
        repositoryAccessPolicy.assertActive("gitMutation");
        await addSnapshot(
          await gitBridge.cloneRepository(url, path, options, onEvent),
          true,
        );
      } catch (error) {
        const message = sanitizeGitError(error);
        setState((current) => ({
          ...current,
          error: message,
        }));
        throw new Error(message);
      }
    },
    [addSnapshot, repositoryPort, gitBridge, setState],
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
          ? candidate.kind === "repository" &&
            candidate.repository.snapshot.id === tab.repositoryId
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
      await writeDesktopSettings({
        activeRepositoryPath: nextActivePath,
      });
      runtime.activeRepositoryId =
        tab.kind === "repository" ? tab.repositoryId : null;
      repositoryAccessPolicy.activate(runtime.activeRepositoryId);
      setState((current) => ({ ...current, activeTab: tab }));
      if (tab.kind !== "repository") return;
      const session = state.sessions.find(
        (candidate) =>
          candidate.kind === "repository" &&
          candidate.repository.snapshot.id === tab.repositoryId,
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
      if (session.kind === "repository") {
        await repositoryPort.closeResources(
          () => gitBridge.unwatchRepository(sessionId),
          () => terminalService.closeRepository(sessionId),
        );
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
        activeTab: workspaceTabAfterClose(
          current.sessions,
          current.activeTab,
          sessionId,
        ),
      }));
    },
    [
      repositoryPort,
      refreshCoordinator,
      runtime,
      state.sessions,
      gitBridge,
      setState,
    ],
  );

  const closeProject = useCallback(async (): Promise<void> => {
    const repositoryIds = state.sessions.flatMap((session) =>
      session.kind === "repository" ? [session.repository.snapshot.id] : [],
    );
    await writeDesktopSettings({
      activeRepositoryPath: null,
      openRepositoryPaths: [],
    });
    await closeProjectResources(repositoryIds, {
      unwatchRepository: (repositoryId) =>
        repositoryPort.closeResources(
          () => gitBridge.unwatchRepository(repositoryId),
          async () => undefined,
        ),
      closeRepositoryTerminals: (repositoryId) =>
        repositoryPort.closeResources(
          async () => undefined,
          () => terminalService.closeRepository(repositoryId),
        ),
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
  }, [
    repositoryPort,
    refreshCoordinator,
    runtime,
    state.sessions,
    setState,
    gitBridge,
  ]);

  return {
    activateTab,
    cancelRepositoryCreation,
    cloneRepository,
    closeProject,
    closeRepository,
    initializeRepository,
    openRepository,
    switchRepository,
  };
}
