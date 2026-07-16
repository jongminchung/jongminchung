import {
    startTransition,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { isTauriRuntime, TauriGitBridge } from "../bridge/GitBridge";
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
import { gitConsoleStore } from "../domain/GitConsoleStore";
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
    restoredWorkspaceTab,
    workspacePaths,
} from "../domain/workspacePersistence";
import type {
    Changelist,
    ChangelistCommitResult,
    ConflictContent,
    ConflictFile,
    FileContent,
    FileSource,
    GitEvent,
    GitOperation,
    GitRequest,
    MultiRootOutcome,
    MultiRootResult,
    MultiRootRollbackStep,
    RecoveryEntry,
    RemoteInfo,
    RepositoryInvalidation,
    RepositorySnapshot,
    ShelfEntry,
    WorktreeInfo,
} from "../generated";

const gitBridge = new TauriGitBridge();
const EMPTY_ARRAY: readonly never[] = [];

interface RawRepositoryData {
    readonly refs: string;
    readonly log: string;
    readonly status: string;
    readonly stash: string;
}

export type WorkspaceTab =
    | { readonly kind: "manage" }
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
    readonly error: string | null;
}

export interface RepositoryErrorSession {
    readonly kind: "error";
    readonly status: "error";
    readonly id: string;
    readonly path: string;
    readonly message: string;
}

export type WorkspaceRepositorySession =
    | RepositorySession
    | RepositoryErrorSession;

interface WorkspaceState {
    readonly sessions: readonly WorkspaceRepositorySession[];
    readonly activeTab: WorkspaceTab;
    readonly recentRepositories: readonly string[];
    readonly restoring: boolean;
    readonly error: string | null;
}

function fixtureEnabled(): boolean {
    return (
        import.meta.env.DEV &&
        !isTauriRuntime() &&
        new URLSearchParams(window.location.search).get("fixture") === "qa"
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
        error: null,
    };
}

type FixtureData = typeof import("../domain/sampleData");
const loadFixtureData: (() => Promise<FixtureData>) | undefined = import.meta
    .env.DEV
    ? () => import("../domain/sampleData")
    : undefined;

async function requireFixtureData(): Promise<FixtureData> {
    if (!loadFixtureData)
        throw new Error("QA fixtures are available only in development mode");
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
        error: null,
    };
}

function initialState(): WorkspaceState {
    return {
        sessions: [],
        activeTab: { kind: "manage" },
        recentRepositories: [],
        restoring: fixtureEnabled() || isTauriRuntime(),
        error: null,
    };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function updateRepositorySession(
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

function createLogRequest(repositoryId: string): GitRequest {
    return {
        kind: "log",
        repositoryId,
        skip: 0,
        limit: 500,
        order: "topology",
        filters: {
            query: null,
            branch: null,
            author: null,
            since: null,
            until: null,
            paths: [],
            noMerges: false,
        },
    };
}

function sameValue(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function invalidationsForOperation(
    operation: GitOperation,
): readonly RepositoryInvalidation[] {
    if (
        operation.kind === "stage" ||
        operation.kind === "unstage" ||
        operation.kind === "discard" ||
        operation.kind === "applyPatch" ||
        operation.kind === "partialPatch"
    ) {
        return ["status"];
    }
    if (
        operation.kind === "stashPush" ||
        operation.kind === "stashApply" ||
        operation.kind === "stashDrop"
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
    if (operation.kind === "push" || operation.kind === "pushTo") {
        return ["status", "history"];
    }
    return ["status", "history", "operation"];
}

function recordsRecovery(operation: GitOperation): boolean {
    return (
        operation.kind === "commit" ||
        operation.kind === "reset" ||
        operation.kind === "revert" ||
        operation.kind === "cherryPick" ||
        operation.kind === "merge" ||
        operation.kind === "rebase" ||
        operation.kind === "dropCommits" ||
        operation.kind === "squashCommits" ||
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
        operation.kind === "stashDrop"
    );
}

function validStoredPaths(value: unknown): readonly string[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
    );
}

export function useGitSession() {
    const fixture = fixtureEnabled();
    const [state, setState] = useState<WorkspaceState>(initialState);
    const activeRepositoryId = useRef<string | null>(
        state.activeTab.kind === "repository"
            ? state.activeTab.repositoryId
            : null,
    );
    const activeSnapshotRef = useRef<RepositorySnapshot | null>(null);
    const watchedRepositories = useRef(new Set<string>());
    const refreshInFlight = useRef(new Map<string, Promise<void>>());
    const rawRepositoryData = useRef(new Map<string, RawRepositoryData>());
    const restored = useRef(false);

    const activeSession = useMemo(() => {
        if (state.activeTab.kind !== "repository") return null;
        const repositoryId = state.activeTab.repositoryId;
        const session = state.sessions.find(
            (candidate) =>
                candidate.kind === "repository" &&
                candidate.repository.snapshot.id === repositoryId,
        );
        return session?.kind === "repository" ? session : null;
    }, [state.activeTab, state.sessions]);
    const managementSession = useMemo(
        () =>
            state.sessions.find(
                (candidate): candidate is RepositorySession =>
                    candidate.kind === "repository",
            ) ?? null,
        [state.sessions],
    );
    const activeErrorSession = useMemo(() => {
        if (state.activeTab.kind !== "error") return null;
        const sessionId = state.activeTab.sessionId;
        const session = state.sessions.find(
            (candidate) =>
                candidate.kind === "error" && candidate.id === sessionId,
        );
        return session?.kind === "error" ? session : null;
    }, [state.activeTab, state.sessions]);
    const openRepositoryPathsJson = JSON.stringify(
        workspacePaths(state.sessions),
    );
    const recentRepositoriesJson = JSON.stringify(state.recentRepositories);
    const activeRepositoryPath =
        activeSession?.repository.snapshot.path ??
        activeErrorSession?.path ??
        null;

    useEffect(() => {
        activeRepositoryId.current =
            activeSession?.repository.snapshot.id ?? null;
        activeSnapshotRef.current =
            activeSession?.repository.snapshot ??
            managementSession?.repository.snapshot ??
            null;
    }, [
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
                recentRepositories: [],
                restoring: false,
                error: null,
            });
        };
        void load();
    }, [fixture]);

    const runRequest = useCallback(
        async (request: GitRequest): Promise<string> => {
            if (fixture) {
                const { samplePatch } = await requireFixtureData();
                return request.kind === "diff" ? samplePatch : "";
            }
            return new Promise((resolve, reject) => {
                let output = "";
                const onEvent = (event: GitEvent): void => {
                    gitConsoleStore.accept(request.repositoryId, event);
                    if (event.kind === "output") {
                        output += event.data;
                    } else if (event.kind === "completed") {
                        resolve(output);
                    } else if (event.kind === "cancelled") {
                        reject(new Error("Git request cancelled"));
                    } else if (event.kind === "failed") {
                        reject(new Error(event.message));
                    }
                };
                const execute = async (): Promise<void> => {
                    try {
                        await gitBridge.execute(request, onEvent);
                    } catch (error) {
                        reject(error);
                    }
                };
                void execute();
            });
        },
        [fixture],
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
                runRequest(createLogRequest(repositoryId)),
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
            rawRepositoryData.current.set(repositoryId, {
                refs: refsOutput,
                log: logOutput,
                status: statusOutput,
                stash: stashOutput,
            });
            setState((current) =>
                updateRepositorySession(current, repositoryId, (session) => ({
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
                    error: null,
                })),
            );
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
                        updateRepositorySession(
                            current,
                            repositoryId,
                            (session) => ({
                                ...session,
                                status: "ready",
                                error: errorMessage(error),
                            }),
                        ),
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
                    ? runRequest(createLogRequest(repositoryId))
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
            const statusChanged =
                statusOutput !== null && statusOutput !== previousRaw?.status;
            const refsChanged =
                refsOutput !== null && refsOutput !== previousRaw?.refs;
            const logChanged =
                logOutput !== null && logOutput !== previousRaw?.log;
            const stashChanged =
                stashOutput !== null && stashOutput !== previousRaw?.stash;
            rawRepositoryData.current.set(repositoryId, {
                refs: refsOutput ?? previousRaw?.refs ?? "",
                log: logOutput ?? previousRaw?.log ?? "",
                status: statusOutput ?? previousRaw?.status ?? "",
                stash: stashOutput ?? previousRaw?.stash ?? "",
            });

            startTransition(() => {
                setState((current) =>
                    updateRepositorySession(
                        current,
                        repositoryId,
                        (session) => {
                            const repository = session.repository;
                            const nextSnapshot =
                                snapshot &&
                                !sameValue(snapshot, repository.snapshot)
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
                            const nextRepository = updateRepositoryView(
                                repository,
                                {
                                    snapshot: nextSnapshot,
                                    refs: nextRefs,
                                    commits: nextCommits,
                                    status: nextStatus,
                                },
                            );
                            const nextStashes =
                                stashChanged && stashOutput !== null
                                    ? parseStashList(stashOutput)
                                    : session.stashes;
                            const nextConflicts =
                                conflicts &&
                                !sameValue(conflicts, session.conflicts)
                                    ? conflicts
                                    : session.conflicts;
                            const nextRemotes =
                                remotes && !sameValue(remotes, session.remotes)
                                    ? remotes
                                    : session.remotes;
                            const nextWorktrees =
                                worktrees &&
                                !sameValue(worktrees, session.worktrees)
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
                                error: null,
                            };
                        },
                    ),
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
                    refreshInvalidationsRef.current(
                        repositoryId,
                        invalidations,
                    ),
                (repositoryId, error) => {
                    setState((current) =>
                        updateRepositorySession(
                            current,
                            repositoryId,
                            (session) => ({
                                ...session,
                                error: errorMessage(error),
                            }),
                        ),
                    );
                },
            ),
        [],
    );

    const watch = useCallback(
        async (snapshot: RepositorySnapshot): Promise<void> => {
            if (fixture || watchedRepositories.current.has(snapshot.id)) return;
            watchedRepositories.current.add(snapshot.id);
            await gitBridge.watchRepository(snapshot.id, (event) => {
                if (activeRepositoryId.current === snapshot.id) {
                    refreshCoordinator.invalidate(
                        snapshot.id,
                        event.invalidations,
                    );
                } else {
                    refreshCoordinator.defer(snapshot.id, event.invalidations);
                    setState((current) =>
                        updateRepositorySession(
                            current,
                            snapshot.id,
                            (session) => ({
                                ...session,
                                stale: true,
                            }),
                        ),
                    );
                }
            });
        },
        [fixture, refreshCoordinator],
    );

    const addSnapshot = useCallback(
        async (
            snapshot: RepositorySnapshot,
            activate: boolean,
        ): Promise<void> => {
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
                recentRepositories: [
                    snapshot.path,
                    ...current.recentRepositories.filter(
                        (path) => path !== snapshot.path,
                    ),
                ].slice(0, 12),
                error: null,
            }));
            await refreshOnce(snapshot.id);
            await watch(snapshot);
        },
        [refreshOnce, watch],
    );

    useEffect(() => {
        if (!isTauriRuntime() || restored.current) return;
        restored.current = true;
        const restore = async (): Promise<void> => {
            try {
                const { load } = await import("@tauri-apps/plugin-store");
                const store = await load("settings.json", {
                    autoSave: 200,
                    defaults: {},
                });
                const paths = validStoredPaths(
                    await store.get<unknown>("openRepositoryPaths"),
                );
                const activePath = await store.get<unknown>(
                    "activeRepositoryPath",
                );
                const recentRepositories = validStoredPaths(
                    await store.get<unknown>("recentRepositories"),
                );
                const results = await Promise.allSettled(
                    paths.map(
                        async (path): Promise<RepositorySnapshot> =>
                            gitBridge.openRepository(path),
                    ),
                );
                const snapshots: RepositorySnapshot[] = [];
                const sessions = results.map(
                    (result, index): WorkspaceRepositorySession => {
                        const path = paths[index] ?? "Unknown repository";
                        if (result.status === "fulfilled") {
                            snapshots.push(result.value);
                            return loadingSession(result.value);
                        }
                        return {
                            kind: "error",
                            status: "error",
                            id: `error:${path}`,
                            path,
                            message: errorMessage(result.reason),
                        };
                    },
                );
                setState({
                    sessions,
                    activeTab: restoredWorkspaceTab(sessions, activePath),
                    recentRepositories,
                    restoring: false,
                    error: null,
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
                    error: errorMessage(error),
                }));
            }
        };
        void restore();
    }, [refreshOnce, watch]);

    useEffect(() => {
        if (!isTauriRuntime() || state.restoring) return;
        const persist = async (): Promise<void> => {
            const { load } = await import("@tauri-apps/plugin-store");
            const store = await load("settings.json", {
                autoSave: 200,
                defaults: {},
            });
            await Promise.all([
                store.set(
                    "openRepositoryPaths",
                    JSON.parse(openRepositoryPathsJson),
                ),
                store.set("activeRepositoryPath", activeRepositoryPath),
                store.set(
                    "recentRepositories",
                    JSON.parse(recentRepositoriesJson),
                ),
            ]);
        };
        void persist();
    }, [
        activeRepositoryPath,
        openRepositoryPathsJson,
        recentRepositoriesJson,
        state.restoring,
    ]);

    useEffect(
        () => () => {
            for (const repositoryId of watchedRepositories.current) {
                void gitBridge.unwatchRepository(repositoryId);
            }
        },
        [],
    );

    const openRepository = useCallback(
        async (path: string): Promise<void> => {
            try {
                await addSnapshot(await gitBridge.openRepository(path), true);
            } catch (error) {
                setState((current) => ({
                    ...current,
                    error: errorMessage(error),
                }));
            }
        },
        [addSnapshot],
    );

    const initializeRepository = useCallback(
        async (path: string, bare: boolean): Promise<void> => {
            try {
                await addSnapshot(
                    await gitBridge.initializeRepository(path, bare),
                    true,
                );
            } catch (error) {
                setState((current) => ({
                    ...current,
                    error: errorMessage(error),
                }));
            }
        },
        [addSnapshot],
    );

    const cloneRepository = useCallback(
        async (
            url: string,
            path: string,
            depth: number | null,
        ): Promise<void> => {
            try {
                await addSnapshot(
                    await gitBridge.cloneRepository(url, path, depth),
                    true,
                );
            } catch (error) {
                setState((current) => ({
                    ...current,
                    error: errorMessage(error),
                }));
            }
        },
        [addSnapshot],
    );

    const activateTab = useCallback(
        async (tab: WorkspaceTab): Promise<void> => {
            activeRepositoryId.current =
                tab.kind === "repository" ? tab.repositoryId : null;
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
                watchedRepositories.current.delete(sessionId);
                gitConsoleStore.remove(sessionId);
                refreshCoordinator.forget(sessionId);
                rawRepositoryData.current.delete(sessionId);
            }
            setState((current) => ({
                ...current,
                sessions: current.sessions.filter((candidate) =>
                    candidate.kind === "repository"
                        ? candidate.repository.snapshot.id !== sessionId
                        : candidate.id !== sessionId,
                ),
                activeTab:
                    (current.activeTab.kind === "repository" &&
                        current.activeTab.repositoryId === sessionId) ||
                    (current.activeTab.kind === "error" &&
                        current.activeTab.sessionId === sessionId)
                        ? { kind: "manage" }
                        : current.activeTab,
            }));
        },
        [fixture, refreshCoordinator, state.sessions],
    );

    const activeSnapshot = useCallback((): RepositorySnapshot => {
        const snapshot = activeSnapshotRef.current;
        if (!snapshot) throw new Error("Open a repository first");
        return snapshot;
    }, []);

    const executeOperation = useCallback(
        async (operation: GitOperation): Promise<void> => {
            if (fixture) return;
            const snapshot = activeSnapshot();
            try {
                await runRequest({
                    kind: "operation",
                    repositoryId: snapshot.id,
                    operation,
                });
                refreshCoordinator.invalidate(
                    snapshot.id,
                    invalidationsForOperation(operation),
                );
                const recoveryEntries = recordsRecovery(operation)
                    ? await gitBridge.listRecoveryEntries(snapshot.id)
                    : null;
                await refreshCoordinator.flush(snapshot.id);
                if (recoveryEntries) {
                    setState((current) =>
                        updateRepositorySession(
                            current,
                            snapshot.id,
                            (session) =>
                                sameValue(
                                    recoveryEntries,
                                    session.recoveryEntries,
                                )
                                    ? session
                                    : { ...session, recoveryEntries },
                        ),
                    );
                }
            } catch (error) {
                setState((current) =>
                    updateRepositorySession(
                        current,
                        snapshot.id,
                        (session) => ({
                            ...session,
                            error: errorMessage(error),
                        }),
                    ),
                );
            }
        },
        [activeSnapshot, fixture, refreshCoordinator, runRequest],
    );

    const reload = useCallback(async (): Promise<void> => {
        if (!activeSession) return;
        const repositoryId = activeSession.repository.snapshot.id;
        await refreshCoordinator.flush(repositoryId);
        await refreshOnce(repositoryId);
    }, [activeSession, refreshCoordinator, refreshOnce]);

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
        async (commit: Commit, path: string): Promise<string> => {
            if (fixture) return (await requireFixtureData()).samplePatch;
            const snapshot = activeSnapshot();
            return runRequest({
                kind: "diff",
                repositoryId: snapshot.id,
                from:
                    commit.parents[0] ??
                    "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
                to: commit.oid,
                paths: [path],
                staged: false,
            });
        },
        [activeSnapshot, fixture, runRequest],
    );

    const loadWorkingDiff = useCallback(
        async (path: string, staged: boolean): Promise<string> => {
            if (fixture) return (await requireFixtureData()).samplePatch;
            const snapshot = activeSnapshot();
            return runRequest({
                kind: "diff",
                repositoryId: snapshot.id,
                from: null,
                to: null,
                paths: [path],
                staged,
            });
        },
        [activeSnapshot, fixture, runRequest],
    );

    const loadTree = useCallback(
        async (
            revision: string,
            path?: string,
        ): Promise<readonly TreeEntry[]> => {
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

    const loadFileHistory = useCallback(
        async (path: string): Promise<readonly Commit[]> => {
            if (fixture)
                return (
                    await requireFixtureData()
                ).sampleRepository.commits.slice(0, 8);
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
        async (
            path: string,
            revision?: string,
        ): Promise<readonly BlameLine[]> => {
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
                const { samplePatch } = await requireFixtureData();
                return {
                    kind: "text",
                    path,
                    content: samplePatch,
                    sizeBytes: samplePatch.length,
                    lineCount: samplePatch.split("\n").length,
                };
            }
            return gitBridge.readFile(activeSnapshot().id, source, path);
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
            if (fixture)
                return (await requireFixtureData()).sampleCommitFiles.slice(
                    0,
                    2,
                );
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
            const shelf = await gitBridge.createShelf(
                snapshot.id,
                message,
                paths,
            );
            setState((current) =>
                updateRepositorySession(current, snapshot.id, (session) => ({
                    ...session,
                    shelves: [
                        shelf,
                        ...session.shelves.filter(
                            (item) => item.id !== shelf.id,
                        ),
                    ],
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
                    updateRepositorySession(
                        current,
                        snapshot.id,
                        (session) => ({
                            ...session,
                            shelves: session.shelves.filter(
                                (shelf) => shelf.id !== shelfId,
                            ),
                        }),
                    ),
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
                    shelves: session.shelves.filter(
                        (shelf) => shelf.id !== shelfId,
                    ),
                })),
            );
        },
        [activeSnapshot],
    );

    const saveChangelist = useCallback(
        async (
            id: string | null,
            name: string,
            paths: readonly string[],
        ): Promise<Changelist> => {
            const snapshot = activeSnapshot();
            const saved = await gitBridge.saveChangelist(
                snapshot.id,
                id,
                name,
                paths,
            );
            setState((current) =>
                updateRepositorySession(current, snapshot.id, (session) => ({
                    ...session,
                    changelists: [
                        ...session.changelists.filter(
                            (changelist) => changelist.id !== saved.id,
                        ),
                        saved,
                    ].sort(
                        (left, right) => left.createdAtMs - right.createdAtMs,
                    ),
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
                    changelists: session.changelists.filter(
                        (changelist) => changelist.id !== changelistId,
                    ),
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
        ): Promise<ChangelistCommitResult> => {
            const snapshot = activeSnapshot();
            const result = await gitBridge.commitChangelist(
                snapshot.id,
                changelistId,
                message,
                amend,
                false,
                false,
            );
            refreshCoordinator.invalidate(snapshot.id, ["status", "history"]);
            await refreshCoordinator.flush(snapshot.id);
            return result;
        },
        [activeSnapshot, refreshCoordinator],
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
                (repositoryId) =>
                    gitBridge.writeConflictResult(
                        repositoryId,
                        path,
                        result,
                        stage,
                    ),
                ["status", "operation"],
            );
        },
        [mutateAndRefresh],
    );

    const resolveBinaryConflict = useCallback(
        async (path: string, side: "ours" | "theirs"): Promise<void> => {
            await mutateAndRefresh(
                (repositoryId) =>
                    gitBridge.resolveBinaryConflict(repositoryId, path, side),
                ["status", "operation"],
            );
        },
        [mutateAndRefresh],
    );

    const executeSynchronizedBranchOperation = useCallback(
        async (
            repositoryIds: readonly string[],
            operation: GitOperation,
        ): Promise<MultiRootResult> => {
            const result = await gitBridge.executeSynchronizedBranchOperation(
                repositoryIds,
                operation,
            );
            if (activeSession) {
                const repositoryId = activeSession.repository.snapshot.id;
                refreshCoordinator.invalidate(
                    repositoryId,
                    invalidationsForOperation(operation),
                );
                await refreshCoordinator.flush(repositoryId);
            }
            return result;
        },
        [activeSession, refreshCoordinator],
    );

    const applyMultiRootRollback = useCallback(
        async (
            steps: readonly MultiRootRollbackStep[],
        ): Promise<readonly MultiRootOutcome[]> => {
            const outcomes = await gitBridge.applyMultiRootRollback(steps);
            if (activeSession) {
                const repositoryId = activeSession.repository.snapshot.id;
                refreshCoordinator.invalidate(repositoryId, [
                    "status",
                    "history",
                    "management",
                ]);
                await refreshCoordinator.flush(repositoryId);
            }
            return outcomes;
        },
        [activeSession, refreshCoordinator],
    );

    const cancelConsoleRequest = useCallback(
        async (requestId: string): Promise<void> => {
            await gitBridge.cancel(requestId);
        },
        [],
    );

    const clearConsole = useCallback((): void => {
        if (!activeSession) return;
        gitConsoleStore.clear(activeSession.repository.snapshot.id);
    }, [activeSession]);

    const openRepositories = state.sessions.flatMap((session) =>
        session.kind === "repository" ? [session.repository.snapshot] : [],
    );

    return {
        sessions: state.sessions,
        activeTab: state.activeTab,
        recentRepositories: state.recentRepositories,
        restoring: state.restoring,
        error: state.error ?? activeSession?.error ?? null,
        fixture,
        repository: activeSession?.repository ?? null,
        repositoryError: activeErrorSession,
        managementRepository: managementSession?.repository ?? null,
        loading: activeSession?.status === "loading",
        stale: activeSession?.stale ?? false,
        consoleStore: gitConsoleStore,
        shelves: activeSession?.shelves ?? EMPTY_ARRAY,
        stashes: activeSession?.stashes ?? EMPTY_ARRAY,
        changelists: activeSession?.changelists ?? EMPTY_ARRAY,
        recoveryEntries: activeSession?.recoveryEntries ?? EMPTY_ARRAY,
        conflicts: activeSession?.conflicts ?? EMPTY_ARRAY,
        remotes: (activeSession ?? managementSession)?.remotes ?? EMPTY_ARRAY,
        worktrees:
            (activeSession ?? managementSession)?.worktrees ?? EMPTY_ARRAY,
        openRepositories,
        openRepository,
        initializeRepository,
        cloneRepository,
        activateTab,
        closeRepository,
        switchRepository,
        reload,
        loadCommitFiles,
        loadCommitDiff,
        loadWorkingDiff,
        loadTree,
        loadFileHistory,
        loadBlame,
        readFile,
        openWorkingTreeFile,
        loadStashFiles,
        loadStashPatch,
        executeOperation,
        createShelf,
        applyShelf,
        deleteShelf,
        saveChangelist,
        deleteChangelist,
        commitChangelist,
        restoreRecoveryEntry,
        readConflict,
        saveConflictResult,
        resolveBinaryConflict,
        executeSynchronizedBranchOperation,
        applyMultiRootRollback,
        cancelConsoleRequest,
        clearConsole,
    };
}
