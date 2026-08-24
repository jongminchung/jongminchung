import { startTransition, useCallback, useEffect } from "react";
import type { GitBridge } from "../../../application/git-session/ports/GitBridge";
import type { GitSessionRepositoryPort } from "../../../application/git-session/ports/GitSessionBackend";
import type { GitSessionRuntime } from "../../../application/git-session/state/GitSessionRuntime";
import type {
  GitSessionStore,
  GitSessionRefreshCoordinator,
} from "../../../application/git-session/state/GitSessionStore";
import {
  createLogRequest,
  sameValue,
  updateRepositorySession,
} from "../../../application/git-session/use-cases/gitSessionControllerHelpers";
import { sanitizeGitError } from "../../../domain/gitActivity";
import {
  parseLog,
  parseRefs,
  parseStashList,
  parseStatusV2,
} from "../../../domain/parsers";
import { updateRecentProjects } from "../../../domain/recentProjects";
import { updateRepositoryView } from "../../../domain/repositoryView";
import type {
  ConflictFile,
  RemoteInfo,
  RepositoryInvalidation,
  RepositorySnapshot,
  WorktreeInfo,
} from "../../../shared/contracts/model/index";

type RunRequest = ReturnType<
  typeof import("./useGitRequestRuntime").useGitRequestRuntime
>["runRequest"];

interface GitSessionRefreshOptions {
  readonly configureRefreshCoordinator: GitSessionStore["configureRefreshCoordinator"];
  readonly gitBridge: GitBridge;
  readonly repositoryPort: GitSessionRepositoryPort;
  readonly refreshCoordinator: GitSessionRefreshCoordinator;
  readonly runRequest: RunRequest;
  readonly runtime: GitSessionRuntime;
  readonly setState: GitSessionStore["setWorkspace"];
}

export function useGitSessionRefresh({
  configureRefreshCoordinator,
  gitBridge,
  repositoryPort,
  refreshCoordinator,
  runRequest,
  runtime,
  setState,
}: GitSessionRefreshOptions) {
  const refreshAll = useCallback(
    (repositoryId: string): Promise<void> =>
      repositoryPort.refresh(async () => {
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
          runRequest(
            createLogRequest(
              repositoryId,
              runtime.logSelections.get(repositoryId),
            ),
          ),
          runRequest({ kind: "status", repositoryId }),
          runRequest({ kind: "stashList", repositoryId }),
          gitBridge.listShelves(repositoryId),
          gitBridge.listChangelists(repositoryId),
          gitBridge.listRecoveryEntries(repositoryId),
          gitBridge.listConflicts(repositoryId),
          gitBridge.listRemotes(repositoryId),
          gitBridge.listWorktrees(repositoryId),
        ]);
        const refreshedSnapshot =
          await gitBridge.refreshRepository(repositoryId);
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
          const updated = updateRepositorySession(
            current,
            repositoryId,
            (session) => ({
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
            }),
          );
          if (previousProject?.branch === refreshedSnapshot.currentBranch)
            return updated;
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
      }),
    [repositoryPort, runRequest, gitBridge, runtime, setState],
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
    (
      repositoryId: string,
      invalidations: readonly RepositoryInvalidation[],
    ): Promise<void> =>
      repositoryPort.refresh(async () => {
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
            ? runRequest(
                createLogRequest(
                  repositoryId,
                  runtime.logSelections.get(repositoryId),
                ),
              )
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
        const statusChanged =
          statusOutput !== null && statusOutput !== previousRaw?.status;
        const refsChanged =
          refsOutput !== null && refsOutput !== previousRaw?.refs;
        const logChanged = logOutput !== null && logOutput !== previousRaw?.log;
        const stashChanged =
          stashOutput !== null && stashOutput !== previousRaw?.stash;
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
                refsChanged && refsOutput !== null
                  ? parseRefs(refsOutput)
                  : repository.refs;
              const nextCommits =
                logChanged && logOutput !== null
                  ? parseLog(logOutput)
                  : repository.commits;
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
                stashChanged && stashOutput !== null
                  ? parseStashList(stashOutput)
                  : session.stashes;
              const nextConflicts =
                conflicts && !sameValue(conflicts, session.conflicts)
                  ? conflicts
                  : session.conflicts;
              const nextRemotes =
                remotes && !sameValue(remotes, session.remotes)
                  ? remotes
                  : session.remotes;
              const nextWorktrees =
                worktrees && !sameValue(worktrees, session.worktrees)
                  ? worktrees
                  : session.worktrees;
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
                  logOutput === null
                    ? session.hasMoreCommits
                    : nextCommits.length === 500,
                error: null,
              };
            }),
          );
        });
      }),
    [repositoryPort, runRequest, gitBridge, runtime, setState],
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
    (snapshot: RepositorySnapshot): Promise<void> =>
      repositoryPort.watch(() =>
        runtime.repositoryWatchSession.ensure(snapshot.id, () =>
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
        ),
      ),
    [repositoryPort, refreshCoordinator, gitBridge, runtime, setState],
  );

  return { refreshAll, refreshOnce, watch };
}
