import { useCallback, useEffect, useRef } from "react";
import { parseToolWindowLayout, type ToolWindowLayout } from "../../domain/toolWindowLayouts";
import type { LayoutSlice } from "../state/repositoryWorkspaceStore";

interface ToolWindowLayoutCaptureDetail {
  readonly accept: (layout: ToolWindowLayout) => void;
}

type ToolWindowControllerPort = Pick<
  LayoutSlice,
  | "bookmarksOpen"
  | "bottomCollapsed"
  | "bottomPanelHeight"
  | "bottomPanelTab"
  | "changesNavigatorWidth"
  | "commitRailWidth"
  | "historyReviewWidth"
  | "logOpen"
  | "maximizedToolWindow"
  | "projectOpen"
  | "setActiveToolWindow"
  | "setBookmarksOpen"
  | "setBottomCollapsed"
  | "setBottomPanelHeight"
  | "setBottomPanelTab"
  | "setChangesNavigatorWidth"
  | "setCommitRailWidth"
  | "setHistoryReviewWidth"
  | "setLogOpen"
  | "setMaximizedToolWindow"
  | "setProcessesOpen"
  | "setProjectOpen"
  | "setSideToolWindowWidth"
  | "sideToolWindowWidth"
>;

export function useRepositoryToolWindowController(port: ToolWindowControllerPort) {
  const {
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
  } = port;

  const lastToolWindow = useRef<"project" | "bookmarks" | "bottom">("project");
  useEffect(() => {
    const updateActiveToolWindow = (event: FocusEvent): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        setActiveToolWindow(null);
        return;
      }
      if (target.closest('[aria-label="Project Tool Window"]')) {
        setActiveToolWindow("project");
      } else if (target.closest('[aria-label="Bookmarks Tool Window"]')) {
        setActiveToolWindow("bookmarks");
      } else if (target.closest('[data-tool-window-position="bottom"]')) {
        setActiveToolWindow("bottom");
      } else {
        setActiveToolWindow(null);
      }
    };
    document.addEventListener("focusin", updateActiveToolWindow);
    return () => {
      document.removeEventListener("focusin", updateActiveToolWindow);
    };
  }, [setActiveToolWindow]);
  useEffect(() => {
    if (projectOpen) lastToolWindow.current = "project";
  }, [projectOpen]);
  useEffect(() => {
    if (bookmarksOpen) lastToolWindow.current = "bookmarks";
  }, [bookmarksOpen]);
  useEffect(() => {
    if (!bottomCollapsed) lastToolWindow.current = "bottom";
  }, [bottomCollapsed]);
  useEffect(() => {
    if (
      (maximizedToolWindow === "project" && !projectOpen) ||
      (maximizedToolWindow === "bookmarks" && !bookmarksOpen) ||
      (maximizedToolWindow === "bottom" && bottomCollapsed)
    ) {
      setMaximizedToolWindow(null);
    }
  }, [bookmarksOpen, bottomCollapsed, maximizedToolWindow, projectOpen, setMaximizedToolWindow]);
  const jumpToLastToolWindow = useCallback((): void => {
    if (lastToolWindow.current === "bookmarks") {
      setProjectOpen(false);
      setBookmarksOpen(true);
      window.requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            '[aria-label="Bookmarks Tool Window"] [aria-label="Bookmarks"]',
          )
          ?.focus(),
      );
      return;
    }
    if (lastToolWindow.current === "bottom") {
      setBottomCollapsed(false);
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-bottom-tab="${bottomPanelTab}"]`)?.focus(),
      );
      return;
    }
    setBookmarksOpen(false);
    setProjectOpen(true);
    window.requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>('[aria-label="Project Tool Window"] [aria-label="Project"]')
        ?.focus(),
    );
  }, [bottomPanelTab, setBookmarksOpen, setProjectOpen, setBottomCollapsed]);
  useEffect(() => {
    const capture = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as ToolWindowLayoutCaptureDetail;
      if (typeof detail?.accept !== "function") return;
      detail.accept({
        bookmarksOpen,
        bottomCollapsed,
        bottomPanelHeight,
        bottomPanelTab,
        changesNavigatorWidth,
        commitRailWidth,
        historyReviewWidth,
        sideToolWindowWidth,
        logOpen,
        projectOpen,
      });
    };
    const apply = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      const layout = parseToolWindowLayout(event.detail?.layout);
      setBookmarksOpen(layout.bookmarksOpen);
      setBottomCollapsed(layout.bottomCollapsed);
      setBottomPanelHeight(layout.bottomPanelHeight);
      setBottomPanelTab(layout.bottomPanelTab);
      setChangesNavigatorWidth(layout.changesNavigatorWidth);
      setCommitRailWidth(layout.commitRailWidth);
      setHistoryReviewWidth(layout.historyReviewWidth);
      setSideToolWindowWidth(layout.sideToolWindowWidth);
      setLogOpen(layout.logOpen);
      setProjectOpen(layout.projectOpen && !layout.bookmarksOpen);
    };
    const showProcesses = (): void => setProcessesOpen(true);
    window.addEventListener("git-client:capture-tool-window-layout", capture);
    window.addEventListener("git-client:apply-tool-window-layout", apply);
    window.addEventListener("git-client:show-processes", showProcesses);
    return () => {
      window.removeEventListener("git-client:capture-tool-window-layout", capture);
      window.removeEventListener("git-client:apply-tool-window-layout", apply);
      window.removeEventListener("git-client:show-processes", showProcesses);
    };
  }, [
    bookmarksOpen,
    bottomCollapsed,
    bottomPanelHeight,
    bottomPanelTab,
    changesNavigatorWidth,
    commitRailWidth,
    historyReviewWidth,
    sideToolWindowWidth,
    logOpen,
    projectOpen,
    setSideToolWindowWidth,
    setProjectOpen,
    setCommitRailWidth,
    setLogOpen,
    setHistoryReviewWidth,
    setProcessesOpen,
    setBottomPanelTab,
    setBottomCollapsed,
    setBookmarksOpen,
    setChangesNavigatorWidth,
    setBottomPanelHeight,
  ]);

  return { jumpToLastToolWindow };
}
