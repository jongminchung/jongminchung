import { Button } from "@jongminchung/ui/components/button";
import { Tabs, TabsContent } from "@jongminchung/ui/components/tabs";
import { cn } from "@jongminchung/ui/lib/utils";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from "react";
import type { CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppDialog } from "../components/AppDialog";
import { BookmarksToolWindow } from "../components/BookmarksToolWindow";
import { BottomPanel } from "../components/BottomPanel";
import { BranchTree } from "../components/BranchTree";
import { ChangesWorkspace } from "../components/ChangesWorkspace";
import { useCommands, useDismissLayer } from "../components/CommandProvider";
import { CommitContextMenu } from "../components/CommitContextMenu";
import { CommitLog } from "../components/CommitLog";
import { ConflictEditorDialog } from "../components/ConflictEditorDialog";
import { DetailsPane } from "../components/DetailsPane";
import { DiffViewer } from "../components/DiffViewer";
import { HistoryRewriteWorkspace } from "../components/HistoryRewriteWorkspace";
import { Icon } from "../components/Icon";
import {
    NotificationBalloon,
    NotificationToolWindow,
} from "../components/NotificationToolWindow";
import { EmptyState } from "../components/ProductCollections";
import { ProjectToolWindow } from "../components/ProjectToolWindow";
import { RepositoryInspectorDialog } from "../components/RepositoryInspectorDialog";
import type { RepositoryToolKind } from "../components/RepositoryToolDialog";
import { RevisionComparison } from "../components/RevisionComparison";
import { ScratchEditor } from "../components/ScratchEditor";
import { ShareExistingRemotesDialog } from "../components/ShareExistingRemotesDialog";
import { ShareProjectDialog } from "../components/ShareProjectDialog";
import {
    allLineBookmarks,
    createBookmarkGroup,
    deleteBookmarkGroup,
    describeBookmark,
    moveBookmark,
    removeBookmark,
    renameBookmarkGroup,
    setDefaultBookmarkGroup,
} from "../domain/bookmarks";
import type { DiffPreferences } from "../domain/changeReview";
import {
    COMMAND_ENABLED,
    commandDisabled,
    type CommandDefinition,
} from "../domain/commands";
import { type ProductSettings } from "../domain/productSettings";
import { terminalService } from "../domain/TerminalService";
import { toVoidHandler } from "../domain/toVoidHandler";
import type {
    FileChange,
    Ref,
    RepositoryView,
    StashEntry,
} from "../domain/types";
import {
    MAX_SIDE_TOOL_WINDOW_WIDTH,
    MIN_SIDE_TOOL_WINDOW_WIDTH,
} from "../domain/workspacePersistence";
import type { GitSessionController } from "../git-session/useGitSessionController";
import { isElectronRuntime } from "../platform/electron";
import {
    openExternalUrl,
    selectPatchImportPath,
} from "../platform/electronActions";
import type { DiffOptions } from "../shared/contracts/model";
import { useRepositoryBookmarkController } from "./hooks/useRepositoryBookmarkController";
import { useRepositoryEditorController } from "./hooks/useRepositoryEditorController";
import { useRepositoryEditorFeatures } from "./hooks/useRepositoryEditorFeatures";
import { useRepositoryHostingCoordinator } from "./hooks/useRepositoryHostingCoordinator";
import { useRepositoryNotifications } from "./hooks/useRepositoryNotifications";
import { useRepositoryPersistence } from "./hooks/useRepositoryPersistence";
import { useRepositoryReviewController } from "./hooks/useRepositoryReviewController";
import {
    editorPanelDomId,
    editorTabDomId,
    useRepositoryTabCoordinator,
} from "./hooks/useRepositoryTabCoordinator";
import { useRepositoryToolWindowController } from "./hooks/useRepositoryToolWindowController";
import { useRepositoryVcsController } from "./hooks/useRepositoryVcsController";
import { useRepositoryWorkspaceLifecycle } from "./hooks/useRepositoryWorkspaceLifecycle";
import {
    RepositoryRightToolStripe,
    RepositoryToolStripe,
} from "./RepositoryChrome";
import { RepositoryStatusBar } from "./RepositoryStatusBar";
import {
    RepositoryWorkspaceStoreProvider,
    useRepositoryWorkspaceStore,
} from "./state/RepositoryWorkspaceStoreProvider";
import { inspectorKey, type EditorStatus } from "./state/workspaceTypes";
import { RepositoryEditorSurface } from "./surfaces/RepositoryEditorSurface";
import { RepositoryEditorTabs } from "./surfaces/RepositoryEditorTabs";
import { RepositoryNavigationSurface } from "./surfaces/RepositoryNavigationSurface";
import { RepositoryOverlays } from "./surfaces/RepositoryOverlays";
import { RepositoryToolWindows } from "./surfaces/RepositoryToolWindows";
import { useRepositoryCommands } from "./useRepositoryCommands";
import { useRepositoryPalette } from "./useRepositoryPalette";

function isEditorStatus(value: unknown): value is EditorStatus {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Partial<EditorStatus>;
    return (
        typeof candidate.path === "string" &&
        typeof candidate.line === "number" &&
        typeof candidate.column === "number" &&
        typeof candidate.readOnly === "boolean" &&
        typeof candidate.language === "string" &&
        (candidate.lineSeparator === "LF" ||
            candidate.lineSeparator === "CRLF") &&
        typeof candidate.indentation === "string" &&
        typeof candidate.columnSelection === "boolean" &&
        (candidate.symbol === undefined ||
            typeof candidate.symbol === "string") &&
        (candidate.selectedText === undefined ||
            typeof candidate.selectedText === "string")
    );
}

type GitSession = GitSessionController;

function nativeDiffOptions(preferences: DiffPreferences): DiffOptions {
    return {
        whitespace: preferences.whitespace,
        contextLines:
            preferences.contextLines === "full"
                ? null
                : preferences.contextLines,
    };
}

export { clearCommitFilesCache } from "./hooks/useRepositoryReviewController";

interface RepositoryWorkspaceProps {
    readonly repository: RepositoryView;
    readonly session: GitSession;
    readonly productSettings: ProductSettings;
    readonly onAddRepository: () => void;
    readonly onOpenPush: (
        localRevision?: string,
        knownRewrite?: boolean,
    ) => void;
    readonly onOpenRepositoryTool: (kind: RepositoryToolKind) => void;
    readonly showNotifications: boolean;
    readonly showShortcutConflictWarning: boolean;
    readonly onDirtyEditorCountChange: (count: number) => void;
    readonly onDismissShortcutConflictWarning: () => void;
    readonly onOpenSettings: () => void;
    readonly onChromeModeChange: (mode: "editor" | "terminal") => void;
}

export function RepositoryWorkspace(props: RepositoryWorkspaceProps) {
    const { repository } = props;
    return (
        <RepositoryWorkspaceStoreProvider
            electronRuntime={isElectronRuntime()}
            repositoryId={repository.snapshot.id}
            repositoryName={repository.snapshot.name}
            selectedRef={repository.refs.find((ref) => ref.current)?.name}
        >
            <RepositoryWorkspaceContent {...props} />
        </RepositoryWorkspaceStoreProvider>
    );
}

function RepositoryWorkspaceContent({
    repository,
    session,
    productSettings,
    onAddRepository,
    onOpenPush,
    onOpenRepositoryTool,
    showNotifications,
    showShortcutConflictWarning,
    onDirtyEditorCountChange,
    onDismissShortcutConflictWarning,
    onOpenSettings,
    onChromeModeChange,
}: RepositoryWorkspaceProps) {
    const {
        activity: sessionActivityCapability,
        mutations: sessionMutations,
        queries: sessionQueries,
        repository: sessionRepositoryCapability,
        workspace: sessionWorkspace,
    } = session;
    const {
        cancel: sessionCancelActivity,
        clearConsole: sessionClearGitConsole,
        current: sessionActivity,
        gitConsoleEntries: sessionGitConsoleEntries,
    } = sessionActivityCapability;
    const {
        abortOperation: sessionAbortOperation,
        applyShelf: sessionApplyShelf,
        commitChangelist: sessionCommitChangelist,
        createShelf: sessionCreateShelf,
        deleteChangelist: sessionDeleteChangelist,
        deleteShelf: sessionDeleteShelf,
        executeOperation: sessionExecuteOperation,
        importPatch: sessionImportPatch,
        putLocalHistoryLabel: sessionPutLocalHistoryLabel,
        resolveBinaryConflict: sessionResolveBinaryConflict,
        restoreRecoveryEntry: sessionRestoreRecoveryEntry,
        revertLocalHistory: sessionRevertLocalHistory,
        saveChangelist: sessionSaveChangelist,
        saveConflictResult: sessionSaveConflictResult,
        writeWorkingTreeFile: sessionWriteWorkingTreeFile,
    } = sessionMutations;
    const {
        createLocalHistoryPatch: sessionCreateLocalHistoryPatch,
        indexLog: sessionIndexLog,
        listLocalHistoryActivities: sessionListLocalHistoryActivities,
        loadBlame: sessionLoadBlame,
        loadCommitDiff: sessionLoadCommitDiff,
        loadFileHistory: sessionLoadFileHistory,
        loadFiles: sessionLoadFiles,
        loadHistoryRewritePreview: sessionLoadHistoryRewritePreview,
        loadLocalChangesPatch: sessionLoadLocalChangesPatch,
        loadLocalHistoryDiff: sessionLoadLocalHistoryDiff,
        loadLog: sessionLoadLog,
        loadRevisionDiff: sessionLoadRevisionDiff,
        loadStashFiles: sessionLoadStashFiles,
        loadStashPatch: sessionLoadStashPatch,
        loadTree: sessionLoadTree,
        openWorkingTreeFile: sessionOpenWorkingTreeFile,
        preCommitCheck: sessionPreCommitCheck,
        readConflict: sessionReadConflict,
        readFile: sessionReadFile,
        readFilePreview: sessionReadFilePreview,
        readLocalHistoryActivity: sessionReadLocalHistoryActivity,
        reload: sessionReload,
        searchProjectText: sessionSearchProjectText,
    } = sessionQueries;
    const {
        accessMode: sessionAccessMode,
        changelists: sessionChangelists,
        fixture: sessionFixture,
        hasMoreCommits: sessionHasMoreCommits,
        loading: sessionLoading,
        logError: sessionLogError,
        logLoading: sessionLogLoading,
        recoveryEntries: sessionRecoveryEntries,
        remotes: sessionRemotes,
        shelves: sessionShelves,
        stale: sessionStale,
        stashes: sessionStashes,
    } = sessionRepositoryCapability;
    const { error: sessionError } = sessionWorkspace;
    const { execute: executeCommand, openPaletteFor } = useCommands();
    const safeMode = sessionAccessMode === "safe";
    const review = useRepositoryWorkspaceStore(
        useShallow((state) => ({
            selectedOids: state.selectedOids,
            selectedRef: state.selectedRef,
            repositoryViewMode: state.repositoryViewMode,
            changeSelection: state.changeSelection,
            historySelectedPath: state.historySelectedPath,
            historyParentRevision: state.historyParentRevision,
            diffPreferences: state.diffPreferences,
            commitDraft: state.commitDraft,
            historyDiff: state.historyDiff,
            changeDiff: state.changeDiff,
            historyPreview: state.historyPreview,
            changePreview: state.changePreview,
            historyContent: state.historyContent,
            changeContent: state.changeContent,
            historySubmodule: state.historySubmodule,
            changeSubmodule: state.changeSubmodule,
            contextPosition: state.contextPosition,
            diffState: state.diffState,
            revisionComparison: state.revisionComparison,
            conflictContent: state.conflictContent,
            commitFiles: state.commitFiles,
            commitFilesLoading: state.commitFilesLoading,
            commitSignature: state.commitSignature,
            historyRewrite: state.historyRewrite,
            setSelectedOids: state.setSelectedOids,
            setSelectedRef: state.setSelectedRef,
            setRepositoryViewMode: state.setRepositoryViewMode,
            setChangeSelection: state.setChangeSelection,
            setHistorySelectedPath: state.setHistorySelectedPath,
            setHistoryParentRevision: state.setHistoryParentRevision,
            setDiffPreferences: state.setDiffPreferences,
            setCommitDraft: state.setCommitDraft,
            setContextPosition: state.setContextPosition,
            setDiffState: state.setDiffState,
            setConflictContent: state.setConflictContent,
            setHistoryRewrite: state.setHistoryRewrite,
        })),
    );
    const {
        selectedOids,
        selectedRef,
        repositoryViewMode,
        changeSelection,
        historySelectedPath,
        historyParentRevision,
        diffPreferences,
        commitDraft,
        historyDiff,
        changeDiff,
        historyPreview,
        changePreview,
        historyContent,
        changeContent,
        historySubmodule,
        changeSubmodule,
        contextPosition,
        diffState,
        revisionComparison,
        conflictContent,
        commitFiles,
        commitFilesLoading,
        commitSignature,
        historyRewrite,
        setSelectedOids,
        setSelectedRef,
        setRepositoryViewMode,
        setChangeSelection,
        setHistorySelectedPath,
        setHistoryParentRevision,
        setDiffPreferences,
        setCommitDraft,
        setContextPosition,
        setDiffState,
        setConflictContent,
        setHistoryRewrite,
    } = review;
    useEffect(() => {
        const openRequestedView = (event: Event): void => {
            if (
                !safeMode &&
                event instanceof CustomEvent &&
                event.detail === "changes"
            ) {
                setRepositoryViewMode("changes");
            }
        };
        window.addEventListener(
            "git-client:repository-view-request",
            openRequestedView,
        );
        return () =>
            window.removeEventListener(
                "git-client:repository-view-request",
                openRequestedView,
            );
    }, [safeMode, setRepositoryViewMode]);
    const {
        activeInspectorKey,
        bookmarks,
        closeInspectors,
        dirtyInspectorKeys,
        findResults,
        inspector,
        inspectorTabs,
        navigateInspectorHistory,
        navigationHistory,
        navigationIndex,
        openInspector,
        pinnedInspectorKeys,
        previewInspectorKey,
        projectFiles,
        recentInspectors,
        scratchFiles,
        setActiveInspectorKey,
        setBookmarks,
        setBookmarksPopupMode,
        setCodeAnalysisRequest,
        setDirtyInspectorKeys,
        setExportToHtmlOpen,
        setInspectionResults,
        setPreviewInspectorKey,
        setProjectSearchInitialQuery,
        setProjectSearchSurface,
        setRecentFindUsagesOpen,
        setReplaceInFilesOpen,
        setRunInspectionOpen,
        setScratchFileChooserOpen,
        setScratchFiles,
        setStackTraceOpen,
        setVcsOperationsOpen,
    } = useRepositoryEditorController({
        loadFiles: sessionLoadFiles,
        onDirtyEditorCountChange,
        repository,
    });
    const layout = useRepositoryWorkspaceStore(
        useShallow((state) => ({
            bottomCollapsed: state.bottomCollapsed,
            projectOpen: state.projectOpen,
            bookmarksOpen: state.bookmarksOpen,
            logOpen: state.logOpen,
            logTabIds: state.logTabIds,
            activeLogTabId: state.activeLogTabId,
            logIndexing: state.logIndexing,
            logIndexingEnabled: state.logIndexingEnabled,
            bottomPanelHeight: state.bottomPanelHeight,
            sideToolWindowWidth: state.sideToolWindowWidth,
            bottomPanelTab: state.bottomPanelTab,
            changesNavigatorWidth: state.changesNavigatorWidth,
            historyReviewWidth: state.historyReviewWidth,
            commitRailWidth: state.commitRailWidth,
            toast: state.toast,
            notificationOpen: state.notificationOpen,
            processesOpen: state.processesOpen,
            activeToolWindow: state.activeToolWindow,
            maximizedToolWindow: state.maximizedToolWindow,
            shareProjectProvider: state.shareProjectProvider,
            shareExistingRemotes: state.shareExistingRemotes,
            notifications: state.notifications,
            balloonId: state.balloonId,
            editorStatus: state.editorStatus,
            setBottomCollapsed: state.setBottomCollapsed,
            setProjectOpen: state.setProjectOpen,
            setBookmarksOpen: state.setBookmarksOpen,
            setLogOpen: state.setLogOpen,
            setLogTabIds: state.setLogTabIds,
            setActiveLogTabId: state.setActiveLogTabId,
            setLogIndexing: state.setLogIndexing,
            setLogIndexingEnabled: state.setLogIndexingEnabled,
            setBottomPanelHeight: state.setBottomPanelHeight,
            setSideToolWindowWidth: state.setSideToolWindowWidth,
            setBottomPanelTab: state.setBottomPanelTab,
            setChangesNavigatorWidth: state.setChangesNavigatorWidth,
            setHistoryReviewWidth: state.setHistoryReviewWidth,
            setCommitRailWidth: state.setCommitRailWidth,
            setToast: state.setToast,
            setNotificationOpen: state.setNotificationOpen,
            setProcessesOpen: state.setProcessesOpen,
            setActiveToolWindow: state.setActiveToolWindow,
            setMaximizedToolWindow: state.setMaximizedToolWindow,
            setShareProjectProvider: state.setShareProjectProvider,
            setShareExistingRemotes: state.setShareExistingRemotes,
            setNotifications: state.setNotifications,
            setBalloonId: state.setBalloonId,
            setEditorStatus: state.setEditorStatus,
        })),
    );
    const {
        bottomCollapsed,
        projectOpen,
        bookmarksOpen,
        logOpen,
        logTabIds,
        activeLogTabId,
        logIndexing,
        logIndexingEnabled,
        bottomPanelHeight,
        sideToolWindowWidth,
        bottomPanelTab,
        changesNavigatorWidth,
        historyReviewWidth,
        commitRailWidth,
        toast,
        notificationOpen,
        processesOpen,
        activeToolWindow,
        maximizedToolWindow,
        shareProjectProvider,
        shareExistingRemotes,
        notifications,
        balloonId,
        editorStatus,
        setBottomCollapsed,
        setProjectOpen,
        setBookmarksOpen,
        setLogOpen,
        setLogTabIds,
        setActiveLogTabId,
        setLogIndexing,
        setLogIndexingEnabled,
        setBottomPanelHeight,
        setSideToolWindowWidth,
        setBottomPanelTab,
        setChangesNavigatorWidth,
        setHistoryReviewWidth,
        setCommitRailWidth,
        setToast,
        setNotificationOpen,
        setProcessesOpen,
        setActiveToolWindow,
        setMaximizedToolWindow,
        setShareProjectProvider,
        setShareExistingRemotes,
        setNotifications,
        setBalloonId,
        setEditorStatus,
    } = layout;
    useSyncExternalStore(
        terminalService.subscribe,
        terminalService.snapshot,
        terminalService.snapshot,
    );
    const terminalTabCount = terminalService.sessions(
        repository.snapshot.id,
    ).length;
    const dialog = useAppDialog();
    const lastAutoShownActivity = useRef<string | undefined>(undefined);
    const { jumpToLastToolWindow } = useRepositoryToolWindowController({
        bookmarksOpen,
        bottomCollapsed,
        bottomPanelHeight,
        bottomPanelTab,
        changesNavigatorWidth,
        commitRailWidth,
        historyReviewWidth,
        logOpen,
        maximizedToolWindow,
        projectOpen,
        setActiveToolWindow,
        setBookmarksOpen,
        setBottomCollapsed,
        setBottomPanelHeight,
        setBottomPanelTab,
        setChangesNavigatorWidth,
        setCommitRailWidth,
        setHistoryReviewWidth,
        setLogOpen,
        setMaximizedToolWindow,
        setProcessesOpen,
        setProjectOpen,
        setSideToolWindowWidth,
        sideToolWindowWidth,
    });
    useEffect(() => {
        const activity = sessionActivity;
        if (
            !productSettings.processWindowAutoShow ||
            activity?.status !== "running" ||
            activity.requestIds.length <= 1 ||
            lastAutoShownActivity.current === activity.id
        ) {
            return;
        }
        lastAutoShownActivity.current = activity.id;
        setProcessesOpen(true);
    }, [
        productSettings.processWindowAutoShow,
        sessionActivity,
        setProcessesOpen,
    ]);
    useEffect(() => {
        const update = (event: Event): void => {
            if (!(event instanceof CustomEvent)) return;
            setEditorStatus(
                isEditorStatus(event.detail) ? event.detail : undefined,
            );
        };
        window.addEventListener("git-client:editor-status", update);
        return () =>
            window.removeEventListener("git-client:editor-status", update);
    }, [setEditorStatus]);
    const {
        createScratchFile,
        exportToHtml,
        openCodeIssue,
        openScratchFile,
        openStackFrame,
        replaceInProjectFiles,
        runCodeCleanup,
        runCodeInspection,
    } = useRepositoryEditorFeatures({
        inspector,
        loadFile: sessionReadFile,
        openInspector,
        reload: sessionReload,
        repository,
        writeWorkingTreeFile: sessionWriteWorkingTreeFile,
    });
    const {
        beginMnemonicBookmark,
        chooseBookmarkMnemonic,
        openLineBookmark,
        requestToggleBookmark,
        toggleCurrentBookmark,
    } = useRepositoryBookmarkController({ openInspector, repository });
    const {
        closeLogTab,
        editorTabsId,
        nextLogTabNumber,
        openGitLogTab,
        openNewLogTab,
        requestCloseInspector,
        requestCloseInspectors,
        requestOpenRepositoryTool,
        setInspectorDirty,
    } = useRepositoryTabCoordinator({
        activeInspectorKey,
        activeLogTabId,
        closeInspectors,
        dialog,
        dirtyInspectorKeys,
        inspectorTabs,
        logOpen,
        logTabIds,
        onOpenRepositoryTool,
        setActiveInspectorKey,
        setActiveLogTabId,
        setDirtyInspectorKeys,
        setLogOpen,
        setLogTabIds,
        setPreviewInspectorKey,
        setRepositoryViewMode,
    });
    const {
        applyPatchFromClipboard,
        applyPatchFromFile,
        compareVcsFile,
        conflictedFile,
        createPatchFromLocalChanges,
        hasTrackedWorkingChanges,
        openVcsFileTab,
        rollbackVcsFile,
        showVcsFileChanges,
        untrackedPaths,
        vcsFileChange,
        vcsFileEntry,
        vcsFilePath,
        vcsFileVersioned,
        workingEntries,
    } = useRepositoryVcsController({
        executeOperation: sessionExecuteOperation,
        importPatch: sessionImportPatch,
        inspector,
        loadLocalChangesPatch: sessionLoadLocalChangesPatch,
        loadRevisionDiff: sessionLoadRevisionDiff,
        openInspector,
        repository,
    });
    const {
        availability,
        commitsByOid,
        primaryCommit,
        runAction,
        selectRelative,
    } = useRepositoryReviewController({
        dialog,
        onOpenPush,
        openInspector,
        repository,
        session,
        workingEntries,
    });
    const primaryCommitOid = primaryCommit?.oid;

    useRepositoryPersistence({
        nextLogTabNumber,
        repositoryId: repository.snapshot.id,
        repositoryName: repository.snapshot.name,
    });
    useRepositoryNotifications({
        sessionActivity,
        sessionError,
        showNotifications,
        showShortcutConflictWarning,
    });

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
                        patch: await sessionLoadStashPatch(stash.selector),
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
        [sessionLoadStashPatch, setDiffState],
    );

    const selectRef = (ref: Ref): void => {
        setSelectedRef(ref.name);
        if (commitsByOid.has(ref.oid)) setSelectedOids([ref.oid]);
    };

    const openConflict = useCallback(
        (file: FileChange): void => {
            const load = async (): Promise<void> => {
                try {
                    setConflictContent(await sessionReadConflict(file.path));
                } catch (error) {
                    setToast(`Unable to read conflict: ${String(error)}`);
                }
            };
            void load();
        },
        [sessionReadConflict, setConflictContent, setToast],
    );

    const repositoryBusy =
        sessionLoading || sessionActivity?.status === "running";
    const repositoryAvailability = (): ReturnType<
        CommandDefinition["availability"]
    > =>
        safeMode
            ? commandDisabled(
                  "Git changes and executable tools are unavailable in Safe Mode.",
              )
            : repositoryBusy
              ? commandDisabled(
                    sessionActivity?.label ?? "Repository data is loading.",
                )
              : COMMAND_ENABLED;
    const inspectorTabKeys = useMemo(
        () => inspectorTabs.map((tab) => inspectorKey(tab)),
        [inspectorTabs],
    );
    const activeInspectorIndex = activeInspectorKey
        ? inspectorTabKeys.indexOf(activeInspectorKey)
        : -1;
    const activateRelativeInspector = useCallback(
        (offset: -1 | 1): void => {
            if (activeInspectorIndex < 0 || inspectorTabKeys.length < 2) return;
            const nextIndex =
                (activeInspectorIndex + offset + inspectorTabKeys.length) %
                inspectorTabKeys.length;
            setActiveInspectorKey(inspectorTabKeys[nextIndex]);
            setRepositoryViewMode("history");
        },
        [
            activeInspectorIndex,
            inspectorTabKeys,
            setRepositoryViewMode,
            setActiveInspectorKey,
        ],
    );
    const editorTabAvailability = (): ReturnType<
        CommandDefinition["availability"]
    > =>
        inspector
            ? COMMAND_ENABLED
            : commandDisabled("There is no active file editor tab.");
    const readOnlyInspectorKeys = useMemo(
        () =>
            inspectorTabs
                .filter(
                    (tab) =>
                        (tab.scratchId === undefined &&
                            tab.source.kind !== "workingTree") ||
                        tab.tab === "tree",
                )
                .map((tab) => inspectorKey(tab)),
        [inspectorTabs],
    );
    const dispatchEditorSearch = useCallback(
        (
            action:
                | "find"
                | "replace"
                | "next"
                | "previous"
                | "nextWord"
                | "previousWord"
                | "selectionScope",
        ): boolean => {
            const event = new CustomEvent("git-client:editor-search", {
                cancelable: true,
                detail: { action },
            });
            return !window.dispatchEvent(event);
        },
        [],
    );
    const dispatchEditorAction = useCallback((action: string): boolean => {
        return !window.dispatchEvent(
            new CustomEvent("git-client:editor-action", {
                cancelable: true,
                detail: { action },
            }),
        );
    }, []);
    const editorActionAvailability = useCallback(
        (
            requiresEditable: boolean,
        ): ReturnType<CommandDefinition["availability"]> => {
            const activeEditor =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement.closest<HTMLElement>(".cm-editor")
                    : null;
            if (activeEditor === null) {
                return commandDisabled(
                    "Place the caret in a file editor first.",
                );
            }
            const editable =
                activeEditor.querySelector<HTMLElement>(".cm-content")
                    ?.contentEditable === "true";
            return !requiresEditable || editable
                ? COMMAND_ENABLED
                : commandDisabled("The active file editor is read-only.");
        },
        [],
    );
    const focusCurrentSearch = useCallback((): void => {
        if (dispatchEditorSearch("find")) return;
        const focusedDiff =
            document.activeElement instanceof HTMLElement
                ? document.activeElement.closest<HTMLElement>(
                      "[data-diff-viewer]",
                  )
                : null;
        const search =
            focusedDiff?.querySelector<HTMLInputElement>(
                "[data-command-search]",
            ) ??
            document.querySelector<HTMLInputElement>(
                repositoryViewMode === "history"
                    ? '[data-command-search="history"]'
                    : '[data-command-search="changes"]',
            ) ??
            document.querySelector<HTMLInputElement>("[data-command-search]");
        search?.focus();
        search?.select();
    }, [dispatchEditorSearch, repositoryViewMode]);
    const { bindSharedProject, openExistingRemote, requestShareProject } =
        useRepositoryHostingCoordinator({
            executeOperation: sessionExecuteOperation,
            onNotification: (notification) =>
                setNotifications((current) => [notification, ...current]),
            onToast: setToast,
            remotes: sessionRemotes,
            repository,
            shareProjectProvider,
            setBalloonId,
            setShareExistingRemotes,
            setShareProjectProvider,
        });
    useRepositoryCommands({
        setScratchFileChooserOpen,
        setExportToHtmlOpen,
        inspector,
        projectFiles,
        setRepositoryViewMode,
        setBookmarksOpen,
        setProjectOpen,
        bookmarksOpen,
        projectOpen,
        repositoryViewMode,
        logTabIds,
        setLogTabIds,
        setLogOpen,
        setActiveLogTabId,
        setActiveInspectorKey,
        logOpen,
        openGitLogTab,
        focusCurrentSearch,
        dispatchEditorSearch,
        dispatchEditorAction,
        editorStatus,
        editorActionAvailability,
        activeToolWindow,
        setBottomCollapsed,
        setMaximizedToolWindow,
        setActiveToolWindow,
        bottomPanelTab,
        terminalTabCount,
        setSideToolWindowWidth,
        setBottomPanelHeight,
        notifications,
        setNotifications,
        balloonId,
        setBalloonId,
        setNotificationOpen,
        notificationOpen,
        openPaletteFor,
        setProjectSearchInitialQuery,
        setProjectSearchSurface,
        navigateInspectorHistory,
        navigationIndex,
        navigationHistory,
        setReplaceInFilesOpen,
        setRecentFindUsagesOpen,
        onOpenSettings,
        setCodeAnalysisRequest,
        runCodeCleanup,
        setRunInspectionOpen,
        setInspectionResults,
        setStackTraceOpen,
        setBottomPanelTab,
        toggleCurrentBookmark,
        beginMnemonicBookmark,
        bookmarks,
        openLineBookmark,
        setBookmarksPopupMode,
        productSettings,
        requestCloseInspector,
        editorTabAvailability,
        activateRelativeInspector,
        inspectorTabKeys,
        setPreviewInspectorKey,
        previewInspectorKey,
        activeInspectorKey,
        requestCloseInspectors,
        dirtyInspectorKeys,
        pinnedInspectorKeys,
        activeInspectorIndex,
        readOnlyInspectorKeys,
        dialog,
        session,
        repositoryAvailability,
        jumpToLastToolWindow,
        setProcessesOpen,
        processesOpen,
        changeSelection,
        historySelectedPath,
        repository,
        onOpenPush,
        requestOpenRepositoryTool,
        primaryCommit,
        setToast,
        workingEntries,
        requestShareProject,
        createPatchFromLocalChanges,
        applyPatchFromFile,
        applyPatchFromClipboard,
        setVcsOperationsOpen,
        untrackedPaths,
        hasTrackedWorkingChanges,
        rollbackVcsFile,
        vcsFileChange,
        showVcsFileChanges,
        vcsFileEntry,
        vcsFilePath,
        compareVcsFile,
        vcsFileVersioned,
        openVcsFileTab,
        conflictedFile,
        openConflict,
        runAction,
        availability,
        maximizedToolWindow,
        repositoryBusy,
    });

    const vcsOperationGroups = useRepositoryPalette({
        hasTrackedWorkingChanges,
        vcsFileEntry,
        vcsFileChange,
        vcsFileVersioned,
        repository,
        workingEntries,
        session,
        untrackedPaths,
        conflictedFile,
        vcsFilePath,
        recentInspectors,
        projectFiles,
        setRepositoryViewMode,
        openInspector,
        scratchFiles,
        openScratchFile,
        primaryCommit,
        availability,
        setHistoryRewrite,
        selectRef,
        setSelectedOids,
        setChangeSelection,
    });

    useDismissLayer(
        useMemo(
            () => ({
                id: "commit-context-menu",
                priority: 110,
                active: contextPosition !== undefined,
                dismiss: () => setContextPosition(undefined),
            }),
            [contextPosition, setContextPosition],
        ),
    );
    useDismissLayer(
        useMemo(
            () => ({
                id: "standalone-diff",
                priority: 60,
                active: diffState !== undefined,
                dismiss: () => setDiffState(undefined),
            }),
            [diffState, setDiffState],
        ),
    );
    useDismissLayer(
        useMemo(
            () => ({
                id: "history-multi-selection",
                priority: 20,
                active: selectedOids.length > 1,
                dismiss: () =>
                    setSelectedOids(primaryCommitOid ? [primaryCommitOid] : []),
            }),
            [primaryCommitOid, selectedOids.length, setSelectedOids],
        ),
    );

    const abortInProgressOperation = async (): Promise<void> => {
        const operation = repository.snapshot.operation;
        if (!operation || operation === "bisect") return;
        await sessionAbortOperation(operation);
    };

    const commitToolWindow = (
        <ChangesWorkspace
            afterContent={changeContent.after}
            afterPreview={changePreview.after}
            beforeContent={changeContent.before}
            beforePreview={changePreview.before}
            submoduleDiff={changeSubmodule.value}
            commitRailWidth={commitRailWidth}
            navigatorWidth={changesNavigatorWidth}
            changelists={sessionChangelists}
            diffLoading={
                changeDiff.loading ||
                changeContent.loading ||
                changePreview.loading ||
                changeSubmodule.loading
            }
            draft={commitDraft}
            entries={workingEntries}
            onCloseToolWindow={() => setRepositoryViewMode("history")}
            onCommitChangelist={async (
                changelistId,
                message,
                amend,
                signOff,
                gpgSign,
            ) => {
                await sessionCommitChangelist(
                    changelistId,
                    message,
                    amend,
                    signOff,
                    gpgSign,
                );
            }}
            onDeleteChangelist={sessionDeleteChangelist}
            onDraftChange={setCommitDraft}
            onInspectFile={(file, layer, tab) => {
                setRepositoryViewMode("history");
                openInspector({
                    revision: repository.snapshot.headOid ?? "HEAD",
                    source:
                        layer === "index"
                            ? { kind: "index" }
                            : { kind: "workingTree" },
                    path: file.path,
                    tab,
                });
            }}
            onOpenConflict={openConflict}
            onOpenPush={() => onOpenPush()}
            onCommitRailWidthChange={(width) =>
                setCommitRailWidth(
                    Math.min(480, Math.max(280, Math.round(width))),
                )
            }
            onNavigatorWidthChange={(width) =>
                setChangesNavigatorWidth(
                    Math.min(420, Math.max(190, Math.round(width))),
                )
            }
            onOpenExternally={(file) => sessionOpenWorkingTreeFile(file.path)}
            onCommitOperation={(operation) =>
                sessionExecuteOperation(operation, true)
            }
            onOperation={sessionExecuteOperation}
            onPreCommitCheck={sessionPreCommitCheck}
            onPreferencesChange={setDiffPreferences}
            onSaveChangelist={sessionSaveChangelist}
            onSelectionChange={setChangeSelection}
            patch={changeDiff.patch}
            preferences={diffPreferences}
            selection={changeSelection}
            status={repository.status}
            toolWindow
        />
    );
    const leftToolWindowOpen =
        repositoryViewMode === "changes" || projectOpen || bookmarksOpen;
    const hasEditorTabs = logOpen || inspectorTabs.length > 0;
    const activeEditorTabValue =
        activeInspectorKey === undefined
            ? `log:${activeLogTabId}`
            : `inspector:${activeInspectorKey}`;
    const closeInspectorEditorTab = useCallback(
        async (key: string): Promise<void> => {
            const closingIndex = inspectorTabs.findIndex(
                (candidate) => inspectorKey(candidate) === key,
            );
            const remaining = inspectorTabs.filter(
                (candidate) => inspectorKey(candidate) !== key,
            );
            const replacement =
                remaining[
                    Math.min(Math.max(closingIndex, 0), remaining.length - 1)
                ] ?? remaining.at(-1);
            const fallbackValue = replacement
                ? `inspector:${inspectorKey(replacement)}`
                : logOpen
                  ? `log:${activeLogTabId}`
                  : undefined;
            const wasActive = activeInspectorKey === key;

            await requestCloseInspector(key);
            if (!wasActive) return;
            window.requestAnimationFrame(() => {
                const retainedTab = document.getElementById(
                    editorTabDomId(editorTabsId, `inspector:${key}`),
                );
                if (retainedTab) {
                    retainedTab.focus();
                    return;
                }
                if (fallbackValue) {
                    document
                        .getElementById(
                            editorTabDomId(editorTabsId, fallbackValue),
                        )
                        ?.focus();
                    return;
                }
                document
                    .querySelector<HTMLElement>("[data-open-git-log]")
                    ?.focus();
            });
        },
        [
            activeInspectorKey,
            activeLogTabId,
            editorTabsId,
            inspectorTabs,
            logOpen,
            requestCloseInspector,
        ],
    );
    const { navigationStatus, terminalFocused } =
        useRepositoryWorkspaceLifecycle({
            bottomCollapsed,
            bottomPanelTab,
            editorStatus,
            hasEditorTabs,
            onChromeModeChange,
            productSettings,
            repository,
            safeMode,
            sessionLoading,
            setBottomCollapsed,
            setHistoryRewrite,
            setRepositoryViewMode,
            setShareExistingRemotes,
            setShareProjectProvider,
        });

    return (
        <>
            <RepositoryOverlays
                activity={sessionActivity}
                cancelActivity={sessionCancelActivity}
                chooseBookmarkMnemonic={chooseBookmarkMnemonic}
                createScratchFile={createScratchFile}
                executeCommand={executeCommand}
                exportToHtml={exportToHtml}
                inspector={inspector}
                openCodeIssue={openCodeIssue}
                openInspector={openInspector}
                openLineBookmark={openLineBookmark}
                openStackFrame={openStackFrame}
                productSettings={productSettings}
                replaceInProjectFiles={replaceInProjectFiles}
                repository={repository}
                runCodeCleanup={runCodeCleanup}
                runCodeInspection={runCodeInspection}
                searchProjectText={sessionSearchProjectText}
                vcsOperationGroups={vcsOperationGroups}
            />
            <RepositoryNavigationSurface
                navigationStatus={navigationStatus}
                productSettings={productSettings}
            />
            <Tabs
                className="contents"
                onValueChange={(value) => {
                    if (value.startsWith("log:")) {
                        setActiveLogTabId(value.slice("log:".length));
                        setActiveInspectorKey(undefined);
                        setRepositoryViewMode("history");
                        return;
                    }
                    if (value.startsWith("inspector:")) {
                        setActiveInspectorKey(value.slice("inspector:".length));
                    }
                }}
                value={hasEditorTabs ? activeEditorTabValue : null}
            >
                {hasEditorTabs && (
                    <RepositoryEditorTabs
                        abortInProgressOperation={abortInProgressOperation}
                        closeInspectorEditorTab={closeInspectorEditorTab}
                        closeLogTab={closeLogTab}
                        dialog={dialog}
                        dirtyInspectorKeys={dirtyInspectorKeys}
                        editorTabsId={editorTabsId}
                        hasInspector={inspector !== undefined}
                        inspectorTabs={inspectorTabs}
                        leftToolWindowOpen={leftToolWindowOpen}
                        logOpen={logOpen}
                        logTabIds={logTabIds}
                        pinnedInspectorKeys={pinnedInspectorKeys}
                        previewInspectorKey={previewInspectorKey}
                        repository={repository}
                        repositoryViewMode={repositoryViewMode}
                        sessionExecuteOperation={sessionExecuteOperation}
                        sessionLoading={sessionLoading}
                        sessionReload={sessionReload}
                        sessionStale={sessionStale}
                        sideToolWindowWidth={sideToolWindowWidth}
                    />
                )}
                <RepositoryToolWindows loading={sessionLoading}>
                    <RepositoryToolStripe
                        bookmarksOpen={bookmarksOpen}
                        changes={repository.status.changes.length}
                        mode={repositoryViewMode}
                        onModeChange={(mode) => {
                            if (mode === "changes") {
                                setProjectOpen(false);
                                setBookmarksOpen(false);
                                setRepositoryViewMode((current) =>
                                    current === "changes"
                                        ? "history"
                                        : "changes",
                                );
                                return;
                            }
                            setRepositoryViewMode("history");
                        }}
                        onOpenGitConsole={() =>
                            window.dispatchEvent(
                                new CustomEvent("git-client:open-git-console"),
                            )
                        }
                        onOpenBookmarks={() => {
                            setRepositoryViewMode("history");
                            setProjectOpen(false);
                            setBookmarksOpen((value) => !value);
                        }}
                        onOpenProject={() => {
                            if (repositoryViewMode === "changes") {
                                setRepositoryViewMode("history");
                                setProjectOpen(true);
                                setBookmarksOpen(false);
                                return;
                            }
                            if (bookmarksOpen) {
                                setBookmarksOpen(false);
                                setProjectOpen(true);
                                return;
                            }
                            setProjectOpen((value) => !value);
                        }}
                        projectOpen={
                            projectOpen && repositoryViewMode === "history"
                        }
                        readOnly={safeMode}
                        terminalFocused={terminalFocused}
                    />
                    <RepositoryEditorSurface
                        maximizedToolWindow={maximizedToolWindow}
                    >
                        <div
                            className={`${`workbenchContent [display:grid] [gap:3px] [grid-template-columns:minmax(0,_1fr)] [min-height:0] [min-width:0] [html[data-distraction-free-mode=true]_&]:grid-cols-[minmax(0,1fr)]! [html[data-presentation-mode=true]_&]:grid-cols-[minmax(0,1fr)]! workbenchContent`} ${leftToolWindowOpen ? `projectToolOpen [grid-template-columns:minmax(302px,_var(--side-tool-window-width,_clamp(352px,_32.7vw,_458px)))_minmax(0,_1fr)] projectToolOpen` : ""} ${maximizedToolWindow === "project" || maximizedToolWindow === "bookmarks" ? `maximizedSideTool [grid-template-columns:minmax(0,_1fr)] [&>_[data-workspace-main]]:[display:none] maximizedSideTool` : ""}`}
                            style={
                                {
                                    "--side-tool-window-width": `${repositoryViewMode === "changes" ? 302 : sideToolWindowWidth}px`,
                                    "--details-pane-width": `${historyReviewWidth}px`,
                                } as CSSProperties
                            }
                        >
                            {bookmarksOpen &&
                                repositoryViewMode === "history" && (
                                    <BookmarksToolWindow
                                        onClose={() => setBookmarksOpen(false)}
                                        onCreateGroup={(name, isDefault) =>
                                            setBookmarks((current) =>
                                                createBookmarkGroup(
                                                    current,
                                                    crypto.randomUUID(),
                                                    name,
                                                    isDefault,
                                                ),
                                            )
                                        }
                                        onDeleteBookmark={(bookmarkId) =>
                                            setBookmarks((current) =>
                                                removeBookmark(
                                                    current,
                                                    bookmarkId,
                                                ),
                                            )
                                        }
                                        onDeleteGroup={(group) => {
                                            void dialog
                                                .confirm({
                                                    title: "Delete Bookmark List",
                                                    description: `Are you sure you want to delete ‘${group.name}’ bookmark list? This action can't be undone.`,
                                                    impact: `${group.bookmarks.length} bookmark${group.bookmarks.length === 1 ? "" : "s"} will be deleted.`,
                                                    confirmLabel: "Delete",
                                                    dangerous: true,
                                                })
                                                .then((accepted) => {
                                                    if (accepted) {
                                                        setBookmarks(
                                                            (current) =>
                                                                deleteBookmarkGroup(
                                                                    current,
                                                                    group.id,
                                                                ),
                                                        );
                                                    }
                                                });
                                        }}
                                        onDescribeBookmark={(
                                            bookmarkId,
                                            description,
                                        ) =>
                                            setBookmarks((current) =>
                                                describeBookmark(
                                                    current,
                                                    bookmarkId,
                                                    description,
                                                ),
                                            )
                                        }
                                        onMoveBookmark={(bookmarkId, offset) =>
                                            setBookmarks((current) =>
                                                moveBookmark(
                                                    current,
                                                    bookmarkId,
                                                    offset,
                                                ),
                                            )
                                        }
                                        onOpenBookmark={openLineBookmark}
                                        onRenameGroup={(groupId, name) =>
                                            setBookmarks((current) =>
                                                renameBookmarkGroup(
                                                    current,
                                                    groupId,
                                                    name,
                                                ),
                                            )
                                        }
                                        onSetDefaultGroup={(groupId) =>
                                            setBookmarks((current) =>
                                                setDefaultBookmarkGroup(
                                                    current,
                                                    groupId,
                                                ),
                                            )
                                        }
                                        onViewOptionsChange={(view) =>
                                            setBookmarks((current) => ({
                                                ...current,
                                                view,
                                            }))
                                        }
                                        state={bookmarks}
                                    />
                                )}
                            {projectOpen &&
                                repositoryViewMode === "history" && (
                                    <ProjectToolWindow
                                        activePath={inspector?.path}
                                        changes={repository.status.changes}
                                        hasCommits={
                                            repository.snapshot.hasCommits
                                        }
                                        loadTree={sessionLoadTree}
                                        onClose={() => setProjectOpen(false)}
                                        onNew={toVoidHandler(async () => {
                                            const path = await dialog.input({
                                                title: "New File",
                                                label: "Path relative to the project",
                                                placeholder: "src/new-file.ts",
                                                confirmLabel: "Create",
                                            });
                                            if (!path) return;
                                            try {
                                                await sessionWriteWorkingTreeFile(
                                                    path,
                                                    "",
                                                );
                                                openInspector({
                                                    revision:
                                                        repository.snapshot
                                                            .headOid ?? "HEAD",
                                                    source: {
                                                        kind: "workingTree",
                                                    },
                                                    path,
                                                    tab: "file",
                                                });
                                            } catch (error) {
                                                setToast(
                                                    error instanceof Error
                                                        ? error.message
                                                        : String(error),
                                                );
                                            }
                                        })}
                                        onNewScratch={() =>
                                            setScratchFileChooserOpen(true)
                                        }
                                        onOpenFile={(path, keepOpen = true) =>
                                            openInspector(
                                                {
                                                    revision:
                                                        repository.snapshot
                                                            .headOid ?? "HEAD",
                                                    source: {
                                                        kind: "workingTree",
                                                    },
                                                    path,
                                                    tab: "file",
                                                },
                                                keepOpen,
                                            )
                                        }
                                        onOpenScratch={openScratchFile}
                                        repositoryName={
                                            repository.snapshot.name
                                        }
                                        repositoryPath={
                                            repository.snapshot.path
                                        }
                                        scratches={scratchFiles}
                                        width={sideToolWindowWidth}
                                        onWidthChange={(width) =>
                                            setSideToolWindowWidth(
                                                Math.min(
                                                    MAX_SIDE_TOOL_WINDOW_WIDTH,
                                                    Math.max(
                                                        MIN_SIDE_TOOL_WINDOW_WIDTH,
                                                        Math.round(width),
                                                    ),
                                                ),
                                            )
                                        }
                                    />
                                )}
                            {repositoryViewMode === "changes" &&
                                commitToolWindow}
                            <div
                                className={`${`activeWorkspace [background:var(--card)] rounded-lg [display:grid] [min-height:0] [min-width:0] [overflow:hidden] [padding-top:32px] [position:relative] activeWorkspace rounded-lg`} ${!hasEditorTabs ? `activeWorkspaceNoTabs [padding-top:0] activeWorkspaceNoTabs` : ""}`}
                                data-workspace-main
                            >
                                {logOpen &&
                                    logTabIds.map((tabId) => {
                                        const value = `log:${tabId}`;
                                        return (
                                            <TabsContent
                                                aria-labelledby={editorTabDomId(
                                                    editorTabsId,
                                                    value,
                                                )}
                                                className={`editorSurface [height:100%] [min-height:0] [min-width:0] [&[hidden]]:[display:none] editorSurface`}
                                                id={editorPanelDomId(
                                                    editorTabsId,
                                                    value,
                                                )}
                                                keepMounted
                                                key={tabId}
                                                value={value}
                                            >
                                                {tabId === activeLogTabId && (
                                                    <div
                                                        className={`mainPanes [display:grid] [grid-template-columns:30px_minmax(0,_1fr)_var(--details-pane-width,_253px)] [height:100%] [min-height:0] [min-width:0] max-[900px]:[grid-template-columns:30px_minmax(0,_1fr)] max-[900px]:[&>_*:last-child]:[display:none] [html[data-distraction-free-mode=true]_&>*:first-child]:hidden! [html[data-distraction-free-mode=true]_&>*:last-child]:hidden! [html[data-presentation-mode=true]_&>*:first-child]:hidden! [html[data-presentation-mode=true]_&>*:last-child]:hidden! mainPanes`}
                                                        style={
                                                            {
                                                                "--history-review-width": `${historyReviewWidth}px`,
                                                            } as CSSProperties
                                                        }
                                                    >
                                                        <BranchTree
                                                            compact
                                                            onAdd={
                                                                onAddRepository
                                                            }
                                                            onActivate={() =>
                                                                void requestOpenRepositoryTool(
                                                                    "refs",
                                                                )
                                                            }
                                                            onSelect={selectRef}
                                                            refs={
                                                                repository.refs
                                                            }
                                                            selected={
                                                                selectedRef
                                                            }
                                                        />
                                                        <CommitLog
                                                            ahead={
                                                                repository
                                                                    .status
                                                                    .ahead
                                                            }
                                                            behind={
                                                                repository
                                                                    .status
                                                                    .behind
                                                            }
                                                            canCherryPick={
                                                                availability.cherryPick
                                                            }
                                                            commits={
                                                                repository.commits
                                                            }
                                                            hasMore={
                                                                sessionHasMoreCommits
                                                            }
                                                            loading={
                                                                sessionLogLoading
                                                            }
                                                            error={
                                                                sessionLogError
                                                            }
                                                            refs={
                                                                repository.refs
                                                            }
                                                            onLoad={
                                                                sessionLoadLog
                                                            }
                                                            onOpenNewTab={
                                                                openNewLogTab
                                                            }
                                                            indexing={
                                                                logIndexing
                                                            }
                                                            indexingEnabled={
                                                                logIndexingEnabled
                                                            }
                                                            powerSaveMode={
                                                                productSettings.powerSaveMode
                                                            }
                                                            relativeTimeBaseSeconds={
                                                                sessionFixture
                                                                    ? repository
                                                                          .commits[0]
                                                                          ?.authoredAt
                                                                    : undefined
                                                            }
                                                            onEnableIndexing={async (
                                                                filters,
                                                                order,
                                                            ) => {
                                                                setLogIndexing(
                                                                    true,
                                                                );
                                                                try {
                                                                    await sessionIndexLog(
                                                                        filters,
                                                                        order,
                                                                    );
                                                                    setLogIndexingEnabled(
                                                                        true,
                                                                    );
                                                                } finally {
                                                                    setLogIndexing(
                                                                        false,
                                                                    );
                                                                }
                                                            }}
                                                            onCherryPick={() =>
                                                                void runAction(
                                                                    "cherryPick",
                                                                )
                                                            }
                                                            onImportPatch={toVoidHandler(
                                                                async () => {
                                                                    const selectedPath =
                                                                        await selectPatchImportPath();
                                                                    if (
                                                                        selectedPath ===
                                                                        null
                                                                    )
                                                                        return;
                                                                    await sessionImportPatch(
                                                                        selectedPath,
                                                                    );
                                                                    setToast(
                                                                        "Patch applied to the index and working tree.",
                                                                    );
                                                                },
                                                            )}
                                                            onRefresh={() =>
                                                                void sessionReload()
                                                            }
                                                            onContextMenu={(
                                                                event,
                                                                commit,
                                                            ) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                if (
                                                                    !selectedOids.includes(
                                                                        commit.oid,
                                                                    )
                                                                )
                                                                    setSelectedOids(
                                                                        [
                                                                            commit.oid,
                                                                        ],
                                                                    );
                                                                setContextPosition(
                                                                    {
                                                                        x: event.clientX,
                                                                        y: event.clientY,
                                                                    },
                                                                );
                                                            }}
                                                            onSelectionChange={
                                                                setSelectedOids
                                                            }
                                                            selectedOids={
                                                                selectedOids
                                                            }
                                                            upstream={
                                                                repository
                                                                    .status
                                                                    .upstream
                                                            }
                                                        />
                                                        {revisionComparison ? (
                                                            <RevisionComparison
                                                                from={
                                                                    revisionComparison.from
                                                                }
                                                                loading={
                                                                    revisionComparison.loading
                                                                }
                                                                onPreferencesChange={
                                                                    setDiffPreferences
                                                                }
                                                                onReviewWidthChange={(
                                                                    width,
                                                                ) =>
                                                                    setHistoryReviewWidth(
                                                                        Math.min(
                                                                            480,
                                                                            Math.max(
                                                                                180,
                                                                                Math.round(
                                                                                    width,
                                                                                ),
                                                                            ),
                                                                        ),
                                                                    )
                                                                }
                                                                patch={
                                                                    revisionComparison.patch
                                                                }
                                                                preferences={
                                                                    diffPreferences
                                                                }
                                                                reviewWidth={
                                                                    historyReviewWidth
                                                                }
                                                                readFile={
                                                                    sessionReadFile
                                                                }
                                                                to={
                                                                    revisionComparison.to
                                                                }
                                                            />
                                                        ) : (
                                                            <DetailsPane
                                                                afterContent={
                                                                    historyContent.after
                                                                }
                                                                afterPreview={
                                                                    historyPreview.after
                                                                }
                                                                beforeContent={
                                                                    historyContent.before
                                                                }
                                                                beforePreview={
                                                                    historyPreview.before
                                                                }
                                                                submoduleDiff={
                                                                    historySubmodule.value
                                                                }
                                                                commit={
                                                                    primaryCommit
                                                                }
                                                                diffLoading={
                                                                    historyDiff.loading ||
                                                                    historyContent.loading ||
                                                                    historyPreview.loading ||
                                                                    historySubmodule.loading
                                                                }
                                                                files={
                                                                    commitFiles
                                                                }
                                                                loading={
                                                                    commitFilesLoading
                                                                }
                                                                onLoadDiff={(
                                                                    commit,
                                                                    file,
                                                                ) =>
                                                                    sessionLoadCommitDiff(
                                                                        commit,
                                                                        file.path,
                                                                        nativeDiffOptions(
                                                                            diffPreferences,
                                                                        ),
                                                                        historyParentRevision ??
                                                                            undefined,
                                                                    )
                                                                }
                                                                onReadFile={
                                                                    sessionReadFile
                                                                }
                                                                onRevertSelectedChanges={async () => {
                                                                    if (
                                                                        !historyDiff.patch ||
                                                                        !historySelectedPath
                                                                    ) {
                                                                        return;
                                                                    }
                                                                    const accepted =
                                                                        await dialog.confirm(
                                                                            {
                                                                                title: "Revert selected changes?",
                                                                                description:
                                                                                    "Applies the inverse of this file change to the working tree.",
                                                                                impact: historySelectedPath,
                                                                                confirmLabel:
                                                                                    "Revert selected changes",
                                                                                dangerous: true,
                                                                            },
                                                                        );
                                                                    if (
                                                                        !accepted
                                                                    )
                                                                        return;
                                                                    await sessionExecuteOperation(
                                                                        {
                                                                            kind: "applyPatch",
                                                                            patch: historyDiff.patch,
                                                                            cached: false,
                                                                            reverse: true,
                                                                        },
                                                                    );
                                                                }}
                                                                signature={
                                                                    commitSignature
                                                                }
                                                                parentRevision={
                                                                    historyParentRevision
                                                                }
                                                                patch={
                                                                    historyDiff.patch
                                                                }
                                                                preferences={
                                                                    diffPreferences
                                                                }
                                                                reviewWidth={
                                                                    historyReviewWidth
                                                                }
                                                                selectedPath={
                                                                    historySelectedPath
                                                                }
                                                                onNext={() =>
                                                                    selectRelative(
                                                                        "child",
                                                                    )
                                                                }
                                                                onPrevious={() =>
                                                                    selectRelative(
                                                                        "parent",
                                                                    )
                                                                }
                                                                onReviewWidthChange={(
                                                                    width,
                                                                ) =>
                                                                    setHistoryReviewWidth(
                                                                        Math.min(
                                                                            480,
                                                                            Math.max(
                                                                                180,
                                                                                Math.round(
                                                                                    width,
                                                                                ),
                                                                            ),
                                                                        ),
                                                                    )
                                                                }
                                                                onParentRevisionChange={
                                                                    setHistoryParentRevision
                                                                }
                                                                onPreferencesChange={
                                                                    setDiffPreferences
                                                                }
                                                                onSelectFile={(
                                                                    file,
                                                                ) =>
                                                                    setHistorySelectedPath(
                                                                        file.path,
                                                                    )
                                                                }
                                                                onInspectFile={(
                                                                    file,
                                                                    tab,
                                                                ) => {
                                                                    if (
                                                                        primaryCommit
                                                                    ) {
                                                                        openInspector(
                                                                            {
                                                                                revision:
                                                                                    primaryCommit.oid,
                                                                                source: {
                                                                                    kind: "revision",
                                                                                    revision:
                                                                                        primaryCommit.oid,
                                                                                },
                                                                                path: file.path,
                                                                                tab,
                                                                            },
                                                                        );
                                                                    }
                                                                }}
                                                                onOpenTree={() => {
                                                                    if (
                                                                        primaryCommit
                                                                    ) {
                                                                        openInspector(
                                                                            {
                                                                                revision:
                                                                                    primaryCommit.oid,
                                                                                source: {
                                                                                    kind: "revision",
                                                                                    revision:
                                                                                        primaryCommit.oid,
                                                                                },
                                                                                tab: "tree",
                                                                            },
                                                                        );
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </TabsContent>
                                        );
                                    })}
                                {!inspector && !logOpen && (
                                    <EmptyState className="gap-3 p-0 [&_[data-slot=empty-content]]:gap-3 [&_kbd]:ml-1.5 [&_kbd]:font-sans">
                                        <Button
                                            className={cn(
                                                "p-0 text-[13px] text-muted-foreground hover:underline",
                                            )}
                                            data-open-git-log
                                            onClick={openGitLogTab}
                                            variant="ghost"
                                            size="default"
                                        >
                                            Open Git Log <kbd>⌥G</kbd>
                                        </Button>
                                        <Button
                                            className={cn(
                                                "p-0 text-[13px] text-muted-foreground hover:underline",
                                            )}
                                            onClick={() =>
                                                setRepositoryViewMode("changes")
                                            }
                                            variant="ghost"
                                            size="default"
                                        >
                                            Commit <kbd>⌘0</kbd>
                                        </Button>
                                    </EmptyState>
                                )}
                                {inspectorTabs.map((tab) => {
                                    const key = inspectorKey(tab);
                                    const value = `inspector:${key}`;
                                    const scratch = tab.scratchId
                                        ? scratchFiles.find(
                                              (candidate) =>
                                                  candidate.id ===
                                                  tab.scratchId,
                                          )
                                        : undefined;
                                    return (
                                        <TabsContent
                                            aria-labelledby={editorTabDomId(
                                                editorTabsId,
                                                value,
                                            )}
                                            className={`editorSurface [height:100%] [min-height:0] [min-width:0] [&[hidden]]:[display:none] editorSurface`}
                                            id={editorPanelDomId(
                                                editorTabsId,
                                                value,
                                            )}
                                            keepMounted
                                            key={key}
                                            value={value}
                                        >
                                            {scratch ? (
                                                <ScratchEditor
                                                    bookmarkedLines={allLineBookmarks(
                                                        bookmarks,
                                                    )
                                                        .filter(
                                                            (bookmark) =>
                                                                bookmark.path ===
                                                                `Scratches/${scratch.name}`,
                                                        )
                                                        .map(
                                                            (bookmark) =>
                                                                bookmark.line,
                                                        )}
                                                    file={scratch}
                                                    initialColumn={tab.column}
                                                    initialLine={tab.line}
                                                    onChange={(content) =>
                                                        setScratchFiles(
                                                            (current) =>
                                                                current.map(
                                                                    (
                                                                        candidate,
                                                                    ) =>
                                                                        candidate.id ===
                                                                        scratch.id
                                                                            ? {
                                                                                  ...candidate,
                                                                                  content,
                                                                                  updatedAtMs:
                                                                                      Date.now(),
                                                                              }
                                                                            : candidate,
                                                                ),
                                                        )
                                                    }
                                                    onToggleBookmark={(
                                                        line,
                                                        column,
                                                    ) =>
                                                        requestToggleBookmark({
                                                            path: `Scratches/${scratch.name}`,
                                                            line,
                                                            column,
                                                        })
                                                    }
                                                />
                                            ) : (
                                                <RepositoryInspectorDialog
                                                    bookmarkedLines={
                                                        tab.path
                                                            ? allLineBookmarks(
                                                                  bookmarks,
                                                              )
                                                                  .filter(
                                                                      (
                                                                          bookmark,
                                                                      ) =>
                                                                          bookmark.path ===
                                                                          tab.path,
                                                                  )
                                                                  .map(
                                                                      (
                                                                          bookmark,
                                                                      ) =>
                                                                          bookmark.line,
                                                                  )
                                                            : []
                                                    }
                                                    embedded
                                                    initialPath={tab.path}
                                                    initialColumn={tab.column}
                                                    initialLine={tab.line}
                                                    initialTab={tab.tab}
                                                    loadBlame={sessionLoadBlame}
                                                    loadFileHistory={
                                                        sessionLoadFileHistory
                                                    }
                                                    loadTree={sessionLoadTree}
                                                    onClose={() =>
                                                        void requestCloseInspector(
                                                            key,
                                                        )
                                                    }
                                                    onDirtyChange={(dirty) =>
                                                        setInspectorDirty(
                                                            key,
                                                            dirty,
                                                        )
                                                    }
                                                    onToggleBookmark={(
                                                        path,
                                                        line,
                                                        column,
                                                    ) =>
                                                        requestToggleBookmark({
                                                            path,
                                                            line,
                                                            column,
                                                        })
                                                    }
                                                    openWorkingTreeFile={
                                                        sessionOpenWorkingTreeFile
                                                    }
                                                    readFile={sessionReadFile}
                                                    readFilePreview={
                                                        sessionReadFilePreview
                                                    }
                                                    readOnly={safeMode}
                                                    writeWorkingTreeFile={
                                                        sessionWriteWorkingTreeFile
                                                    }
                                                    revision={tab.revision}
                                                    source={tab.source}
                                                />
                                            )}
                                        </TabsContent>
                                    );
                                })}
                            </div>
                        </div>
                        <BottomPanel
                            collapsed={bottomCollapsed}
                            height={bottomPanelHeight}
                            active={bottomPanelTab}
                            fixture={sessionFixture}
                            onApplyShelf={(shelfId, drop) =>
                                void sessionApplyShelf(shelfId, drop)
                            }
                            onCreateShelf={(message, paths) =>
                                void sessionCreateShelf(message, paths)
                            }
                            onDeleteShelf={(shelfId) =>
                                void sessionDeleteShelf(shelfId)
                            }
                            onLoadStashFiles={(stash) =>
                                sessionLoadStashFiles(stash.selector)
                            }
                            onOpenStashDiff={openStashDiff}
                            onOperation={sessionExecuteOperation}
                            onRestoreRecovery={sessionRestoreRecoveryEntry}
                            onToggle={() =>
                                setBottomCollapsed((value) => !value)
                            }
                            onHeightChange={setBottomPanelHeight}
                            onActiveChange={setBottomPanelTab}
                            recoveryEntries={sessionRecoveryEntries}
                            gitConsoleEntries={sessionGitConsoleEntries}
                            onClearGitConsole={sessionClearGitConsole}
                            onLoadLocalHistoryActivities={
                                sessionListLocalHistoryActivities
                            }
                            onLoadLocalHistoryActivity={
                                sessionReadLocalHistoryActivity
                            }
                            onLoadLocalHistoryDiff={sessionLoadLocalHistoryDiff}
                            onCreateLocalHistoryPatch={
                                sessionCreateLocalHistoryPatch
                            }
                            onPutLocalHistoryLabel={sessionPutLocalHistoryLabel}
                            findResults={findResults}
                            onOpenFindResult={(result) => {
                                setRepositoryViewMode("history");
                                openInspector({
                                    revision:
                                        repository.snapshot.headOid ?? "HEAD",
                                    source: { kind: "workingTree" },
                                    path: result.path,
                                    tab: "file",
                                    line: result.line,
                                    column: result.column,
                                });
                            }}
                            onSearchAgain={() => {
                                setProjectSearchInitialQuery("");
                                setProjectSearchSurface("find");
                            }}
                            onRevertLocalHistory={sessionRevertLocalHistory}
                            repositoryId={repository.snapshot.id}
                            repositoryName={repository.snapshot.name}
                            shelves={sessionShelves}
                            stashes={sessionStashes}
                            status={repository.status}
                        />
                    </RepositoryEditorSurface>
                    {notificationOpen && (
                        <NotificationToolWindow
                            notifications={notifications}
                            onClear={() => setNotifications([])}
                            onClose={() => setNotificationOpen(false)}
                        />
                    )}
                    {balloonId &&
                        (() => {
                            const notification = notifications.find(
                                (item) => item.id === balloonId,
                            );
                            return notification ? (
                                <NotificationBalloon
                                    notification={notification}
                                    onAction={(action) => {
                                        if (action === "modifyShortcuts") {
                                            onOpenSettings();
                                        } else if (
                                            action === "openUrl" &&
                                            notification.url
                                        ) {
                                            void openExternalUrl(
                                                notification.url,
                                            );
                                        } else if (action === "dismiss") {
                                            onDismissShortcutConflictWarning();
                                            setNotifications((current) =>
                                                current.filter(
                                                    (item) =>
                                                        item.id !==
                                                        notification.id,
                                                ),
                                            );
                                        } else {
                                            setNotificationOpen(true);
                                        }
                                        setBalloonId(undefined);
                                    }}
                                    onDismiss={() => setBalloonId(undefined)}
                                />
                            ) : null;
                        })()}
                    <RepositoryRightToolStripe
                        notificationCount={notifications.length}
                        notificationsOpen={notificationOpen}
                        onToggleNotifications={() =>
                            setNotificationOpen((current) => !current)
                        }
                    />
                </RepositoryToolWindows>
            </Tabs>
            <RepositoryStatusBar
                navigationStatus={navigationStatus}
                productSettings={productSettings}
                session={session}
                terminalFocused={terminalFocused}
            />
            {contextPosition && (
                <CommitContextMenu
                    availability={availability}
                    onClose={() => setContextPosition(undefined)}
                    onAction={(action) => void runAction(action)}
                    x={contextPosition.x}
                    y={contextPosition.y}
                />
            )}
            {diffState && (
                <section
                    className={`standaloneDiff [background:var(--card)] [display:grid] [grid-template-rows:38px_minmax(0,_1fr)] [inset:70px_0_23px] [position:fixed] [z-index:44] [&>_header]:[align-items:center] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[padding:0_9px] [&>_header_span]:[flex:1] standaloneDiff`}
                    aria-label="Standalone diff review"
                >
                    <header>
                        <strong>Comparison</strong>
                        <span />
                        <Button
                            className={cn("min-h-7 px-2 text-xs")}
                            onClick={() => setDiffState(undefined)}
                            variant="secondary"
                            size="sm"
                        >
                            Back to workspace
                        </Button>
                    </header>
                    <DiffViewer
                        file={diffState.file}
                        loading={diffState.loading}
                        mode="readOnly"
                        onPreferencesChange={setDiffPreferences}
                        patch={diffState.patch}
                        preferences={diffPreferences}
                        sourceLabel="Comparison"
                    />
                </section>
            )}
            {conflictContent && (
                <ConflictEditorDialog
                    content={conflictContent}
                    onAbort={async () => {
                        await abortInProgressOperation();
                        setConflictContent(undefined);
                    }}
                    onClose={() => setConflictContent(undefined)}
                    onContinue={async () => {
                        const operation = repository.snapshot.operation;
                        if (!operation || operation === "bisect") return;
                        await sessionExecuteOperation({
                            kind: "continue",
                            operation,
                        });
                        setConflictContent(undefined);
                    }}
                    onResolveBinary={async (side) => {
                        await sessionResolveBinaryConflict(
                            conflictContent.path,
                            side,
                        );
                        setConflictContent(undefined);
                    }}
                    onSave={async (result) => {
                        await sessionSaveConflictResult(
                            conflictContent.path,
                            result,
                            true,
                        );
                        setConflictContent(undefined);
                    }}
                    operation={repository.snapshot.operation}
                />
            )}
            {historyRewrite && (
                <HistoryRewriteWorkspace
                    currentHeadOid={repository.snapshot.headOid}
                    fromRevision={historyRewrite.fromRevision}
                    onClose={() => setHistoryRewrite(null)}
                    onExecute={(operation) =>
                        sessionExecuteOperation(operation, true)
                    }
                    onLoadPreview={sessionLoadHistoryRewritePreview}
                    onOpenPush={() => {
                        setHistoryRewrite(null);
                        onOpenPush("HEAD", true);
                    }}
                    operationInProgress={repository.snapshot.operation !== null}
                    squashOids={historyRewrite.squashOids}
                />
            )}
            {shareExistingRemotes && (
                <ShareExistingRemotesDialog
                    onCancel={() => setShareExistingRemotes(undefined)}
                    onOpenRemote={openExistingRemote}
                    onShareAnyway={() => {
                        setShareProjectProvider(shareExistingRemotes.provider);
                        setShareExistingRemotes(undefined);
                    }}
                    remotes={shareExistingRemotes.remotes}
                    service={
                        shareExistingRemotes.provider === "gitHub"
                            ? "GitHub"
                            : "GitLab"
                    }
                />
            )}
            {shareProjectProvider && !shareExistingRemotes && (
                <ShareProjectDialog
                    currentBranch={repository.snapshot.currentBranch}
                    changes={repository.status.changes}
                    hasCommits={repository.snapshot.hasCommits}
                    onBind={bindSharedProject}
                    onClose={() => setShareProjectProvider(undefined)}
                    onManageAccounts={() =>
                        void requestOpenRepositoryTool("hosting")
                    }
                    projectName={repository.snapshot.name}
                    provider={shareProjectProvider}
                    remoteNames={sessionRemotes.map((remote) => remote.name)}
                />
            )}
            {dialog.node}
            {toast && (
                <div
                    className={`toast [align-items:center] [background:var(--inverse)] rounded-lg [bottom:36px] [box-shadow:var(--shadow-lg)] [color:var(--inverse-foreground)] [display:flex] [gap:7px] [left:50%] [padding:9px_13px] [position:fixed] [transform:translateX(-50%)] [z-index:80] toast rounded-lg`}
                >
                    <Icon name="check" size={15} />
                    {toast}
                </div>
            )}
        </>
    );
}
