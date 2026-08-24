import { useCallback } from "react";
import type { GitBridge } from "../../../application/git-session/ports/GitBridge";
import type { GitSessionHistoryPort } from "../../../application/git-session/ports/GitSessionBackend";
import type {
  GitSessionRuntime,
  LogSelection,
} from "../../../application/git-session/state/GitSessionRuntime";
import type { RepositorySession } from "../../../application/git-session/state/GitSessionState";
import type {
  GitSessionRefreshCoordinator,
  GitSessionStore,
} from "../../../application/git-session/state/GitSessionStore";
import {
  cancelRequests,
  createLogRequest,
  updateRepositorySession,
} from "../../../application/git-session/use-cases/gitSessionControllerHelpers";
import {
  isGitRequestCancelled,
  sanitizeGitError,
} from "../../../domain/gitActivity";
import { parseLog } from "../../../domain/parsers";
import type { Commit } from "../../../domain/types";
import type {
  LogFilters,
  LogOrder,
  RepositorySnapshot,
} from "../../../shared/contracts/model/index";

type RequestRuntime = ReturnType<
  typeof import("./useGitRequestRuntime").useGitRequestRuntime
>;

interface GitSessionLogOptions {
  readonly activeSession: RepositorySession | null;
  readonly activeSnapshot: () => RepositorySnapshot;
  readonly beginActivity: RequestRuntime["beginActivity"];
  readonly finishActivity: RequestRuntime["finishActivity"];
  readonly gitBridge: GitBridge;
  readonly historyPort: GitSessionHistoryPort;
  readonly refreshAll: (repositoryId: string) => Promise<void>;
  readonly refreshCoordinator: GitSessionRefreshCoordinator;
  readonly runRequest: RequestRuntime["runRequest"];
  readonly runtime: GitSessionRuntime;
  readonly setState: GitSessionStore["setWorkspace"];
}

export function useGitSessionLog({
  activeSession,
  activeSnapshot,
  beginActivity,
  finishActivity,
  gitBridge,
  historyPort,
  refreshAll,
  refreshCoordinator,
  runRequest,
  runtime,
  setState,
}: GitSessionLogOptions) {
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
  }, [
    activeSession,
    beginActivity,
    finishActivity,
    refreshAll,
    refreshCoordinator,
    setState,
  ]);

  const loadLog = useCallback(
    (filters: LogFilters, order: LogOrder, append: boolean): Promise<void> =>
      historyPort.loadLog(async () => {
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
        const skip = append
          ? (runtime.logCommitCounts.get(snapshot.id) ?? 0)
          : 0;
        try {
          const output = await runRequest(
            createLogRequest(snapshot.id, selection, skip),
            {
              activityId,
              onStarted: (requestId) => {
                if (runtime.logGenerations.get(snapshot.id) === generation) {
                  runtime.activeLogRequests.set(snapshot.id, requestId);
                } else {
                  void cancelRequests(gitBridge, [requestId]);
                }
              },
            },
          );
          if (runtime.logGenerations.get(snapshot.id) !== generation) return;
          const page = parseLog(output);
          setState((current) =>
            updateRepositorySession(current, snapshot.id, (session) => {
              const known = new Set(
                session.repository.commits.map((commit) => commit.oid),
              );
              const commits = append
                ? [
                    ...session.repository.commits,
                    ...page.filter((commit) => !known.has(commit.oid)),
                  ]
                : page;
              return {
                ...session,
                repository: {
                  ...session.repository,
                  commits,
                },
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
      }),
    [
      activeSnapshot,
      beginActivity,
      finishActivity,
      historyPort,
      runRequest,
      gitBridge,
      runtime,
      setState,
    ],
  );

  const indexLog = useCallback(
    (filters: LogFilters, order: LogOrder): Promise<void> =>
      historyPort.loadLog(async () => {
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
          while (
            hasMore &&
            runtime.logGenerations.get(snapshot.id) === generation
          ) {
            const output = await runRequest(
              createLogRequest(snapshot.id, selection, skip),
              {
                activityId,
                onStarted: (requestId) => {
                  if (runtime.logGenerations.get(snapshot.id) === generation) {
                    runtime.activeLogRequests.set(snapshot.id, requestId);
                  } else {
                    void cancelRequests(gitBridge, [requestId]);
                  }
                },
              },
            );
            if (runtime.logGenerations.get(snapshot.id) !== generation) {
              return;
            }
            const page = parseLog(output);
            const known = new Set(indexed.map((commit) => commit.oid));
            indexed = [
              ...indexed,
              ...page.filter((commit) => !known.has(commit.oid)),
            ];
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
      }),
    [
      activeSnapshot,
      beginActivity,
      finishActivity,
      historyPort,
      runRequest,
      gitBridge,
      runtime,
      setState,
    ],
  );

  return { indexLog, loadLog, reload };
}
