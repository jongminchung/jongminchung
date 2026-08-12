import type { SetStateAction } from "react";
import type { StateCreator } from "zustand/vanilla";
import type { GitBridge } from "../../bridge/GitBridge";
import type { GitActivity } from "../../domain/gitActivity";
import type { GitConsoleEntry } from "../../domain/gitConsole";
import type { RepositoryInvalidation } from "../../shared/contracts/model";
import type { GitSessionRuntime } from "../gitSessionRuntime";
import type { WorkspaceState } from "../sessionTypes";

export type SessionSetter<T> = (value: SetStateAction<T>) => void;
export type SessionRefresh = (
    repositoryId: string,
    invalidations: readonly RepositoryInvalidation[],
) => Promise<void>;
export type HandleSessionRefreshError = (
    repositoryId: string,
    error: unknown,
) => void;

export interface GitSessionRefreshCoordinator {
    invalidate(
        repositoryId: string,
        invalidations: readonly RepositoryInvalidation[],
    ): void;
    defer(
        repositoryId: string,
        invalidations: readonly RepositoryInvalidation[],
    ): void;
    resume(repositoryId: string): Promise<boolean>;
    flush(repositoryId: string): Promise<void>;
    forget(repositoryId: string): void;
}

export interface GitSessionStoreDependencies {
    readonly bridge: GitBridge;
    readonly initialWorkspace: WorkspaceState;
    readonly refreshCoordinator?: GitSessionRefreshCoordinator;
    readonly runtime?: GitSessionRuntime;
}

export interface SessionLifecycleSlice {
    readonly bridge: GitBridge;
    readonly runtime: GitSessionRuntime;
    readonly refreshCoordinator: GitSessionRefreshCoordinator;
    readonly configureRefreshCoordinator: (
        refresh: SessionRefresh,
        handleError: HandleSessionRefreshError,
    ) => void;
    readonly resetSession: () => void;
}

export interface SessionQuerySlice {
    readonly workspace: WorkspaceState;
    readonly setWorkspace: SessionSetter<WorkspaceState>;
}

export interface SessionMutationSlice {
    readonly pendingMutationIds: ReadonlySet<string>;
    readonly beginMutation: (id: string) => void;
    readonly finishMutation: (id: string) => void;
}

export interface SessionRecoverySlice {
    readonly recoveryRevision: number;
    readonly markRecoveryUpdated: () => void;
}

export interface SessionActivitySlice {
    readonly activity: GitActivity | null;
    readonly consoleEntries: readonly GitConsoleEntry[];
    readonly setActivity: SessionSetter<GitActivity | null>;
    readonly setConsoleEntries: SessionSetter<readonly GitConsoleEntry[]>;
}

export type GitSessionStore = SessionLifecycleSlice &
    SessionQuerySlice &
    SessionMutationSlice &
    SessionRecoverySlice &
    SessionActivitySlice;

export type SessionSliceCreator<T> = StateCreator<GitSessionStore, [], [], T>;
