import {
  DEFAULT_BOTTOM_PANEL_HEIGHT,
  DEFAULT_HISTORY_REVIEW_WIDTH,
  DEFAULT_SIDE_TOOL_WINDOW_WIDTH,
} from "../../../../domain/workspacePersistence";
import type {
  LayoutSlice,
  RepositoryWorkspaceSliceCreator,
  RepositoryWorkspaceStoreOptions,
} from "../repositoryWorkspaceStoreTypes";
import { resolveRepositoryState } from "./stateUpdater";

export const createLayoutSlice = (
  options: RepositoryWorkspaceStoreOptions,
): RepositoryWorkspaceSliceCreator<LayoutSlice> =>
  ((set) => ({
    bottomCollapsed: true,
    projectOpen: true,
    bookmarksOpen: false,
    logOpen: true,
    logTabIds: ["log-1"],
    activeLogTabId: "log-1",
    logIndexing: false,
    logIndexingEnabled: false,
    bottomPanelHeight: DEFAULT_BOTTOM_PANEL_HEIGHT,
    sideToolWindowWidth: DEFAULT_SIDE_TOOL_WINDOW_WIDTH,
    bottomPanelTab: "shelf",
    changesNavigatorWidth: 250,
    historyReviewWidth: DEFAULT_HISTORY_REVIEW_WIDTH,
    commitRailWidth: 315,
    toast: undefined,
    notificationOpen: false,
    processesOpen: false,
    activeToolWindow: null,
    maximizedToolWindow: null,
    shareProjectProvider: undefined,
    shareExistingRemotes: undefined,
    notifications: [],
    balloonId: undefined,
    uiStateRestored: !options.electronRuntime,
    editorStatus: undefined,
    setBottomCollapsed: (value) =>
      set((state) => ({
        bottomCollapsed: resolveRepositoryState(value, state.bottomCollapsed),
      })),
    setProjectOpen: (value) =>
      set((state) => ({
        projectOpen: resolveRepositoryState(value, state.projectOpen),
      })),
    setBookmarksOpen: (value) =>
      set((state) => ({
        bookmarksOpen: resolveRepositoryState(value, state.bookmarksOpen),
      })),
    setLogOpen: (value) =>
      set((state) => ({
        logOpen: resolveRepositoryState(value, state.logOpen),
      })),
    setLogTabIds: (value) =>
      set((state) => ({
        logTabIds: resolveRepositoryState(value, state.logTabIds),
      })),
    setActiveLogTabId: (value) =>
      set((state) => ({
        activeLogTabId: resolveRepositoryState(value, state.activeLogTabId),
      })),
    setLogIndexing: (value) =>
      set((state) => ({
        logIndexing: resolveRepositoryState(value, state.logIndexing),
      })),
    setLogIndexingEnabled: (value) =>
      set((state) => ({
        logIndexingEnabled: resolveRepositoryState(
          value,
          state.logIndexingEnabled,
        ),
      })),
    setBottomPanelHeight: (value) =>
      set((state) => ({
        bottomPanelHeight: resolveRepositoryState(
          value,
          state.bottomPanelHeight,
        ),
      })),
    setSideToolWindowWidth: (value) =>
      set((state) => ({
        sideToolWindowWidth: resolveRepositoryState(
          value,
          state.sideToolWindowWidth,
        ),
      })),
    setBottomPanelTab: (value) =>
      set((state) => ({
        bottomPanelTab: resolveRepositoryState(value, state.bottomPanelTab),
      })),
    setChangesNavigatorWidth: (value) =>
      set((state) => ({
        changesNavigatorWidth: resolveRepositoryState(
          value,
          state.changesNavigatorWidth,
        ),
      })),
    setHistoryReviewWidth: (value) =>
      set((state) => ({
        historyReviewWidth: resolveRepositoryState(
          value,
          state.historyReviewWidth,
        ),
      })),
    setCommitRailWidth: (value) =>
      set((state) => ({
        commitRailWidth: resolveRepositoryState(value, state.commitRailWidth),
      })),
    setToast: (value) =>
      set((state) => ({
        toast: resolveRepositoryState(value, state.toast),
      })),
    setNotificationOpen: (value) =>
      set((state) => ({
        notificationOpen: resolveRepositoryState(value, state.notificationOpen),
      })),
    setProcessesOpen: (value) =>
      set((state) => ({
        processesOpen: resolveRepositoryState(value, state.processesOpen),
      })),
    setActiveToolWindow: (value) =>
      set((state) => ({
        activeToolWindow: resolveRepositoryState(value, state.activeToolWindow),
      })),
    setMaximizedToolWindow: (value) =>
      set((state) => ({
        maximizedToolWindow: resolveRepositoryState(
          value,
          state.maximizedToolWindow,
        ),
      })),
    setShareProjectProvider: (value) =>
      set((state) => ({
        shareProjectProvider: resolveRepositoryState(
          value,
          state.shareProjectProvider,
        ),
      })),
    setShareExistingRemotes: (value) =>
      set((state) => ({
        shareExistingRemotes: resolveRepositoryState(
          value,
          state.shareExistingRemotes,
        ),
      })),
    setNotifications: (value) =>
      set((state) => ({
        notifications: resolveRepositoryState(value, state.notifications),
      })),
    setBalloonId: (value) =>
      set((state) => ({
        balloonId: resolveRepositoryState(value, state.balloonId),
      })),
    setUiStateRestored: (value) =>
      set((state) => ({
        uiStateRestored: resolveRepositoryState(value, state.uiStateRestored),
      })),
    setEditorStatus: (value) =>
      set((state) => ({
        editorStatus: resolveRepositoryState(value, state.editorStatus),
      })),
  })) satisfies RepositoryWorkspaceSliceCreator<LayoutSlice>;
