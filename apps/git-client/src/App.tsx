import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauriRuntime } from "./bridge/GitBridge";
import { BottomPanel } from "./components/BottomPanel";
import { BranchTree } from "./components/BranchTree";
import { CommitContextMenu } from "./components/CommitContextMenu";
import { CommitLog } from "./components/CommitLog";
import { ConflictEditorDialog } from "./components/ConflictEditorDialog";
import { DetailsPane } from "./components/DetailsPane";
import { DiffDialog } from "./components/DiffDialog";
import { Icon } from "./components/Icon";
import { RepositoryDialog } from "./components/RepositoryDialog";
import {
    RepositoryInspectorDialog,
    type InspectorTab,
} from "./components/RepositoryInspectorDialog";
import { RepositoryManagementDialog } from "./components/RepositoryManagementDialog";
import { deriveActionAvailability } from "./domain/actionAvailability";
import { commitUrl } from "./domain/forge";
import { terminalService } from "./domain/TerminalService";
import type {
    ActionAvailability,
    Commit,
    FileChange,
    Ref,
    RepositoryView,
    StashEntry,
} from "./domain/types";
import type { ConflictContent, FileSource } from "./generated";
import {
    useGitSession,
    type WorkspaceRepositorySession,
} from "./hooks/useGitSession";
import styles from "./styles/App.module.css";

interface ContextPosition {
    readonly x: number;
    readonly y: number;
}

interface DiffState {
    readonly file: FileChange;
    readonly patch: string;
    readonly loading: boolean;
    readonly mode: "readOnly" | "stage" | "unstage";
}

interface InspectorState {
    readonly revision: string;
    readonly source: FileSource;
    readonly path?: string;
    readonly tab: InspectorTab;
}

type GitSession = ReturnType<typeof useGitSession>;
const commitFilesCache = new Map<string, readonly FileChange[]>();
const COMMIT_FILES_CACHE_LIMIT = 200;

function cacheCommitFiles(key: string, files: readonly FileChange[]): void {
    commitFilesCache.delete(key);
    commitFilesCache.set(key, files);
    const oldest = commitFilesCache.keys().next().value;
    if (
        commitFilesCache.size > COMMIT_FILES_CACHE_LIMIT &&
        typeof oldest === "string"
    ) {
        commitFilesCache.delete(oldest);
    }
}

function WorkspaceTitlebar({
    session,
    dark,
    onToggleTheme,
}: {
    readonly session: GitSession;
    readonly dark: boolean;
    readonly onToggleTheme: () => void;
}) {
    return (
        <header className={styles.titlebar}>
            <div className={styles.trafficSpace} data-tauri-drag-region />
            <nav aria-label="Workspace tabs">
                <button
                    className={
                        session.activeTab.kind === "manage"
                            ? styles.activeTopTab
                            : styles.appTab
                    }
                    onClick={() => void session.activateTab({ kind: "manage" })}
                >
                    <Icon name="folder" size={14} />
                    Manage
                </button>
                {session.sessions.map((item) => {
                    const id =
                        item.kind === "repository"
                            ? item.repository.snapshot.id
                            : item.id;
                    const active =
                        (session.activeTab.kind === "repository" &&
                            session.activeTab.repositoryId === id) ||
                        (session.activeTab.kind === "error" &&
                            session.activeTab.sessionId === id);
                    const label =
                        item.kind === "repository"
                            ? item.repository.snapshot.name
                            : item.path;
                    return (
                        <span className={styles.workspaceTab} key={id}>
                            <button
                                className={
                                    active ? styles.activeTopTab : undefined
                                }
                                onClick={() =>
                                    void session.activateTab(
                                        item.kind === "repository"
                                            ? {
                                                  kind: "repository",
                                                  repositoryId: id,
                                              }
                                            : { kind: "error", sessionId: id },
                                    )
                                }
                                title={
                                    item.kind === "repository"
                                        ? item.repository.snapshot.path
                                        : item.message
                                }
                            >
                                <Icon
                                    name={
                                        item.kind === "repository"
                                            ? "branch"
                                            : "warning"
                                    }
                                    size={13}
                                />
                                {label}
                                {item.kind === "repository" && item.stale && (
                                    <em>•</em>
                                )}
                            </button>
                            <button
                                aria-label={`Close ${label}`}
                                className={styles.closeTab}
                                onClick={() => {
                                    if (
                                        item.kind === "repository" &&
                                        terminalService.count(
                                            item.repository.snapshot.id,
                                        ) > 0 &&
                                        !window.confirm(
                                            `Close ${label} and terminate its running terminal sessions?`,
                                        )
                                    ) {
                                        return;
                                    }
                                    void session.closeRepository(id);
                                }}
                            >
                                ×
                            </button>
                        </span>
                    );
                })}
            </nav>
            <span className={styles.titleRepo} data-tauri-drag-region>
                {session.repository?.snapshot.name ?? "Git Client"}
            </span>
            <button
                className={styles.iconButton}
                onClick={onToggleTheme}
                title="Toggle theme"
            >
                <Icon name={dark ? "sun" : "moon"} size={14} />
            </button>
        </header>
    );
}

function ManageWorkspace({
    session,
    onAddRepository,
}: {
    readonly session: GitSession;
    readonly onAddRepository: () => void;
}) {
    return (
        <main className={styles.manageWorkspace}>
            {!isTauriRuntime() && !session.fixture && (
                <section className={styles.browserModeNotice}>
                    <Icon name="warning" size={18} />
                    <div>
                        <strong>
                            Browser preview has no native Git bridge
                        </strong>
                        <p>
                            Run{" "}
                            <code>
                                pnpm --filter @jongminchung/git-client tauri:dev
                            </code>{" "}
                            for real repositories, or open the explicit QA
                            fixture.
                        </p>
                    </div>
                    <a href="/?fixture=qa">Open QA fixture</a>
                </section>
            )}
            {session.repositoryError && (
                <section className={styles.browserModeNotice}>
                    <Icon name="warning" size={18} />
                    <div>
                        <strong>
                            Could not restore {session.repositoryError.path}
                        </strong>
                        <p>{session.repositoryError.message}</p>
                    </div>
                </section>
            )}
            <RepositoryManagementDialog
                currentRepositoryId={
                    session.managementRepository?.snapshot.id ?? null
                }
                embedded
                onAddRoot={async () => onAddRepository()}
                onOpenWorktree={async (path) => session.openRepository(path)}
                onOperation={session.executeOperation}
                onRollback={session.applyMultiRootRollback}
                onSwitchRepository={session.switchRepository}
                onSynchronizedOperation={
                    session.executeSynchronizedBranchOperation
                }
                openRepositories={session.openRepositories}
                remotes={session.remotes}
                worktrees={session.worktrees}
            />
        </main>
    );
}

function RepositoryWorkspace({
    repository,
    session,
    onAddRepository,
}: {
    readonly repository: RepositoryView;
    readonly session: GitSession;
    readonly onAddRepository: () => void;
}) {
    const [selectedOids, setSelectedOids] = useState<readonly string[]>(
        repository.commits[0] ? [repository.commits[0].oid] : [],
    );
    const [selectedRef, setSelectedRef] = useState<string | undefined>(
        repository.refs.find((ref) => ref.current)?.name,
    );
    const [contextPosition, setContextPosition] = useState<ContextPosition>();
    const [diffState, setDiffState] = useState<DiffState>();
    const [conflictContent, setConflictContent] = useState<ConflictContent>();
    const [inspector, setInspector] = useState<InspectorState>();
    const [commitFiles, setCommitFiles] = useState<readonly FileChange[]>([]);
    const [commitFilesLoading, setCommitFilesLoading] = useState(false);
    const [bottomCollapsed, setBottomCollapsed] = useState(false);
    const [toast, setToast] = useState<string>();
    const [uiStateRestored, setUiStateRestored] = useState(!isTauriRuntime());
    const commitsByOid = useMemo(
        () => new Map(repository.commits.map((commit) => [commit.oid, commit])),
        [repository.commits],
    );
    const selectedCommits = useMemo(
        () =>
            selectedOids
                .map((oid) => commitsByOid.get(oid))
                .filter((commit): commit is Commit => Boolean(commit)),
        [commitsByOid, selectedOids],
    );
    const primaryCommit = selectedCommits[0];
    const primaryCommitOid = primaryCommit?.oid;
    const primaryIndex = primaryCommit
        ? repository.commits.findIndex(
              (commit) => commit.oid === primaryCommit.oid,
          )
        : -1;
    const availability = useMemo(
        () =>
            deriveActionAvailability({
                selectedCommits,
                currentBranch: repository.snapshot.currentBranch ?? undefined,
                headOid: repository.snapshot.headOid ?? undefined,
                upstream: repository.snapshot.upstream ?? undefined,
                selectedIsAncestorOfHead: primaryIndex >= 0,
                selectedIsAheadOfUpstream:
                    primaryIndex >= 0 && primaryIndex < repository.status.ahead,
                hasChild: Boolean(
                    primaryCommit &&
                    repository.commits.some((commit) =>
                        commit.parents.includes(primaryCommit.oid),
                    ),
                ),
                repositoryHasCommits: repository.snapshot.hasCommits,
                operationInProgress: repository.snapshot.operation !== null,
            }),
        [
            primaryCommit,
            primaryIndex,
            repository.commits,
            repository.snapshot,
            repository.status.ahead,
            selectedCommits,
        ],
    );

    useEffect(() => {
        if (
            !repository.commits.some((commit) =>
                selectedOids.includes(commit.oid),
            )
        ) {
            setSelectedOids(
                repository.commits[0] ? [repository.commits[0].oid] : [],
            );
        }
    }, [repository.commits, selectedOids]);

    useEffect(() => {
        if (!isTauriRuntime()) return;
        let active = true;
        const restore = async (): Promise<void> => {
            try {
                const { load } = await import("@tauri-apps/plugin-store");
                const store = await load("settings.json", {
                    autoSave: 200,
                    defaults: {},
                });
                const stored = await store.get<unknown>(
                    `repositoryUiState:${repository.snapshot.id}`,
                );
                if (
                    !active ||
                    !stored ||
                    typeof stored !== "object" ||
                    Array.isArray(stored)
                )
                    return;
                const storedOids = Reflect.get(stored, "selectedOids");
                const storedRef = Reflect.get(stored, "selectedRef");
                const storedCollapsed = Reflect.get(stored, "bottomCollapsed");
                if (Array.isArray(storedOids)) {
                    setSelectedOids(
                        storedOids.filter(
                            (value): value is string =>
                                typeof value === "string",
                        ),
                    );
                }
                if (typeof storedRef === "string") setSelectedRef(storedRef);
                if (typeof storedCollapsed === "boolean")
                    setBottomCollapsed(storedCollapsed);
            } catch (error) {
                console.warn("Could not restore repository UI state", error);
            } finally {
                if (active) setUiStateRestored(true);
            }
        };
        void restore();
        return () => {
            active = false;
        };
    }, [repository.snapshot.id]);

    useEffect(() => {
        if (!isTauriRuntime() || !uiStateRestored) return;
        const persist = async (): Promise<void> => {
            try {
                const { load } = await import("@tauri-apps/plugin-store");
                const store = await load("settings.json", {
                    autoSave: 200,
                    defaults: {},
                });
                await store.set(`repositoryUiState:${repository.snapshot.id}`, {
                    selectedOids,
                    selectedRef: selectedRef ?? null,
                    bottomCollapsed,
                });
            } catch (error) {
                console.warn("Could not persist repository UI state", error);
            }
        };
        void persist();
    }, [
        bottomCollapsed,
        repository.snapshot.id,
        selectedOids,
        selectedRef,
        uiStateRestored,
    ]);

    useEffect(() => {
        if (!toast) return;
        const timeout = window.setTimeout(() => setToast(undefined), 2_800);
        return () => window.clearTimeout(timeout);
    }, [toast]);

    useEffect(() => {
        if (!primaryCommitOid) {
            setCommitFiles([]);
            setCommitFilesLoading(false);
            return;
        }
        const cacheKey = `${repository.snapshot.id}:${primaryCommitOid}`;
        const cached = commitFilesCache.get(cacheKey);
        if (cached) {
            setCommitFiles(cached);
            setCommitFilesLoading(false);
            return;
        }
        let active = true;
        const load = async (): Promise<void> => {
            setCommitFilesLoading(true);
            try {
                const files = await session.loadCommitFiles(primaryCommitOid);
                if (active) {
                    cacheCommitFiles(cacheKey, files);
                    setCommitFiles(files);
                }
            } catch {
                if (active) setCommitFiles([]);
            } finally {
                if (active) setCommitFilesLoading(false);
            }
        };
        void load();
        return () => {
            active = false;
        };
    }, [primaryCommitOid, repository.snapshot.id, session.loadCommitFiles]);

    const openDiff = useCallback(
        (file: FileChange): void => {
            if (!primaryCommit) return;
            setDiffState({ file, patch: "", loading: true, mode: "readOnly" });
            const load = async (): Promise<void> => {
                try {
                    const patch = await session.loadCommitDiff(
                        primaryCommit,
                        file.path,
                    );
                    setDiffState((current) =>
                        current?.file.path === file.path
                            ? { file, patch, loading: false, mode: "readOnly" }
                            : current,
                    );
                } catch (error) {
                    setDiffState((current) =>
                        current?.file.path === file.path
                            ? {
                                  file,
                                  patch: `Unable to load diff: ${String(error)}`,
                                  loading: false,
                                  mode: "readOnly",
                              }
                            : current,
                    );
                }
            };
            void load();
        },
        [primaryCommit, session.loadCommitDiff],
    );

    const openWorkingDiff = useCallback(
        (file: FileChange, staged: boolean): void => {
            if (file.status === "conflicted") {
                const loadConflict = async (): Promise<void> => {
                    try {
                        setConflictContent(
                            await session.readConflict(file.path),
                        );
                    } catch (error) {
                        setToast(`Unable to read conflict: ${String(error)}`);
                    }
                };
                void loadConflict();
                return;
            }
            const mode = staged ? "unstage" : "stage";
            setDiffState({ file, patch: "", loading: true, mode });
            const load = async (): Promise<void> => {
                try {
                    setDiffState({
                        file,
                        patch: await session.loadWorkingDiff(file.path, staged),
                        loading: false,
                        mode,
                    });
                } catch (error) {
                    setDiffState({
                        file,
                        patch: `Unable to load diff: ${String(error)}`,
                        loading: false,
                        mode,
                    });
                }
            };
            void load();
        },
        [session.loadWorkingDiff, session.readConflict],
    );

    const openStashDiff = useCallback(
        (stash: StashEntry): void => {
            const file: FileChange = {
                path: stash.selector,
                status: "modified",
                staged: false,
                worktree: false,
            };
            setDiffState({ file, patch: "", loading: true, mode: "readOnly" });
            const load = async (): Promise<void> => {
                try {
                    setDiffState({
                        file,
                        patch: await session.loadStashPatch(stash.selector),
                        loading: false,
                        mode: "readOnly",
                    });
                } catch (error) {
                    setDiffState({
                        file,
                        patch: `Unable to load stash: ${String(error)}`,
                        loading: false,
                        mode: "readOnly",
                    });
                }
            };
            void load();
        },
        [session.loadStashPatch],
    );

    const selectRelative = useCallback(
        (direction: "parent" | "child"): void => {
            if (!primaryCommit) return;
            const oid =
                direction === "parent"
                    ? primaryCommit.parents[0]
                    : repository.commits.find((commit) =>
                          commit.parents.includes(primaryCommit.oid),
                      )?.oid;
            if (oid && commitsByOid.has(oid)) setSelectedOids([oid]);
        },
        [commitsByOid, primaryCommit, repository.commits],
    );

    const runAction = useCallback(
        async (action: keyof ActionAvailability): Promise<void> => {
            setContextPosition(undefined);
            if (!primaryCommit || !availability[action]) return;
            if (action === "copyRevision") {
                await navigator.clipboard.writeText(primaryCommit.oid);
                setToast(`Copied ${primaryCommit.oid.slice(0, 8)}`);
            } else if (action === "goToParent") selectRelative("parent");
            else if (action === "goToChild") selectRelative("child");
            else if (action === "cherryPick") {
                await session.executeOperation({
                    kind: "cherryPick",
                    revisions: selectedCommits.map((commit) => commit.oid),
                    noCommit: false,
                });
            } else if (action === "revert") {
                await session.executeOperation({
                    kind: "revert",
                    revisions: selectedCommits.map((commit) => commit.oid),
                    noCommit: false,
                });
            } else if (action === "reset") {
                if (
                    window.confirm(
                        `Reset ${repository.snapshot.currentBranch} to ${primaryCommit.oid.slice(0, 8)}?`,
                    )
                ) {
                    await session.executeOperation({
                        kind: "reset",
                        revision: primaryCommit.oid,
                        mode: "mixed",
                    });
                }
            } else if (action === "newBranch") {
                const name = window.prompt("New branch name", "feat/");
                if (name) {
                    await session.executeOperation({
                        kind: "createBranch",
                        name,
                        startPoint: primaryCommit.oid,
                        checkout: false,
                    });
                }
            } else if (action === "newTag") {
                const name = window.prompt("New tag name", "v0.1.0");
                if (name) {
                    await session.executeOperation({
                        kind: "createTag",
                        name,
                        revision: primaryCommit.oid,
                        message: null,
                    });
                }
            } else if (action === "pushUpTo") {
                const remote =
                    (repository.snapshot.upstream ?? "origin/main").split(
                        "/",
                    )[0] ?? "origin";
                await session.executeOperation({
                    kind: "pushTo",
                    remote,
                    revision: primaryCommit.oid,
                    destination: `refs/heads/${repository.snapshot.currentBranch ?? "main"}`,
                });
            } else if (action === "viewInBrowser") {
                const url = repository.snapshot.remoteUrl
                    ? commitUrl(
                          repository.snapshot.remoteUrl,
                          primaryCommit.oid,
                      )
                    : undefined;
                if (!url)
                    setToast(
                        "The origin remote is not a supported GitHub or GitLab URL.",
                    );
                else if (isTauriRuntime()) {
                    const { openUrl } =
                        await import("@tauri-apps/plugin-opener");
                    await openUrl(url);
                } else window.open(url, "_blank", "noopener,noreferrer");
            } else if (action === "createPatch") {
                await navigator.clipboard.writeText(
                    `git format-patch -1 ${primaryCommit.oid}`,
                );
                setToast("Patch command copied.");
            } else if (action === "showRepositoryAtRevision") {
                setInspector({
                    revision: primaryCommit.oid,
                    source: { kind: "revision", revision: primaryCommit.oid },
                    tab: "tree",
                });
            } else if (action === "compareVersions") {
                setToast("Select a second commit to compare versions.");
            } else if (action === "drop") {
                if (
                    window.confirm(
                        `Drop ${selectedCommits.length} commit(s) with interactive rebase?`,
                    )
                ) {
                    await session.executeOperation({
                        kind: "dropCommits",
                        revisions: selectedCommits.map((commit) => commit.oid),
                    });
                }
            } else if (action === "squash") {
                if (
                    window.confirm(
                        `Squash ${selectedCommits.length} contiguous commits?`,
                    )
                ) {
                    await session.executeOperation({
                        kind: "squashCommits",
                        revisions: selectedCommits.map((commit) => commit.oid),
                    });
                }
            }
        },
        [
            availability,
            primaryCommit,
            repository.snapshot,
            selectRelative,
            selectedCommits,
            session,
        ],
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            const target = event.target as HTMLElement | null;
            if (
                target?.matches(
                    "input, textarea, select, [contenteditable=true]",
                )
            )
                return;
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === "c"
            ) {
                event.preventDefault();
                void runAction("copyRevision");
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                selectRelative("parent");
            } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                selectRelative("child");
            } else if (event.key === "Escape") setContextPosition(undefined);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [runAction, selectRelative]);

    const selectRef = (ref: Ref): void => {
        setSelectedRef(ref.name);
        if (commitsByOid.has(ref.oid)) setSelectedOids([ref.oid]);
    };

    return (
        <>
            <div className={styles.commandbar}>
                <button
                    className={styles.repositoryButton}
                    onClick={onAddRepository}
                >
                    <span className={styles.repoMark}>
                        <Icon name="branch" size={14} />
                    </span>
                    <span>
                        <strong>{repository.snapshot.name}</strong>
                        <small>{repository.snapshot.path}</small>
                    </span>
                    <Icon name="chevron" size={12} />
                </button>
                <span className={styles.commandDivider} />
                <button onClick={() => void session.reload()} title="Refresh">
                    <Icon name="refresh" size={15} />
                </button>
                <button
                    onClick={() =>
                        void session.executeOperation({
                            kind: "fetch",
                            remote: null,
                            prune: false,
                        })
                    }
                    title="Fetch"
                >
                    <Icon name="fetch" size={15} />
                    <span>Fetch</span>
                </button>
                <button
                    onClick={() =>
                        void session.executeOperation({
                            kind: "pull",
                            rebase: false,
                        })
                    }
                    title="Pull"
                >
                    <Icon name="pull" size={15} />
                    <span>Pull</span>
                </button>
                <button
                    onClick={() =>
                        void session.executeOperation({
                            kind: "push",
                            remote: null,
                            refspec: null,
                            forceWithLease: false,
                        })
                    }
                    title="Push"
                >
                    <Icon name="push" size={15} />
                    <span>Push</span>
                    {repository.status.ahead > 0 && (
                        <em>{repository.status.ahead}</em>
                    )}
                </button>
                <span className={styles.commandDivider} />
                <button>
                    <Icon name="branch" size={15} />
                    <span>
                        {repository.snapshot.currentBranch ?? "Detached HEAD"}
                    </span>
                    <Icon name="chevron" size={11} />
                </button>
                <span />
                {session.stale && (
                    <span className={styles.statePill}>Changed</span>
                )}
                {repository.snapshot.isShallow && (
                    <span className={styles.statePill}>Shallow</span>
                )}
                {repository.snapshot.isBare && (
                    <span className={styles.statePill}>Bare</span>
                )}
                {repository.snapshot.operation && (
                    <span className={styles.operationPill}>
                        <Icon name="warning" size={13} />
                        {repository.snapshot.operation} in progress
                    </span>
                )}
                <button
                    aria-label="Manage repositories"
                    className={styles.iconButton}
                    onClick={() => void session.activateTab({ kind: "manage" })}
                >
                    <Icon name="more" size={16} />
                </button>
            </div>
            <main className={styles.workspace} aria-busy={session.loading}>
                <div className={styles.mainPanes}>
                    <BranchTree
                        onAdd={onAddRepository}
                        onSelect={selectRef}
                        refs={repository.refs}
                        selected={selectedRef}
                    />
                    <CommitLog
                        commits={repository.commits}
                        onContextMenu={(event, commit) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!selectedOids.includes(commit.oid))
                                setSelectedOids([commit.oid]);
                            setContextPosition({
                                x: event.clientX,
                                y: event.clientY,
                            });
                        }}
                        onSelectionChange={setSelectedOids}
                        selectedOids={selectedOids}
                    />
                    <DetailsPane
                        commit={primaryCommit}
                        files={commitFiles}
                        loading={commitFilesLoading}
                        onInspectFile={(file, tab) => {
                            if (primaryCommit) {
                                setInspector({
                                    revision: primaryCommit.oid,
                                    source: {
                                        kind: "revision",
                                        revision: primaryCommit.oid,
                                    },
                                    path: file.path,
                                    tab,
                                });
                            }
                        }}
                        onOpenDiff={openDiff}
                        onOpenTree={() => {
                            if (primaryCommit) {
                                setInspector({
                                    revision: primaryCommit.oid,
                                    source: {
                                        kind: "revision",
                                        revision: primaryCommit.oid,
                                    },
                                    tab: "tree",
                                });
                            }
                        }}
                    />
                </div>
                <BottomPanel
                    changelists={session.changelists}
                    collapsed={bottomCollapsed}
                    consoleStore={session.consoleStore}
                    fixture={session.fixture}
                    onApplyShelf={(shelfId, drop) =>
                        void session.applyShelf(shelfId, drop)
                    }
                    onCancelConsoleRequest={session.cancelConsoleRequest}
                    onClearConsole={session.clearConsole}
                    onCommitChangelist={async (
                        changelistId,
                        message,
                        amend,
                    ) => {
                        await session.commitChangelist(
                            changelistId,
                            message,
                            amend,
                        );
                    }}
                    onCreateShelf={(message, paths) =>
                        void session.createShelf(message, paths)
                    }
                    onDeleteChangelist={session.deleteChangelist}
                    onDeleteShelf={(shelfId) =>
                        void session.deleteShelf(shelfId)
                    }
                    onInspectFile={(file, staged, tab) =>
                        setInspector({
                            revision: repository.snapshot.headOid ?? "HEAD",
                            source: staged
                                ? { kind: "index" }
                                : { kind: "workingTree" },
                            path: file.path,
                            tab,
                        })
                    }
                    onLoadStashFiles={(stash) =>
                        session.loadStashFiles(stash.selector)
                    }
                    onOpenDiff={openWorkingDiff}
                    onOpenStashDiff={openStashDiff}
                    onOperation={session.executeOperation}
                    onRestoreRecovery={session.restoreRecoveryEntry}
                    onSaveChangelist={session.saveChangelist}
                    onToggle={() => setBottomCollapsed((value) => !value)}
                    onViewFile={(file, staged) =>
                        setInspector({
                            revision: repository.snapshot.headOid ?? "HEAD",
                            source: staged
                                ? { kind: "index" }
                                : { kind: "workingTree" },
                            path: file.path,
                            tab: "file",
                        })
                    }
                    recoveryEntries={session.recoveryEntries}
                    repositoryId={repository.snapshot.id}
                    shelves={session.shelves}
                    stashes={session.stashes}
                    status={repository.status}
                />
                {session.loading && <div className={styles.progressLine} />}
            </main>
            <footer className={styles.statusbar}>
                <span>
                    <Icon name="branch" size={12} />
                    {repository.snapshot.currentBranch ?? "HEAD"}
                </span>
                <span>
                    {repository.status.ahead}↑ {repository.status.behind}↓
                </span>
                <span />
                <span>{repository.snapshot.gitVersion.display}</span>
                <span>UTF-8</span>
                <span>LF</span>
            </footer>
            {contextPosition && (
                <CommitContextMenu
                    availability={availability}
                    onAction={(action) => void runAction(action)}
                    x={contextPosition.x}
                    y={contextPosition.y}
                />
            )}
            {diffState && (
                <DiffDialog
                    file={diffState.file}
                    loading={diffState.loading}
                    mode={diffState.mode}
                    onApplyPatch={async (patch, cached, reverse) => {
                        await session.executeOperation({
                            kind: "partialPatch",
                            patch,
                            cached,
                            reverse,
                        });
                        setDiffState(undefined);
                    }}
                    onClose={() => setDiffState(undefined)}
                    patch={diffState.patch}
                />
            )}
            {conflictContent && (
                <ConflictEditorDialog
                    content={conflictContent}
                    onAbort={async () => {
                        const operation = repository.snapshot.operation;
                        if (!operation || operation === "bisect") return;
                        await session.executeOperation({
                            kind: "abort",
                            operation,
                        });
                        setConflictContent(undefined);
                    }}
                    onClose={() => setConflictContent(undefined)}
                    onContinue={async () => {
                        const operation = repository.snapshot.operation;
                        if (!operation || operation === "bisect") return;
                        await session.executeOperation({
                            kind: "continue",
                            operation,
                        });
                        setConflictContent(undefined);
                    }}
                    onResolveBinary={async (side) => {
                        await session.resolveBinaryConflict(
                            conflictContent.path,
                            side,
                        );
                        setConflictContent(undefined);
                    }}
                    onSave={async (result) => {
                        await session.saveConflictResult(
                            conflictContent.path,
                            result,
                            true,
                        );
                        setConflictContent(undefined);
                    }}
                    operation={repository.snapshot.operation}
                />
            )}
            {inspector && (
                <RepositoryInspectorDialog
                    initialPath={inspector.path}
                    initialTab={inspector.tab}
                    loadBlame={session.loadBlame}
                    loadFileHistory={session.loadFileHistory}
                    loadTree={session.loadTree}
                    onClose={() => setInspector(undefined)}
                    openWorkingTreeFile={session.openWorkingTreeFile}
                    readFile={session.readFile}
                    revision={inspector.revision}
                    source={inspector.source}
                />
            )}
            {toast && (
                <div className={styles.toast}>
                    <Icon name="check" size={15} />
                    {toast}
                </div>
            )}
        </>
    );
}

export default function App() {
    const session = useGitSession();
    const [dark, setDark] = useState(
        () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    const [showRepositoryDialog, setShowRepositoryDialog] = useState(false);

    useEffect(() => {
        document.documentElement.dataset.theme = dark ? "dark" : "light";
    }, [dark]);

    const activeError = useMemo<WorkspaceRepositorySession | null>(() => {
        if (session.activeTab.kind !== "error") return null;
        const sessionId = session.activeTab.sessionId;
        return (
            session.sessions.find(
                (item) => item.kind === "error" && item.id === sessionId,
            ) ?? null
        );
    }, [session.activeTab, session.sessions]);

    return (
        <div className={styles.appShell}>
            <WorkspaceTitlebar
                dark={dark}
                onToggleTheme={() => setDark((value) => !value)}
                session={session}
            />
            {session.error && (
                <div className={styles.errorBanner}>
                    <Icon name="warning" size={14} />
                    <span>{session.error}</span>
                </div>
            )}
            {activeError?.kind === "error" ? (
                <main className={styles.repositoryErrorView}>
                    <Icon name="warning" size={28} />
                    <h1>Repository unavailable</h1>
                    <code>{activeError.path}</code>
                    <p>{activeError.message}</p>
                    <button
                        onClick={() =>
                            void session.activateTab({ kind: "manage" })
                        }
                    >
                        Open Manage
                    </button>
                </main>
            ) : session.activeTab.kind === "manage" || !session.repository ? (
                <ManageWorkspace
                    onAddRepository={() => setShowRepositoryDialog(true)}
                    session={session}
                />
            ) : (
                <RepositoryWorkspace
                    key={session.repository.snapshot.id}
                    onAddRepository={() => setShowRepositoryDialog(true)}
                    repository={session.repository}
                    session={session}
                />
            )}
            {showRepositoryDialog && (
                <RepositoryDialog
                    onClone={(url, path, depth) =>
                        void session.cloneRepository(url, path, depth)
                    }
                    onClose={() => setShowRepositoryDialog(false)}
                    onInit={(path, bare) =>
                        void session.initializeRepository(path, bare)
                    }
                    onOpen={(path) => void session.openRepository(path)}
                />
            )}
        </div>
    );
}
