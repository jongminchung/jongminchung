import { RepositoryWatchSession } from "../hooks/repository-watch-session";
import type {
  GitOperation,
  LogFilters,
  LogOrder,
  RepositorySnapshot,
  RequestId,
} from "../shared/contracts/model";

export interface RawRepositoryData {
  readonly refs: string;
  readonly log: string;
  readonly status: string;
  readonly stash: string;
}

export interface LogSelection {
  readonly filters: LogFilters;
  readonly order: LogOrder;
}

export type ActivityRetry =
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

export interface GitSessionRuntime {
  activeRepositoryId: string | null;
  activeSnapshot: RepositorySnapshot | null;
  readonly repositoryWatchSession: RepositoryWatchSession;
  readonly refreshInFlight: Map<string, Promise<void>>;
  readonly rawRepositoryData: Map<string, RawRepositoryData>;
  readonly logSelections: Map<string, LogSelection>;
  readonly logCommitCounts: Map<string, number>;
  readonly logGenerations: Map<string, number>;
  readonly activeLogRequests: Map<string, RequestId>;
  activeSearchRequest: RequestId | null;
  activityRetry: { readonly activityId: string; readonly retry: ActivityRetry } | null;
  restored: boolean;
  forgetRepository: (repositoryId: string) => void;
}

export function createGitSessionRuntime(activeRepositoryId: string | null): GitSessionRuntime {
  const runtime: GitSessionRuntime = {
    activeRepositoryId,
    activeSnapshot: null,
    repositoryWatchSession: new RepositoryWatchSession(),
    refreshInFlight: new Map(),
    rawRepositoryData: new Map(),
    logSelections: new Map(),
    logCommitCounts: new Map(),
    logGenerations: new Map(),
    activeLogRequests: new Map(),
    activeSearchRequest: null,
    activityRetry: null,
    restored: false,
    forgetRepository: (repositoryId) => {
      runtime.repositoryWatchSession.forget(repositoryId);
      runtime.refreshInFlight.delete(repositoryId);
      runtime.rawRepositoryData.delete(repositoryId);
      runtime.logSelections.delete(repositoryId);
      runtime.logCommitCounts.delete(repositoryId);
      runtime.logGenerations.delete(repositoryId);
      runtime.activeLogRequests.delete(repositoryId);
      if (runtime.activeRepositoryId === repositoryId) runtime.activeRepositoryId = null;
      if (runtime.activeSnapshot?.id === repositoryId) runtime.activeSnapshot = null;
    },
  };
  return runtime;
}
