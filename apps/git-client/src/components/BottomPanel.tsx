import {
    memo,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useState,
    useEffect,
    useRef,
    useCallback,
} from "react";
import {
    DEFAULT_BOTTOM_PANEL_HEIGHT,
    MAX_BOTTOM_PANEL_HEIGHT,
    MIN_BOTTOM_PANEL_HEIGHT,
    type WorkspaceBottomPanelTab,
} from "../domain/workspacePersistence";
import type { FileChange, StashEntry, StatusModel } from "../domain/types";
import type { GitConsoleEntry } from "../domain/gitConsole";
import type { GitLocalHistoryEntry } from "../shared/contracts/git-utility";
import { toVoidHandler } from "../domain/toVoidHandler";
import type { GitOperation, RecoveryEntry, ShelfEntry } from "../generated";
import { Icon } from "./Icon";
import { TerminalPanel } from "./TerminalPanel";
import { GitConsolePanel } from "./GitConsolePanel";
import {
    FindResultsPanel,
    type FindResultsSession,
} from "./FindResultsPanel";
import { LocalHistoryPanel } from "./LocalHistoryPanel";
import { useAppDialog } from "./AppDialog";
import { tw } from "../styles/tailwind";
import type { ProjectSearchResult } from "../domain/projectSearch";

export type BottomPanelTab = WorkspaceBottomPanelTab;

const tabs: readonly {
    readonly id: BottomPanelTab;
    readonly label: string;
    readonly icon: Parameters<typeof Icon>[0]["name"];
}[] = [
    { id: "shelf", label: "Shelf", icon: "shelf" },
    { id: "stash", label: "Stash", icon: "stash" },
    { id: "recovery", label: "Recovery", icon: "history" },
    { id: "find", label: "Find", icon: "search" },
    { id: "localHistory", label: "Local History", icon: "history" },
    { id: "gitConsole", label: "Git Console", icon: "branch" },
    { id: "terminal", label: "Terminal", icon: "console" },
];

function isBottomPanelTab(value: unknown): value is BottomPanelTab {
    return tabs.some((tab) => tab.id === value);
}

export const BottomPanel = memo(function BottomPanel({
    status,
    shelves,
    stashes,
    recoveryEntries,
    gitConsoleEntries,
    onOperation,
    onCreateShelf,
    onApplyShelf,
    onDeleteShelf,
    onRestoreRecovery,
    onClearGitConsole,
    onLoadLocalHistory,
    onLoadLocalHistoryDiff,
    onRestoreLocalHistory,
    onCaptureLocalHistory,
    findResults,
    onOpenFindResult,
    onSearchAgain,
    onOpenStashDiff,
    onLoadStashFiles,
    repositoryId,
    fixture,
    collapsed,
    onToggle,
    height,
    onHeightChange,
    active,
    onActiveChange,
}: {
    readonly status: StatusModel;
    readonly shelves: readonly ShelfEntry[];
    readonly stashes: readonly StashEntry[];
    readonly recoveryEntries: readonly RecoveryEntry[];
    readonly gitConsoleEntries: readonly GitConsoleEntry[];
    readonly onOperation: (operation: GitOperation) => Promise<void>;
    readonly onCreateShelf: (message: string, paths: readonly string[]) => void;
    readonly onApplyShelf: (shelfId: string, drop: boolean) => void;
    readonly onDeleteShelf: (shelfId: string) => void;
    readonly onRestoreRecovery: (entryId: string) => Promise<void>;
    readonly onClearGitConsole: () => void;
    readonly onLoadLocalHistory: (path: string | null) => Promise<readonly GitLocalHistoryEntry[]>;
    readonly onLoadLocalHistoryDiff: (entryId: string, path: string) => Promise<string>;
    readonly onRestoreLocalHistory: (entryId: string, path: string) => Promise<void>;
    readonly onCaptureLocalHistory: (label: string | null) => Promise<GitLocalHistoryEntry>;
    readonly findResults: FindResultsSession | null;
    readonly onOpenFindResult: (result: ProjectSearchResult) => void;
    readonly onSearchAgain: () => void;
    readonly onOpenStashDiff: (stash: StashEntry) => void;
    readonly onLoadStashFiles: (
        stash: StashEntry,
    ) => Promise<readonly FileChange[]>;
    readonly repositoryId: string;
    readonly fixture: boolean;
    readonly collapsed: boolean;
    readonly onToggle: () => void;
    readonly height: number;
    readonly onHeightChange: (height: number) => void;
    readonly active: BottomPanelTab;
    readonly onActiveChange: (active: BottomPanelTab) => void;
}) {
    const [explicitlyOpened, setExplicitlyOpened] = useState(false);
    const [localHistoryPath, setLocalHistoryPath] = useState<string>();
    const [stashFiles, setStashFiles] = useState<
        Readonly<Record<string, readonly FileChange[]>>
    >({});
    const [stashLoadError, setStashLoadError] = useState<string>();
    const dialog = useAppDialog();
    const panel = useRef<HTMLElement>(null);
    const originFocus = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const rememberExternalFocus = (event: FocusEvent): void => {
            if (!(event.target instanceof HTMLElement)) return;
            if (panel.current?.contains(event.target)) return;
            originFocus.current = event.target;
        };
        window.addEventListener("focusin", rememberExternalFocus);
        return () =>
            window.removeEventListener("focusin", rememberExternalFocus);
    }, []);

    const hidePanel = (): void => {
        if (collapsed) return;
        onToggle();
        const target = originFocus.current;
        window.requestAnimationFrame(() => {
            if (target?.isConnected) target.focus();
        });
    };

    useEffect(() => {
        const openTerminal = (): void => {
            onActiveChange("terminal");
            setExplicitlyOpened(true);
            if (collapsed) onToggle();
            window.requestAnimationFrame(() => {
                const terminalInput = document.querySelector<HTMLElement>(
                    '[data-command-scope="terminal"] textarea, [data-command-scope="terminal"] [contenteditable="true"], [data-command-scope="terminal"]',
                );
                terminalInput?.focus();
            });
        };
        window.addEventListener("git-client:open-terminal", openTerminal);
        return () =>
            window.removeEventListener(
                "git-client:open-terminal",
                openTerminal,
            );
    }, [collapsed, onActiveChange, onToggle]);

    useEffect(() => {
        const openLocalHistory = (event: Event): void => {
            const path = event instanceof CustomEvent && typeof event.detail?.path === "string"
                ? event.detail.path
                : undefined;
            setLocalHistoryPath(path);
            onActiveChange("localHistory");
            setExplicitlyOpened(true);
            if (collapsed) onToggle();
        };
        window.addEventListener("git-client:open-local-history", openLocalHistory);
        return () => window.removeEventListener("git-client:open-local-history", openLocalHistory);
    }, [collapsed, onActiveChange, onToggle]);

    useEffect(() => {
        const openGitConsole = (): void => {
            onActiveChange("gitConsole");
            setExplicitlyOpened(true);
            if (collapsed) onToggle();
            window.requestAnimationFrame(() => {
                panel.current?.querySelector<HTMLElement>('[aria-label="Git Console"]')?.focus();
            });
        };
        window.addEventListener("git-client:open-git-console", openGitConsole);
        return () => window.removeEventListener("git-client:open-git-console", openGitConsole);
    }, [collapsed, onActiveChange, onToggle]);

    useEffect(() => {
        const openPanel = (event: Event): void => {
            const requested =
                event instanceof CustomEvent ? event.detail?.tab : undefined;
            if (!isBottomPanelTab(requested)) return;
            onActiveChange(requested);
            setExplicitlyOpened(true);
            if (collapsed) onToggle();
        };
        window.addEventListener("git-client:open-bottom-panel", openPanel);
        return () =>
            window.removeEventListener(
                "git-client:open-bottom-panel",
                openPanel,
            );
    }, [collapsed, onActiveChange, onToggle]);

    useEffect(() => {
        const activeIsEmpty =
            (active === "shelf" && shelves.length === 0) ||
            (active === "stash" && stashes.length === 0) ||
            (active === "recovery" && recoveryEntries.length === 0);
        if (!collapsed && !explicitlyOpened && activeIsEmpty) onToggle();
    }, [
        active,
        collapsed,
        explicitlyOpened,
        onToggle,
        recoveryEntries.length,
        shelves.length,
        stashes.length,
    ]);

    const resizePanel = (event: ReactPointerEvent<HTMLDivElement>): void => {
        event.preventDefault();
        const startY = event.clientY;
        const startHeight = height;
        const move = (pointerEvent: PointerEvent): void => {
            onHeightChange(
                Math.min(
                    MAX_BOTTOM_PANEL_HEIGHT,
                    Math.max(
                        MIN_BOTTOM_PANEL_HEIGHT,
                        startHeight + startY - pointerEvent.clientY,
                    ),
                ),
            );
        };
        const finish = (): void => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", finish);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", finish);
    };
    const resizePanelWithKeyboard = (
        event: ReactKeyboardEvent<HTMLDivElement>,
    ): void => {
        if (event.key === "Home") onHeightChange(MIN_BOTTOM_PANEL_HEIGHT);
        else if (event.key === "End") onHeightChange(MAX_BOTTOM_PANEL_HEIGHT);
        else if (event.key === "ArrowUp")
            onHeightChange(Math.min(MAX_BOTTOM_PANEL_HEIGHT, height + 10));
        else if (event.key === "ArrowDown")
            onHeightChange(Math.max(MIN_BOTTOM_PANEL_HEIGHT, height - 10));
        else return;
        event.preventDefault();
    };

    const toggleStashFiles = async (stash: StashEntry): Promise<void> => {
        setStashLoadError(undefined);
        if (stashFiles[stash.oid]) {
            setStashFiles((current) => {
                const next = { ...current };
                delete next[stash.oid];
                return next;
            });
            return;
        }
        try {
            const files = await onLoadStashFiles(stash);
            setStashFiles((current) => ({ ...current, [stash.oid]: files }));
        } catch (error) {
            setStashLoadError(
                error instanceof Error ? error.message : String(error),
            );
        }
    };
    const stashChanges = useCallback(async (): Promise<void> => {
        const stashMessage = await dialog.input({
            title: "Stash changes",
            label: "Message (optional)",
            initialValue: "WIP",
            allowEmpty: true,
            description:
                "Includes untracked files and keeps the current index state in the stash.",
            confirmLabel: "Stash",
        });
        if (stashMessage === null) return;
        await onOperation({
            kind: "stashPush",
            message: stashMessage || null,
            includeUntracked: true,
            keepIndex: false,
        });
    }, [dialog.input, onOperation]);
    const shelveChanges = useCallback(async (): Promise<void> => {
        const message = await dialog.input({
            title: "Shelve changes",
            label: "Shelf name",
            initialValue: "WIP: ",
            description: `Stores ${status.changes.length} changed files outside the repository.`,
            confirmLabel: "Shelve",
        });
        if (!message) return;
        onCreateShelf(
            message,
            status.changes.map((file) => file.path),
        );
    }, [dialog.input, onCreateShelf, status.changes]);

    useEffect(() => {
        const openStashDialog = (): void => {
            onActiveChange("stash");
            setExplicitlyOpened(true);
            if (collapsed) onToggle();
            void stashChanges();
        };
        window.addEventListener("git-client:stash-changes", openStashDialog);
        return () =>
            window.removeEventListener(
                "git-client:stash-changes",
                openStashDialog,
            );
    }, [collapsed, onActiveChange, onToggle, stashChanges]);

    useEffect(() => {
        const openShelfDialog = (): void => {
            onActiveChange("shelf");
            setExplicitlyOpened(true);
            if (collapsed) onToggle();
            void shelveChanges();
        };
        window.addEventListener("git-client:shelve-changes", openShelfDialog);
        return () =>
            window.removeEventListener(
                "git-client:shelve-changes",
                openShelfDialog,
            );
    }, [collapsed, onActiveChange, onToggle, shelveChanges]);
    return (
        <section
            aria-label={`${active} Tool Window`}
            className={`${tw.bottomPanel} ${collapsed ? tw.bottomCollapsed : ""} ${active === "terminal" ? tw.bottomTerminalPanel : ""}`}
            data-tool-window-position="bottom"
            ref={panel}
            style={collapsed ? undefined : { height }}
        >
            {!collapsed && (
                <div
                    aria-label="Resize bottom panel"
                    aria-orientation="horizontal"
                    aria-valuemax={MAX_BOTTOM_PANEL_HEIGHT}
                    aria-valuemin={MIN_BOTTOM_PANEL_HEIGHT}
                    aria-valuenow={height}
                    className={tw.bottomResizer}
                    onDoubleClick={() =>
                        onHeightChange(DEFAULT_BOTTOM_PANEL_HEIGHT)
                    }
                    onKeyDown={resizePanelWithKeyboard}
                    onPointerDown={resizePanel}
                    role="separator"
                    tabIndex={0}
                />
            )}
            {(collapsed || active !== "terminal") && <div className={tw.toolTabs}>
                {tabs.map((tab) => (
                    <button
                        aria-label={`${tab.label} Tool Window Tab`}
                        className={
                            active === tab.id ? tw.activeToolTab : undefined
                        }
                        key={tab.id}
                        data-bottom-tab={tab.id}
                        onClick={() => {
                            onActiveChange(tab.id);
                            setExplicitlyOpened(true);
                            if (collapsed) onToggle();
                        }}
                    >
                        <Icon name={tab.icon} size={14} />
                        {tab.label}
                        {tab.id === "stash" && status.stashCount > 0 && (
                            <em>{status.stashCount}</em>
                        )}
                    </button>
                ))}
                <span />
                {(collapsed || active !== "terminal" || fixture) && (
                    <button
                        aria-label={collapsed ? "Show" : "Hide"}
                        className={tw.iconButton}
                        onClick={collapsed ? onToggle : hidePanel}
                        title={collapsed ? "Show" : "Hide"}
                    >
                        {collapsed ? "⌃" : "⌄"}
                    </button>
                )}
            </div>}
            {!collapsed && (
                <div className={tw.toolContent}>
                    {active === "shelf" && (
                        <div className={tw.collectionTool}>
                            <div className={tw.collectionIntro}>
                                <Icon name="shelf" size={24} />
                                <div>
                                    <strong>Shelf</strong>
                                    <p>
                                        Index, worktree, and untracked files are
                                        stored atomically outside the
                                        repository.
                                    </p>
                                </div>
                                <button
                                    onClick={() => void shelveChanges()}
                                >
                                    Shelve Changes…
                                </button>
                            </div>
                            {stashLoadError && (
                                <div className={tw.collectionError}>
                                    {stashLoadError}
                                </div>
                            )}
                            {shelves.map((shelf) => (
                                <div
                                    className={tw.collectionRow}
                                    key={shelf.id}
                                >
                                    <Icon name="patch" size={16} />
                                    <div>
                                        <strong>{shelf.message}</strong>
                                        <small>
                                            {new Date(
                                                shelf.createdAtMs,
                                            ).toLocaleString()}{" "}
                                            · {shelf.files.length} files ·
                                            checksum verified
                                        </small>
                                    </div>
                                    <button
                                        onClick={() =>
                                            onApplyShelf(shelf.id, false)
                                        }
                                    >
                                        Apply
                                    </button>
                                    <button
                                        onClick={() =>
                                            onApplyShelf(shelf.id, true)
                                        }
                                    >
                                        Unshelve
                                    </button>
                                    <button
                                        aria-label={`Delete ${shelf.message}`}
                                        className={tw.iconButton}
                                        onClick={toVoidHandler(async () => {
                                            const accepted =
                                                await dialog.confirm({
                                                    title: `Delete shelf “${shelf.message}”?`,
                                                    description:
                                                        "The stored patches and untracked file copies will be deleted.",
                                                    impact: `${shelf.files.length} files`,
                                                    confirmLabel:
                                                        "Delete shelf",
                                                    dangerous: true,
                                                });
                                            if (accepted)
                                                onDeleteShelf(shelf.id);
                                        })}
                                    >
                                        <Icon name="trash" size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {active === "stash" && (
                        <div className={tw.collectionTool}>
                            <div className={tw.collectionIntro}>
                                <Icon name="stash" size={24} />
                                <div>
                                    <strong>Git Stash</strong>
                                    <p>Native stash entries from refs/stash.</p>
                                </div>
                                <button
                                    onClick={() => void stashChanges()}
                                >
                                    Stash Changes…
                                </button>
                                <button
                                    disabled={stashes.length === 0}
                                    onClick={toVoidHandler(async () => {
                                        const accepted = await dialog.confirm({
                                            title: "Clear every stash entry?",
                                            description:
                                                "This removes refs/stash and all entries in its reflog.",
                                            impact: `${stashes.length} stash entries`,
                                            confirmLabel: "Clear stashes",
                                            dangerous: true,
                                        });
                                        if (accepted)
                                            void onOperation({
                                                kind: "stashClear",
                                            });
                                    })}
                                >
                                    Clear all…
                                </button>
                            </div>
                            {stashes.length === 0 ? (
                                <div className={tw.emptyState}>
                                    No entries in refs/stash.
                                </div>
                            ) : (
                                stashes.map((stash) => (
                                    <div
                                        className={tw.stashEntry}
                                        key={stash.oid}
                                    >
                                        <div className={tw.collectionRow}>
                                            <Icon name="commit" size={16} />
                                            <div>
                                                <strong>
                                                    {stash.selector}:{" "}
                                                    {stash.subject}
                                                </strong>
                                                <small>
                                                    {stash.author} ·{" "}
                                                    {new Date(
                                                        stash.createdAt * 1000,
                                                    ).toLocaleString()}{" "}
                                                    · {stash.oid.slice(0, 10)}
                                                </small>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    void toggleStashFiles(stash)
                                                }
                                            >
                                                {stashFiles[stash.oid]
                                                    ? "Hide Files"
                                                    : "Files"}
                                            </button>
                                            <button
                                                onClick={() =>
                                                    onOpenStashDiff(stash)
                                                }
                                            >
                                                Show Diff
                                            </button>
                                            <button
                                                onClick={() =>
                                                    void onOperation({
                                                        kind: "stashApply",
                                                        stash: stash.selector,
                                                        pop: false,
                                                        reinstateIndex: true,
                                                    })
                                                }
                                            >
                                                Apply
                                            </button>
                                            <button
                                                onClick={() =>
                                                    void onOperation({
                                                        kind: "stashApply",
                                                        stash: stash.selector,
                                                        pop: true,
                                                        reinstateIndex: true,
                                                    })
                                                }
                                            >
                                                Pop
                                            </button>
                                            <button
                                                onClick={toVoidHandler(
                                                    async () => {
                                                        const branch =
                                                            await dialog.input({
                                                                title: `Branch from ${stash.selector}`,
                                                                label: "New branch name",
                                                                initialValue:
                                                                    "stash/",
                                                                description:
                                                                    "Creates the branch at the stash base, applies the stash, then drops it on success.",
                                                            });
                                                        if (branch)
                                                            void onOperation({
                                                                kind: "stashBranch",
                                                                stash: stash.selector,
                                                                branch,
                                                            });
                                                    },
                                                )}
                                            >
                                                Branch…
                                            </button>
                                            <button
                                                onClick={toVoidHandler(
                                                    async () => {
                                                        const accepted =
                                                            await dialog.confirm(
                                                                {
                                                                    title: `Drop ${stash.selector}?`,
                                                                    description:
                                                                        "This removes the stash entry from refs/stash.",
                                                                    impact: stash.subject,
                                                                    confirmLabel:
                                                                        "Drop stash",
                                                                    dangerous: true,
                                                                },
                                                            );
                                                        if (accepted) {
                                                            void onOperation({
                                                                kind: "stashDrop",
                                                                stash: stash.selector,
                                                            });
                                                        }
                                                    },
                                                )}
                                            >
                                                Drop
                                            </button>
                                        </div>
                                        {stashFiles[stash.oid] && (
                                            <div className={tw.stashFiles}>
                                                {(
                                                    stashFiles[stash.oid] ?? []
                                                ).map((file) => (
                                                    <span
                                                        key={`${stash.oid}-${file.path}`}
                                                    >
                                                        <strong>
                                                            {file.status
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </strong>
                                                        {file.oldPath
                                                            ? `${file.oldPath} → `
                                                            : ""}
                                                        {file.path}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                    {active === "recovery" && (
                        <div className={tw.collectionTool}>
                            <div className={tw.collectionIntro}>
                                <Icon name="history" size={24} />
                                <div>
                                    <strong>Ref Recovery Ledger</strong>
                                    <p>
                                        Ref OIDs captured before
                                        history-changing operations.
                                    </p>
                                </div>
                            </div>
                            {recoveryEntries.length === 0 ? (
                                <div className={tw.emptyState}>
                                    No ref-changing operations recorded yet.
                                </div>
                            ) : (
                                recoveryEntries.map((entry) => (
                                    <div
                                        className={tw.collectionRow}
                                        key={entry.id}
                                    >
                                        <Icon name="history" size={16} />
                                        <div>
                                            <strong>{entry.operation}</strong>
                                            <small>
                                                {new Date(
                                                    entry.createdAtMs,
                                                ).toLocaleString()}{" "}
                                                · {entry.branch ?? "detached"}
                                                {entry.refs
                                                    .map(
                                                        (reference) =>
                                                            ` · ${reference.name}`,
                                                    )
                                                    .join("")}
                                            </small>
                                        </div>
                                        <button
                                            disabled={!entry.recoverable}
                                            onClick={toVoidHandler(async () => {
                                                const refs = entry.refs
                                                    .map(
                                                        (reference) =>
                                                            reference.name,
                                                    )
                                                    .join("\n");
                                                const accepted =
                                                    await dialog.confirm({
                                                        title: "Restore the recorded ref state?",
                                                        description:
                                                            "Each ref is restored only if it still matches the expected post-operation value.",
                                                        impact: refs,
                                                        confirmLabel:
                                                            "Restore refs",
                                                        dangerous: true,
                                                    });
                                                if (!accepted) return;
                                                void onRestoreRecovery(
                                                    entry.id,
                                                );
                                            })}
                                        >
                                            {entry.recoverable
                                                ? "Restore refs"
                                                : "Objects expired"}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                    {active === "find" && (
                        <FindResultsPanel
                            onOpenResult={onOpenFindResult}
                            onSearchAgain={onSearchAgain}
                            session={findResults}
                        />
                    )}
                    {active === "terminal" && (
                        <TerminalPanel
                            fixture={fixture}
                            onHide={hidePanel}
                            repositoryId={repositoryId}
                        />
                    )}
                    {active === "gitConsole" && (
                        <GitConsolePanel entries={gitConsoleEntries} onClear={onClearGitConsole} />
                    )}
                    {active === "localHistory" && (
                        <LocalHistoryPanel
                            initialPath={localHistoryPath}
                            loadHistory={onLoadLocalHistory}
                            loadDiff={onLoadLocalHistoryDiff}
                            onCapture={onCaptureLocalHistory}
                            onRestore={onRestoreLocalHistory}
                            status={status}
                        />
                    )}
                </div>
            )}
            {dialog.node}
        </section>
    );
});
