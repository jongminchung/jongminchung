import { useCallback, useEffect } from "react";
import type { GitBridge } from "../bridge/GitBridge";
import { GitRequestCancelledError, type GitActivity } from "../domain/gitActivity";
import { recordGitConsoleEvent } from "../domain/gitConsole";
import { GitRequestEventBuffer } from "../domain/gitRequestEvents";
import { assertGitRequestAllowed, repositoryAccessPolicy } from "../domain/repositoryAccess";
import type { GitEvent, GitRequest, RequestId } from "../shared/contracts/model";
import type { GitSessionRuntime, ActivityRetry } from "./gitSessionRuntime";
import type { GitSessionStore } from "./gitSessionStore";

export interface RunRequestOptions {
  readonly activityId?: string;
  readonly onStarted?: (requestId: RequestId) => void;
}

export function useGitRequestRuntime({
  activity,
  beginMutation,
  finishMutation,
  fixture,
  gitBridge,
  runtime,
  setActivity,
  setGitConsoleEntries,
}: {
  readonly activity: GitActivity | null;
  readonly beginMutation: GitSessionStore["beginMutation"];
  readonly finishMutation: GitSessionStore["finishMutation"];
  readonly fixture: boolean;
  readonly gitBridge: GitBridge;
  readonly runtime: GitSessionRuntime;
  readonly setActivity: GitSessionStore["setActivity"];
  readonly setGitConsoleEntries: GitSessionStore["setConsoleEntries"];
}) {
  const beginActivity = useCallback(
    (repositoryId: string, label: string, retry: ActivityRetry | null): string => {
      const id = crypto.randomUUID();
      beginMutation(id);
      runtime.activityRetry = retry ? { activityId: id, retry } : null;
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
    [beginMutation, runtime, setActivity],
  );

  const attachActivityRequest = useCallback(
    (activityId: string, requestId: RequestId): void => {
      setActivity((current) => {
        if (current?.id !== activityId || current.requestIds.includes(requestId)) return current;
        return {
          ...current,
          requestIds: [...current.requestIds, requestId],
        };
      });
    },
    [setActivity],
  );

  const finishActivity = useCallback(
    (
      activityId: string,
      status: Exclude<GitActivity["status"], "running">,
      error: string | null = null,
    ): void => {
      finishMutation(activityId);
      setActivity((current) =>
        current?.id === activityId ? { ...current, status, requestIds: [], error } : current,
      );
    },
    [finishMutation, setActivity],
  );

  const dismissActivity = useCallback(
    (activityId?: string): void => {
      setActivity((current) => {
        if (!current || (activityId && current.id !== activityId)) return current;
        if (runtime.activityRetry?.activityId === current.id) runtime.activityRetry = null;
        return null;
      });
    },
    [runtime, setActivity],
  );

  const recordConsoleEvent = useCallback(
    (request: GitRequest, event: GitEvent): void => {
      setGitConsoleEntries((current) => recordGitConsoleEvent(current, request, event, Date.now()));
    },
    [setGitConsoleEntries],
  );

  const clearGitConsole = useCallback(
    (repositoryId?: string): void => {
      const target = repositoryId ?? runtime.activeRepositoryId;
      if (!target) return;
      setGitConsoleEntries((current) => current.filter((entry) => entry.repositoryId !== target));
    },
    [runtime, setGitConsoleEntries],
  );

  useEffect(() => {
    if (!activity || (activity.status !== "succeeded" && activity.status !== "cancelled")) return;
    const timeout = window.setTimeout(() => dismissActivity(activity.id), 2_000);
    return () => window.clearTimeout(timeout);
  }, [activity, dismissActivity]);

  const runRequest = useCallback(
    async (request: GitRequest, options: RunRequestOptions = {}): Promise<string> => {
      if (fixture) {
        const { samplePatch } = await import("../domain/sampleData");
        return request.kind === "diff" ? samplePatch : "";
      }
      assertGitRequestAllowed(repositoryAccessPolicy, request);
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
    [attachActivityRequest, fixture, recordConsoleEvent, gitBridge],
  );

  return {
    beginActivity,
    clearGitConsole,
    dismissActivity,
    finishActivity,
    runRequest,
  };
}
