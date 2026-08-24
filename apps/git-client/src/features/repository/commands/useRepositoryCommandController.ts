import { useMemo } from "react";
import type { GitSessionCapabilities } from "../../../application/git-session/ports/GitSessionCapabilities";
import {
  useCommands,
  useDismissLayer,
} from "../../../components/CommandProvider";
import type { CommandDefinition } from "../../../domain/commands";
import type { ProductSettings } from "../../../domain/productSettings";
import type { FileChange, Ref, RepositoryView } from "../../../domain/types";
import type { RepositoryEditorFeatureController } from "../editor/useRepositoryEditorFeatureController";
import type { useRepositoryHostingCoordinator } from "../overlays/useRepositoryHostingCoordinator";
import type { useRepositoryReviewController } from "../review/useRepositoryReviewController";
import type { RepositoryReviewState } from "../review/useRepositoryReviewState";
import type { RepositoryToolWindowState } from "../tool-windows/useRepositoryToolWindowState";
import type { useRepositoryVcsController } from "../vcs/useRepositoryVcsController";
import { useRepositoryCommands } from "./useRepositoryCommands";
import { useRepositoryPalette } from "./useRepositoryPalette";

type ReviewController = ReturnType<typeof useRepositoryReviewController>;
type VcsController = ReturnType<typeof useRepositoryVcsController>;
type HostingController = ReturnType<typeof useRepositoryHostingCoordinator>;

export function useRepositoryCommandController({
  editor,
  hosting,
  onOpenPush,
  onOpenSettings,
  openConflict,
  productSettings,
  repository,
  repositoryAvailability,
  review,
  reviewController,
  selectRef,
  session,
  toolWindows,
  vcs,
}: {
  readonly editor: RepositoryEditorFeatureController;
  readonly hosting: HostingController;
  readonly onOpenPush: (localRevision?: string, knownRewrite?: boolean) => void;
  readonly onOpenSettings: () => void;
  readonly openConflict: (file: FileChange) => void;
  readonly productSettings: ProductSettings;
  readonly repository: RepositoryView;
  readonly repositoryAvailability: CommandDefinition["availability"];
  readonly review: RepositoryReviewState;
  readonly reviewController: ReviewController;
  readonly selectRef: (ref: Ref) => void;
  readonly session: GitSessionCapabilities;
  readonly toolWindows: RepositoryToolWindowState;
  readonly vcs: VcsController;
}) {
  const { execute, openPaletteFor } = useCommands();
  useRepositoryCommands({
    project: {
      dialog: toolWindows.dialog,
      dirtyInspectorKeys: editor.dirtyInspectorKeys,
      inspector: editor.inspector,
      projectFiles: editor.projectFiles,
      repositoryAvailability,
      session,
      setExportToHtmlOpen: editor.setExportToHtmlOpen,
      setScratchFileChooserOpen: editor.setScratchFileChooserOpen,
    },
    editor: {
      activateRelativeInspector: editor.activateRelativeInspector,
      activeInspectorIndex: editor.activeInspectorIndex,
      activeInspectorKey: editor.activeInspectorKey,
      activeToolWindow: toolWindows.activeToolWindow,
      beginMnemonicBookmark: editor.beginMnemonicBookmark,
      bookmarks: editor.bookmarks,
      bottomPanelTab: toolWindows.bottomPanelTab,
      dirtyInspectorKeys: editor.dirtyInspectorKeys,
      dispatchEditorAction: editor.dispatchEditorAction,
      dispatchEditorSearch: editor.dispatchEditorSearch,
      editorActionAvailability: editor.editorActionAvailability,
      editorStatus: toolWindows.editorStatus,
      editorTabAvailability: editor.editorTabAvailability,
      inspector: editor.inspector,
      inspectorTabKeys: editor.inspectorTabKeys,
      openLineBookmark: editor.openLineBookmark,
      pinnedInspectorKeys: editor.pinnedInspectorKeys,
      previewInspectorKey: editor.previewInspectorKey,
      productSettings,
      readOnlyInspectorKeys: editor.readOnlyInspectorKeys,
      requestCloseInspector: editor.requestCloseInspector,
      requestCloseInspectors: editor.requestCloseInspectors,
      setBookmarksPopupMode: editor.setBookmarksPopupMode,
      setPreviewInspectorKey: editor.setPreviewInspectorKey,
      setProjectSearchInitialQuery: editor.setProjectSearchInitialQuery,
      setProjectSearchSurface: editor.setProjectSearchSurface,
      setRecentFindUsagesOpen: editor.setRecentFindUsagesOpen,
      setReplaceInFilesOpen: editor.setReplaceInFilesOpen,
      terminalTabCount: toolWindows.terminalTabCount,
      toggleCurrentBookmark: editor.toggleCurrentBookmark,
    },
    vcs: {
      applyPatchFromClipboard: vcs.applyPatchFromClipboard,
      applyPatchFromFile: vcs.applyPatchFromFile,
      availability: reviewController.availability,
      changeSelection: review.changeSelection,
      compareVcsFile: vcs.compareVcsFile,
      conflictedFile: vcs.conflictedFile,
      createPatchFromLocalChanges: vcs.createPatchFromLocalChanges,
      dialog: toolWindows.dialog,
      hasTrackedWorkingChanges: vcs.hasTrackedWorkingChanges,
      historySelectedPath: review.historySelectedPath,
      inspector: editor.inspector,
      onOpenPush,
      openConflict,
      openVcsFileTab: vcs.openVcsFileTab,
      primaryCommit: reviewController.primaryCommit,
      repository,
      repositoryAvailability,
      requestOpenRepositoryTool: editor.requestOpenRepositoryTool,
      requestShareProject: hosting.requestShareProject,
      rollbackVcsFile: vcs.rollbackVcsFile,
      runAction: reviewController.runAction,
      session,
      setBottomPanelTab: toolWindows.setBottomPanelTab,
      setToast: toolWindows.setToast,
      setVcsOperationsOpen: editor.setVcsOperationsOpen,
      showVcsFileChanges: vcs.showVcsFileChanges,
      untrackedPaths: vcs.untrackedPaths,
      vcsFileChange: vcs.vcsFileChange,
      vcsFileEntry: vcs.vcsFileEntry,
      vcsFilePath: vcs.vcsFilePath,
      vcsFileVersioned: vcs.vcsFileVersioned,
      workingEntries: vcs.workingEntries,
    },
    search: {
      dispatchEditorSearch: editor.dispatchEditorSearch,
      editorActionAvailability: editor.editorActionAvailability,
      editorStatus: toolWindows.editorStatus,
      focusCurrentSearch: editor.focusCurrentSearch,
      inspector: editor.inspector,
      navigateInspectorHistory: editor.navigateInspectorHistory,
      navigationHistory: editor.navigationHistory,
      navigationIndex: editor.navigationIndex,
      onOpenSettings,
      openPaletteFor,
      runCodeCleanup: editor.runCodeCleanup,
      setCodeAnalysisRequest: editor.setCodeAnalysisRequest,
      setInspectionResults: editor.setInspectionResults,
      setProjectSearchInitialQuery: editor.setProjectSearchInitialQuery,
      setProjectSearchSurface: editor.setProjectSearchSurface,
      setRunInspectionOpen: editor.setRunInspectionOpen,
      setStackTraceOpen: editor.setStackTraceOpen,
    },
    appearance: {
      activeToolWindow: toolWindows.activeToolWindow,
      balloonId: toolWindows.balloonId,
      bookmarksOpen: toolWindows.bookmarksOpen,
      bottomPanelTab: toolWindows.bottomPanelTab,
      jumpToLastToolWindow: toolWindows.jumpToLastToolWindow,
      logOpen: toolWindows.logOpen,
      logTabIds: toolWindows.logTabIds,
      notificationOpen: toolWindows.notificationOpen,
      notifications: toolWindows.notifications,
      openGitLogTab: editor.openGitLogTab,
      processesOpen: toolWindows.processesOpen,
      projectOpen: toolWindows.projectOpen,
      repositoryAvailability,
      repositoryViewMode: review.repositoryViewMode,
      setActiveInspectorKey: editor.setActiveInspectorKey,
      setActiveLogTabId: toolWindows.setActiveLogTabId,
      setActiveToolWindow: toolWindows.setActiveToolWindow,
      setBalloonId: toolWindows.setBalloonId,
      setBookmarksOpen: toolWindows.setBookmarksOpen,
      setBottomCollapsed: toolWindows.setBottomCollapsed,
      setBottomPanelHeight: toolWindows.setBottomPanelHeight,
      setBottomPanelTab: toolWindows.setBottomPanelTab,
      setLogOpen: toolWindows.setLogOpen,
      setLogTabIds: toolWindows.setLogTabIds,
      setMaximizedToolWindow: toolWindows.setMaximizedToolWindow,
      setNotificationOpen: toolWindows.setNotificationOpen,
      setNotifications: toolWindows.setNotifications,
      setProcessesOpen: toolWindows.setProcessesOpen,
      setProjectOpen: toolWindows.setProjectOpen,
      setRepositoryViewMode: review.setRepositoryViewMode,
      setSideToolWindowWidth: toolWindows.setSideToolWindowWidth,
      terminalTabCount: toolWindows.terminalTabCount,
    },
  });

  const vcsOperationGroups = useRepositoryPalette({
    ...vcs,
    availability: reviewController.availability,
    openInspector: editor.openInspector,
    openScratchFile: editor.openScratchFile,
    primaryCommit: reviewController.primaryCommit,
    projectFiles: editor.projectFiles,
    recentInspectors: editor.recentInspectors,
    repository,
    scratchFiles: editor.scratchFiles,
    selectRef,
    session,
    setChangeSelection: review.setChangeSelection,
    setHistoryRewrite: review.setHistoryRewrite,
    setRepositoryViewMode: review.setRepositoryViewMode,
    setSelectedOids: review.setSelectedOids,
  });
  const {
    contextPosition,
    diffState,
    selectedOids,
    setContextPosition,
    setDiffState,
    setSelectedOids,
  } = review;

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
          setSelectedOids(
            reviewController.primaryCommit?.oid
              ? [reviewController.primaryCommit.oid]
              : [],
          ),
      }),
      [
        selectedOids.length,
        setSelectedOids,
        reviewController.primaryCommit?.oid,
      ],
    ),
  );

  return { executeCommand: execute, vcsOperationGroups };
}
