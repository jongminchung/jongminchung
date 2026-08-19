import type { GitSessionCapabilities } from "../../application/git-session/ports/GitSessionCapabilities";
import type { ProductSettings } from "../../domain/productSettings";
import type {
    FileChange,
    Ref,
    RepositoryView,
    StashEntry,
} from "../../domain/types";
import type { useRepositoryCommandController } from "./commands/useRepositoryCommandController";
import type { RepositoryEditorFeatureController } from "./editor/useRepositoryEditorFeatureController";
import type { useRepositoryHostingCoordinator } from "./overlays/useRepositoryHostingCoordinator";
import type { useRepositoryReviewController } from "./review/useRepositoryReviewController";
import type { RepositoryReviewState } from "./review/useRepositoryReviewState";
import type { RepositoryToolWindowState } from "./tool-windows/useRepositoryToolWindowState";
import type { useRepositoryWorkspaceLifecycle } from "./tool-windows/useRepositoryWorkspaceLifecycle";
import type { useRepositoryVcsController } from "./vcs/useRepositoryVcsController";

type CommandController = ReturnType<typeof useRepositoryCommandController>;
type HostingController = ReturnType<typeof useRepositoryHostingCoordinator>;
type ReviewController = ReturnType<typeof useRepositoryReviewController>;
type VcsController = ReturnType<typeof useRepositoryVcsController>;
type WorkspaceLifecycle = ReturnType<typeof useRepositoryWorkspaceLifecycle>;

export function createRepositoryWorkspaceFeatureModel({
    command,
    editor,
    handlers,
    hosting,
    lifecycle,
    productSettings,
    repository,
    review,
    reviewController,
    safeMode,
    session,
    toolWindows,
    vcs,
    workspace,
}: {
    readonly command: CommandController;
    readonly editor: RepositoryEditorFeatureController;
    readonly handlers: {
        readonly abortInProgressOperation: () => Promise<void>;
        readonly openConflict: (file: FileChange) => void;
        readonly openStashDiff: (stash: StashEntry) => void;
        readonly selectRef: (ref: Ref) => void;
    };
    readonly hosting: HostingController;
    readonly lifecycle: WorkspaceLifecycle;
    readonly productSettings: ProductSettings;
    readonly repository: RepositoryView;
    readonly review: RepositoryReviewState;
    readonly reviewController: ReviewController;
    readonly safeMode: boolean;
    readonly session: GitSessionCapabilities;
    readonly toolWindows: RepositoryToolWindowState;
    readonly vcs: VcsController;
    readonly workspace: {
        readonly onAddRepository: () => void;
        readonly onDismissShortcutConflictWarning: () => void;
        readonly onOpenPush: (
            localRevision?: string,
            knownRewrite?: boolean,
        ) => void;
        readonly onOpenSettings: () => void;
    };
}) {
    const hasEditorTabs =
        toolWindows.logOpen || editor.inspectorTabs.length > 0;
    const activeEditorTabValue =
        editor.activeInspectorKey === undefined
            ? `log:${toolWindows.activeLogTabId}`
            : `inspector:${editor.activeInspectorKey}`;
    return {
        editor: {
            bookmarks: editor.bookmarks,
            dirtyInspectorKeys: editor.dirtyInspectorKeys,
            editorTabsId: editor.editorTabsId,
            inspector: editor.inspector,
            inspectorTabs: editor.inspectorTabs,
            openInspector: editor.openInspector,
            openLineBookmark: editor.openLineBookmark,
            openScratchFile: editor.openScratchFile,
            pinnedInspectorKeys: editor.pinnedInspectorKeys,
            previewInspectorKey: editor.previewInspectorKey,
            requestCloseInspector: editor.requestCloseInspector,
            requestToggleBookmark: editor.requestToggleBookmark,
            safeMode,
            scratchFiles: editor.scratchFiles,
            sessionLoadBlame: session.queries.loadBlame,
            sessionLoadFileHistory: session.queries.loadFileHistory,
            sessionLoadTree: session.queries.loadTree,
            sessionOpenWorkingTreeFile: session.queries.openWorkingTreeFile,
            sessionReadFile: session.queries.readFile,
            sessionReadFilePreview: session.queries.readFilePreview,
            sessionWriteWorkingTreeFile: session.mutations.writeWorkingTreeFile,
            setInspectorDirty: editor.setInspectorDirty,
            setScratchFiles: editor.setScratchFiles,
        },
        review: {
            availability: reviewController.availability,
            commitFiles: review.commitFiles,
            commitFilesLoading: review.commitFilesLoading,
            commitSignature: review.commitSignature,
            diffPreferences: review.diffPreferences,
            historyContent: review.historyContent,
            historyDiff: review.historyDiff,
            historyParentRevision: review.historyParentRevision,
            historyPreview: review.historyPreview,
            historyReviewWidth: toolWindows.historyReviewWidth,
            historySelectedPath: review.historySelectedPath,
            historySubmodule: review.historySubmodule,
            primaryCommit: reviewController.primaryCommit,
            repository,
            revisionComparison: review.revisionComparison,
            runAction: reviewController.runAction,
            selectRef: handlers.selectRef,
            selectRelative: reviewController.selectRelative,
            selectedOids: review.selectedOids,
            selectedRef: review.selectedRef,
            sessionHasMoreCommits: session.repository.hasMoreCommits,
            sessionImportPatch: session.mutations.importPatch,
            sessionIndexLog: session.queries.indexLog,
            sessionLoadCommitDiff: session.queries.loadCommitDiff,
            sessionLoadLog: session.queries.loadLog,
            sessionLogError: session.repository.logError,
            sessionLogLoading: session.repository.logLoading,
            sessionReload: session.queries.reload,
            setContextPosition: review.setContextPosition,
            setDiffPreferences: review.setDiffPreferences,
            setHistoryParentRevision: review.setHistoryParentRevision,
            setHistoryReviewWidth: toolWindows.setHistoryReviewWidth,
            setHistorySelectedPath: review.setHistorySelectedPath,
            setLogIndexing: toolWindows.setLogIndexing,
            setLogIndexingEnabled: toolWindows.setLogIndexingEnabled,
            setSelectedOids: review.setSelectedOids,
        },
        vcs: {
            changeContent: review.changeContent,
            changeDiff: review.changeDiff,
            changePreview: review.changePreview,
            changeSelection: review.changeSelection,
            changeSubmodule: review.changeSubmodule,
            changesNavigatorWidth: toolWindows.changesNavigatorWidth,
            commitDraft: review.commitDraft,
            commitRailWidth: toolWindows.commitRailWidth,
            onOpenPush: workspace.onOpenPush,
            openConflict: handlers.openConflict,
            openStashDiff: handlers.openStashDiff,
            sessionChangelists: session.repository.changelists,
            sessionApplyShelf: session.mutations.applyShelf,
            sessionCommitChangelist: session.mutations.commitChangelist,
            sessionCreateLocalHistoryPatch:
                session.queries.createLocalHistoryPatch,
            sessionCreateShelf: session.mutations.createShelf,
            sessionDeleteChangelist: session.mutations.deleteChangelist,
            sessionDeleteShelf: session.mutations.deleteShelf,
            sessionExecuteOperation: session.mutations.executeOperation,
            sessionListLocalHistoryActivities:
                session.queries.listLocalHistoryActivities,
            sessionLoadLocalHistoryDiff: session.queries.loadLocalHistoryDiff,
            sessionLoadStashFiles: session.queries.loadStashFiles,
            sessionPutLocalHistoryLabel: session.mutations.putLocalHistoryLabel,
            sessionPreCommitCheck: session.queries.preCommitCheck,
            sessionReadLocalHistoryActivity:
                session.queries.readLocalHistoryActivity,
            sessionRecoveryEntries: session.repository.recoveryEntries,
            sessionRestoreRecoveryEntry: session.mutations.restoreRecoveryEntry,
            sessionRevertLocalHistory: session.mutations.revertLocalHistory,
            sessionSaveChangelist: session.mutations.saveChangelist,
            sessionShelves: session.repository.shelves,
            sessionStashes: session.repository.stashes,
            setChangeSelection: review.setChangeSelection,
            setChangesNavigatorWidth: toolWindows.setChangesNavigatorWidth,
            setCommitDraft: review.setCommitDraft,
            setCommitRailWidth: toolWindows.setCommitRailWidth,
            workingEntries: vcs.workingEntries,
        },
        toolWindows: {
            abortInProgressOperation: handlers.abortInProgressOperation,
            activeEditorTabValue,
            activeLogTabId: toolWindows.activeLogTabId,
            balloonId: toolWindows.balloonId,
            bookmarksOpen: toolWindows.bookmarksOpen,
            bottomCollapsed: toolWindows.bottomCollapsed,
            bottomPanelHeight: toolWindows.bottomPanelHeight,
            bottomPanelTab: toolWindows.bottomPanelTab,
            closeInspectorEditorTab: editor.closeInspectorEditorTab,
            closeLogTab: editor.closeLogTab,
            dialog: toolWindows.dialog,
            findResults: editor.findResults,
            hasEditorTabs,
            inspector: editor.inspector,
            leftToolWindowOpen:
                review.repositoryViewMode === "changes" ||
                toolWindows.projectOpen ||
                toolWindows.bookmarksOpen,
            logIndexing: toolWindows.logIndexing,
            logIndexingEnabled: toolWindows.logIndexingEnabled,
            logOpen: toolWindows.logOpen,
            logTabIds: toolWindows.logTabIds,
            maximizedToolWindow: toolWindows.maximizedToolWindow,
            navigationStatus: lifecycle.navigationStatus,
            notificationOpen: toolWindows.notificationOpen,
            notifications: toolWindows.notifications,
            onAddRepository: workspace.onAddRepository,
            onDismissShortcutConflictWarning:
                workspace.onDismissShortcutConflictWarning,
            onOpenSettings: workspace.onOpenSettings,
            openGitLogTab: editor.openGitLogTab,
            openInspector: editor.openInspector,
            openNewLogTab: editor.openNewLogTab,
            productSettings,
            projectOpen: toolWindows.projectOpen,
            repository,
            repositoryViewMode: review.repositoryViewMode,
            safeMode,
            requestOpenRepositoryTool: editor.requestOpenRepositoryTool,
            session,
            sessionRemotes: session.repository.remotes,
            sessionClearGitConsole: session.activity.clearConsole,
            sessionFixture: session.repository.fixture,
            sessionGitConsoleEntries: session.activity.gitConsoleEntries,
            sessionLoading: session.repository.loading,
            sessionStale: session.repository.stale,
            setActiveInspectorKey: editor.setActiveInspectorKey,
            setActiveLogTabId: toolWindows.setActiveLogTabId,
            setBalloonId: toolWindows.setBalloonId,
            setBookmarks: editor.setBookmarks,
            setBookmarksOpen: toolWindows.setBookmarksOpen,
            setBottomCollapsed: toolWindows.setBottomCollapsed,
            setBottomPanelHeight: toolWindows.setBottomPanelHeight,
            setBottomPanelTab: toolWindows.setBottomPanelTab,
            setNotificationOpen: toolWindows.setNotificationOpen,
            setNotifications: toolWindows.setNotifications,
            setProjectOpen: toolWindows.setProjectOpen,
            setProjectSearchInitialQuery: editor.setProjectSearchInitialQuery,
            setProjectSearchSurface: editor.setProjectSearchSurface,
            setRepositoryViewMode: review.setRepositoryViewMode,
            setScratchFileChooserOpen: editor.setScratchFileChooserOpen,
            setSideToolWindowWidth: toolWindows.setSideToolWindowWidth,
            setToast: toolWindows.setToast,
            sideToolWindowWidth: toolWindows.sideToolWindowWidth,
            terminalAvailability: session.terminal,
            terminalFocused: lifecycle.terminalFocused,
        },
        overlays: {
            abortInProgressOperation: handlers.abortInProgressOperation,
            availability: reviewController.availability,
            bindSharedProject: hosting.bindSharedProject,
            chooseBookmarkMnemonic: editor.chooseBookmarkMnemonic,
            conflictContent: review.conflictContent,
            contextPosition: review.contextPosition,
            createScratchFile: editor.createScratchFile,
            dialog: toolWindows.dialog,
            diffPreferences: review.diffPreferences,
            diffState: review.diffState,
            executeCommand: command.executeCommand,
            exportToHtml: editor.exportToHtml,
            historyRewrite: review.historyRewrite,
            inspector: editor.inspector,
            onOpenPush: workspace.onOpenPush,
            openCodeIssue: editor.openCodeIssue,
            openExistingRemote: hosting.openExistingRemote,
            openInspector: editor.openInspector,
            openLineBookmark: editor.openLineBookmark,
            openStackFrame: editor.openStackFrame,
            productSettings,
            replaceInProjectFiles: editor.replaceInProjectFiles,
            repository,
            requestOpenRepositoryTool: editor.requestOpenRepositoryTool,
            runAction: reviewController.runAction,
            runCodeCleanup: editor.runCodeCleanup,
            runCodeInspection: editor.runCodeInspection,
            sessionActivity: session.activity.current,
            sessionCancelActivity: session.activity.cancel,
            sessionExecuteOperation: session.mutations.executeOperation,
            sessionLoadHistoryRewritePreview:
                session.queries.loadHistoryRewritePreview,
            sessionRemotes: session.repository.remotes,
            sessionResolveBinaryConflict:
                session.mutations.resolveBinaryConflict,
            sessionSaveConflictResult: session.mutations.saveConflictResult,
            sessionSearchProjectText: session.queries.searchProjectText,
            setConflictContent: review.setConflictContent,
            setContextPosition: review.setContextPosition,
            setDiffPreferences: review.setDiffPreferences,
            setDiffState: review.setDiffState,
            setHistoryRewrite: review.setHistoryRewrite,
            setShareExistingRemotes: toolWindows.setShareExistingRemotes,
            setShareProjectProvider: toolWindows.setShareProjectProvider,
            shareExistingRemotes: toolWindows.shareExistingRemotes,
            shareProjectProvider: toolWindows.shareProjectProvider,
            toast: toolWindows.toast,
            vcsOperationGroups: command.vcsOperationGroups,
        },
    };
}

export type RepositoryWorkspaceFeatureModel = ReturnType<
    typeof createRepositoryWorkspaceFeatureModel
>;
