import { dispatchWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import {
    COMMAND_ENABLED,
    commandDefinition,
    commandDisabled,
    type CommandDefinition,
} from "../../../domain/commands";
import {
    MAX_BOTTOM_PANEL_HEIGHT,
    MAX_SIDE_TOOL_WINDOW_WIDTH,
    MIN_BOTTOM_PANEL_HEIGHT,
    MIN_SIDE_TOOL_WINDOW_WIDTH,
} from "../../../domain/workspacePersistence";
const TOOL_WINDOW_RESIZE_STEP = 24;

export interface AppearanceLayoutCommandPort {
    readonly activeToolWindow:
        | import("../state/workspaceTypes").RepositoryToolWindow
        | null;
    readonly balloonId: string | undefined;
    readonly bookmarksOpen: boolean;
    readonly bottomPanelTab: import("../../../domain/workspacePersistence").WorkspaceBottomPanelTab;
    readonly jumpToLastToolWindow: () => void;
    readonly logOpen: boolean;
    readonly logTabIds: readonly string[];
    readonly notificationOpen: boolean;
    readonly notifications: readonly import("../../../components/NotificationToolWindow").ProductNotification[];
    readonly openGitLogTab: () => void;
    readonly processesOpen: boolean;
    readonly projectOpen: boolean;
    readonly repositoryAvailability: () => ReturnType<
        CommandDefinition["availability"]
    >;
    readonly repositoryViewMode: import("../../../domain/changeReview").RepositoryViewMode;
    readonly setActiveInspectorKey: (
        value: import("react").SetStateAction<string | undefined>,
    ) => void;
    readonly setActiveLogTabId: (
        value: import("react").SetStateAction<string>,
    ) => void;
    readonly setActiveToolWindow: (
        value: import("react").SetStateAction<
            import("../state/workspaceTypes").RepositoryToolWindow | null
        >,
    ) => void;
    readonly setBalloonId: (
        value: import("react").SetStateAction<string | undefined>,
    ) => void;
    readonly setBookmarksOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setBottomCollapsed: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setBottomPanelHeight: (
        value: import("react").SetStateAction<number>,
    ) => void;
    readonly setBottomPanelTab: (
        value: import("react").SetStateAction<
            import("../../../domain/workspacePersistence").WorkspaceBottomPanelTab
        >,
    ) => void;
    readonly setLogOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setLogTabIds: (
        value: import("react").SetStateAction<readonly string[]>,
    ) => void;
    readonly setMaximizedToolWindow: (
        value: import("react").SetStateAction<
            import("../state/workspaceTypes").RepositoryToolWindow | null
        >,
    ) => void;
    readonly setNotificationOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setNotifications: (
        value: import("react").SetStateAction<
            readonly import("../../../components/NotificationToolWindow").ProductNotification[]
        >,
    ) => void;
    readonly setProcessesOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setProjectOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setRepositoryViewMode: (
        value: import("react").SetStateAction<
            import("../../../domain/changeReview").RepositoryViewMode
        >,
    ) => void;
    readonly setSideToolWindowWidth: (
        value: import("react").SetStateAction<number>,
    ) => void;
    readonly terminalTabCount: number;
}

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
                activeToolWindow !== null
                    ? COMMAND_ENABLED
                    : commandDisabled("Focus a tool window first."),
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
                activeToolWindow === "project" ||
                activeToolWindow === "bookmarks"
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
                activeToolWindow !== null
                    ? COMMAND_ENABLED
                    : commandDisabled("Focus a tool window first."),
        ),
        commandDefinition(
            "window.maximizeToolWindow",
            () =>
                setMaximizedToolWindow((current) =>
                    current === activeToolWindow ? null : activeToolWindow,
                ),
            () =>
                activeToolWindow !== null
                    ? COMMAND_ENABLED
                    : commandDisabled("Focus a tool window first."),
        ),
        commandDefinition(
            "window.closeActiveToolWindowTab",
            () => {
                if (
                    activeToolWindow === "bottom" &&
                    bottomPanelTab === "terminal" &&
                    terminalTabCount > 0
                ) {
                    dispatchWorkbenchEvent(
                        "git-client:terminal-tab-close",
                        undefined,
                    );
                    return;
                }
                if (activeToolWindow === "project") setProjectOpen(false);
                if (activeToolWindow === "bookmarks") setBookmarksOpen(false);
                if (activeToolWindow === "bottom") setBottomCollapsed(true);
                setMaximizedToolWindow(null);
                setActiveToolWindow(null);
            },
            () =>
                activeToolWindow !== null
                    ? COMMAND_ENABLED
                    : commandDisabled("Focus a tool window first."),
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
                    Math.max(
                        MIN_SIDE_TOOL_WINDOW_WIDTH,
                        current - TOOL_WINDOW_RESIZE_STEP,
                    ),
                ),
            () =>
                activeToolWindow === "project" ||
                activeToolWindow === "bookmarks"
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Focus a left or right tool window first.",
                      ),
        ),
        commandDefinition(
            "window.resizeToolWindowRight",
            () =>
                setSideToolWindowWidth((current) =>
                    Math.min(
                        MAX_SIDE_TOOL_WINDOW_WIDTH,
                        current + TOOL_WINDOW_RESIZE_STEP,
                    ),
                ),
            () =>
                activeToolWindow === "project" ||
                activeToolWindow === "bookmarks"
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Focus a left or right tool window first.",
                      ),
        ),
        commandDefinition(
            "window.resizeToolWindowUp",
            () =>
                setBottomPanelHeight((current) =>
                    Math.min(
                        MAX_BOTTOM_PANEL_HEIGHT,
                        current + TOOL_WINDOW_RESIZE_STEP,
                    ),
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
                    Math.max(
                        MIN_BOTTOM_PANEL_HEIGHT,
                        current - TOOL_WINDOW_RESIZE_STEP,
                    ),
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
                notifications.length > 0
                    ? COMMAND_ENABLED
                    : commandDisabled("There are no notifications."),
        ),
        commandDefinition(
            "window.closeAllNotifications",
            () => {
                setNotifications([]);
                setBalloonId(undefined);
                setNotificationOpen(false);
            },
            () =>
                notifications.length > 0
                    ? COMMAND_ENABLED
                    : commandDisabled("There are no notifications."),
        ),
        commandDefinition("view.toggleBottom", () =>
            setBottomCollapsed((current) => !current),
        ),
        {
            ...commandDefinition("view.notifications", () =>
                setNotificationOpen((current) => !current),
            ),
            checked: () => notificationOpen,
        },
        commandDefinition("view.gitConsole", () => {
            setBottomCollapsed(false);
            window.requestAnimationFrame(() =>
                dispatchWorkbenchEvent(
                    "git-client:open-git-console",
                    undefined,
                ),
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
                    dispatchWorkbenchEvent(
                        "git-client:open-terminal",
                        undefined,
                    ),
                );
            },
            repositoryAvailability,
        ),
        commandDefinition(
            "window.jumpLastToolWindow",
            jumpToLastToolWindow,
            repositoryAvailability,
        ),
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
