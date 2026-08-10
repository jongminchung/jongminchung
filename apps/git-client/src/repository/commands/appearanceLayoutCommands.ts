import {
  COMMAND_ENABLED,
  commandDefinition,
  commandDisabled,
  type CommandDefinition,
} from "../../domain/commands";
import {
  MAX_BOTTOM_PANEL_HEIGHT,
  MAX_SIDE_TOOL_WINDOW_WIDTH,
  MIN_BOTTOM_PANEL_HEIGHT,
  MIN_SIDE_TOOL_WINDOW_WIDTH,
} from "../../domain/workspacePersistence";
import type { RepositoryCommandContext } from "./repositoryCommandTypes";

const TOOL_WINDOW_RESIZE_STEP = 24;

export type AppearanceLayoutCommandPort = Pick<
  RepositoryCommandContext,
  | "activeToolWindow"
  | "balloonId"
  | "bookmarksOpen"
  | "bottomPanelTab"
  | "jumpToLastToolWindow"
  | "logOpen"
  | "logTabIds"
  | "notificationOpen"
  | "notifications"
  | "openGitLogTab"
  | "processesOpen"
  | "projectOpen"
  | "repositoryAvailability"
  | "repositoryViewMode"
  | "setActiveInspectorKey"
  | "setActiveLogTabId"
  | "setActiveToolWindow"
  | "setBalloonId"
  | "setBookmarksOpen"
  | "setBottomCollapsed"
  | "setBottomPanelHeight"
  | "setBottomPanelTab"
  | "setLogOpen"
  | "setLogTabIds"
  | "setMaximizedToolWindow"
  | "setNotificationOpen"
  | "setNotifications"
  | "setProcessesOpen"
  | "setProjectOpen"
  | "setRepositoryViewMode"
  | "setSideToolWindowWidth"
  | "terminalTabCount"
>;

export function createAppearanceLayoutCommands(
  context: AppearanceLayoutCommandPort,
): readonly CommandDefinition[] {
  const {
    activeToolWindow,
    balloonId,
    bookmarksOpen,
    bottomPanelTab,
    jumpToLastToolWindow,
    logOpen,
    logTabIds,
    notificationOpen,
    notifications,
    openGitLogTab,
    processesOpen,
    projectOpen,
    repositoryAvailability,
    repositoryViewMode,
    setActiveInspectorKey,
    setActiveLogTabId,
    setActiveToolWindow,
    setBalloonId,
    setBookmarksOpen,
    setBottomCollapsed,
    setBottomPanelHeight,
    setBottomPanelTab,
    setLogOpen,
    setLogTabIds,
    setMaximizedToolWindow,
    setNotificationOpen,
    setNotifications,
    setProcessesOpen,
    setProjectOpen,
    setRepositoryViewMode,
    setSideToolWindowWidth,
    terminalTabCount,
  } = context;
  return [
    {
      ...commandDefinition("view.project", () => {
        setRepositoryViewMode("history");
        setBookmarksOpen(false);
        setProjectOpen((current) => bookmarksOpen || !current);
      }),
      checked: () => projectOpen && repositoryViewMode === "history",
    },
    {
      ...commandDefinition("view.bookmarks", () => {
        setRepositoryViewMode("history");
        setProjectOpen(false);
        setBookmarksOpen((current) => !current);
      }),
      checked: () => bookmarksOpen && repositoryViewMode === "history",
    },
    {
      ...commandDefinition("view.history", () => {
        if (logTabIds.length === 0) setLogTabIds(["log-1"]);
        setLogOpen(true);
        setActiveLogTabId(logTabIds[0] ?? "log-1");
        setActiveInspectorKey(undefined);
        setRepositoryViewMode("history");
      }),
      checked: () => logOpen && repositoryViewMode === "history",
    },
    commandDefinition("view.openGitLogTab", openGitLogTab),
    {
      ...commandDefinition("view.changes", () => {
        setProjectOpen(false);
        setBookmarksOpen(false);
        setRepositoryViewMode("changes");
      }),
      checked: () => repositoryViewMode === "changes",
    },
    commandDefinition(
      "window.hideActiveToolWindow",
      () => {
        if (activeToolWindow === "project") setProjectOpen(false);
        if (activeToolWindow === "bookmarks") setBookmarksOpen(false);
        if (activeToolWindow === "bottom") setBottomCollapsed(true);
        setMaximizedToolWindow(null);
        setActiveToolWindow(null);
      },
      () =>
        activeToolWindow !== null ? COMMAND_ENABLED : commandDisabled("Focus a tool window first."),
    ),
    commandDefinition(
      "window.hideSideToolWindows",
      () => {
        setProjectOpen(false);
        setBookmarksOpen(false);
        setMaximizedToolWindow(null);
        setActiveToolWindow(null);
      },
      () =>
        activeToolWindow === "project" || activeToolWindow === "bookmarks"
          ? COMMAND_ENABLED
          : commandDisabled("Focus a side tool window first."),
    ),
    commandDefinition(
      "window.hideBottomToolWindows",
      () => {
        setBottomCollapsed(true);
        setMaximizedToolWindow(null);
        setActiveToolWindow(null);
      },
      () =>
        activeToolWindow === "bottom"
          ? COMMAND_ENABLED
          : commandDisabled("Focus a bottom tool window first."),
    ),
    commandDefinition(
      "window.hideAllToolWindows",
      () => {
        setProjectOpen(false);
        setBookmarksOpen(false);
        setBottomCollapsed(true);
        setMaximizedToolWindow(null);
        setActiveToolWindow(null);
      },
      () =>
        activeToolWindow !== null ? COMMAND_ENABLED : commandDisabled("Focus a tool window first."),
    ),
    commandDefinition(
      "window.maximizeToolWindow",
      () =>
        setMaximizedToolWindow((current) =>
          current === activeToolWindow ? null : activeToolWindow,
        ),
      () =>
        activeToolWindow !== null ? COMMAND_ENABLED : commandDisabled("Focus a tool window first."),
    ),
    commandDefinition(
      "window.closeActiveToolWindowTab",
      () => {
        if (
          activeToolWindow === "bottom" &&
          bottomPanelTab === "terminal" &&
          terminalTabCount > 0
        ) {
          window.dispatchEvent(new CustomEvent("git-client:terminal-tab-close"));
          return;
        }
        if (activeToolWindow === "project") setProjectOpen(false);
        if (activeToolWindow === "bookmarks") setBookmarksOpen(false);
        if (activeToolWindow === "bottom") setBottomCollapsed(true);
        setMaximizedToolWindow(null);
        setActiveToolWindow(null);
      },
      () =>
        activeToolWindow !== null ? COMMAND_ENABLED : commandDisabled("Focus a tool window first."),
    ),
    commandDefinition(
      "window.resizeToolWindowGroup",
      () => undefined,
      () =>
        activeToolWindow !== null
          ? COMMAND_ENABLED
          : commandDisabled("Focus a docked tool window first."),
    ),
    commandDefinition(
      "window.resizeToolWindowLeft",
      () =>
        setSideToolWindowWidth((current) =>
          Math.max(MIN_SIDE_TOOL_WINDOW_WIDTH, current - TOOL_WINDOW_RESIZE_STEP),
        ),
      () =>
        activeToolWindow === "project" || activeToolWindow === "bookmarks"
          ? COMMAND_ENABLED
          : commandDisabled("Focus a left or right tool window first."),
    ),
    commandDefinition(
      "window.resizeToolWindowRight",
      () =>
        setSideToolWindowWidth((current) =>
          Math.min(MAX_SIDE_TOOL_WINDOW_WIDTH, current + TOOL_WINDOW_RESIZE_STEP),
        ),
      () =>
        activeToolWindow === "project" || activeToolWindow === "bookmarks"
          ? COMMAND_ENABLED
          : commandDisabled("Focus a left or right tool window first."),
    ),
    commandDefinition(
      "window.resizeToolWindowUp",
      () =>
        setBottomPanelHeight((current) =>
          Math.min(MAX_BOTTOM_PANEL_HEIGHT, current + TOOL_WINDOW_RESIZE_STEP),
        ),
      () =>
        activeToolWindow === "bottom"
          ? COMMAND_ENABLED
          : commandDisabled("Focus a bottom tool window first."),
    ),
    commandDefinition(
      "window.resizeToolWindowDown",
      () =>
        setBottomPanelHeight((current) =>
          Math.max(MIN_BOTTOM_PANEL_HEIGHT, current - TOOL_WINDOW_RESIZE_STEP),
        ),
      () =>
        activeToolWindow === "bottom"
          ? COMMAND_ENABLED
          : commandDisabled("Focus a bottom tool window first."),
    ),
    commandDefinition(
      "window.closeFirstNotification",
      () => {
        const first = notifications[0];
        if (!first) return;
        setNotifications((current) => current.slice(1));
        if (balloonId === first.id) setBalloonId(undefined);
      },
      () =>
        notifications.length > 0 ? COMMAND_ENABLED : commandDisabled("There are no notifications."),
    ),
    commandDefinition(
      "window.closeAllNotifications",
      () => {
        setNotifications([]);
        setBalloonId(undefined);
        setNotificationOpen(false);
      },
      () =>
        notifications.length > 0 ? COMMAND_ENABLED : commandDisabled("There are no notifications."),
    ),
    commandDefinition("view.toggleBottom", () => setBottomCollapsed((current) => !current)),
    {
      ...commandDefinition("view.notifications", () => setNotificationOpen((current) => !current)),
      checked: () => notificationOpen,
    },
    commandDefinition("view.gitConsole", () => {
      setBottomCollapsed(false);
      window.requestAnimationFrame(() =>
        window.dispatchEvent(new CustomEvent("git-client:open-git-console")),
      );
    }),
    commandDefinition("view.findToolWindow", () => {
      setBottomPanelTab("find");
      setBottomCollapsed(false);
    }),
    commandDefinition(
      "view.terminal",
      () => {
        setBottomCollapsed(false);
        window.requestAnimationFrame(() =>
          window.dispatchEvent(new CustomEvent("git-client:open-terminal")),
        );
      },
      repositoryAvailability,
    ),
    commandDefinition("window.jumpLastToolWindow", jumpToLastToolWindow, repositoryAvailability),
    {
      ...commandDefinition(
        "window.showProcesses",
        () => setProcessesOpen((open) => !open),
        repositoryAvailability,
      ),
      checked: () => processesOpen,
    },
  ];
}
