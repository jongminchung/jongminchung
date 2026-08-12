import { useEffect, useRef, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import { terminalService } from "../../../application/terminal/activeTerminalService";
import { listenWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import { useAppDialog } from "../../../components/AppDialog";
import type { GitActivity } from "../../../domain/gitActivity";
import type { ProductSettings } from "../../../domain/productSettings";
import type { RepositoryView } from "../../../domain/types";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";
import type { EditorStatus } from "../state/workspaceTypes";
import { useRepositoryToolWindowController } from "./useRepositoryToolWindowController";

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

export function useRepositoryToolWindowState({
    activity,
    productSettings,
    repository,
}: {
    readonly activity: GitActivity | null;
    readonly productSettings: ProductSettings;
    readonly repository: RepositoryView;
}) {
    const state = useRepositoryWorkspaceStore(
        useShallow((workspace) => ({
            bottomCollapsed: workspace.bottomCollapsed,
            projectOpen: workspace.projectOpen,
            bookmarksOpen: workspace.bookmarksOpen,
            logOpen: workspace.logOpen,
            logTabIds: workspace.logTabIds,
            activeLogTabId: workspace.activeLogTabId,
            logIndexing: workspace.logIndexing,
            logIndexingEnabled: workspace.logIndexingEnabled,
            bottomPanelHeight: workspace.bottomPanelHeight,
            sideToolWindowWidth: workspace.sideToolWindowWidth,
            bottomPanelTab: workspace.bottomPanelTab,
            changesNavigatorWidth: workspace.changesNavigatorWidth,
            historyReviewWidth: workspace.historyReviewWidth,
            commitRailWidth: workspace.commitRailWidth,
            toast: workspace.toast,
            notificationOpen: workspace.notificationOpen,
            processesOpen: workspace.processesOpen,
            activeToolWindow: workspace.activeToolWindow,
            maximizedToolWindow: workspace.maximizedToolWindow,
            shareProjectProvider: workspace.shareProjectProvider,
            shareExistingRemotes: workspace.shareExistingRemotes,
            notifications: workspace.notifications,
            balloonId: workspace.balloonId,
            editorStatus: workspace.editorStatus,
            setBottomCollapsed: workspace.setBottomCollapsed,
            setProjectOpen: workspace.setProjectOpen,
            setBookmarksOpen: workspace.setBookmarksOpen,
            setLogOpen: workspace.setLogOpen,
            setLogTabIds: workspace.setLogTabIds,
            setActiveLogTabId: workspace.setActiveLogTabId,
            setLogIndexing: workspace.setLogIndexing,
            setLogIndexingEnabled: workspace.setLogIndexingEnabled,
            setBottomPanelHeight: workspace.setBottomPanelHeight,
            setSideToolWindowWidth: workspace.setSideToolWindowWidth,
            setBottomPanelTab: workspace.setBottomPanelTab,
            setChangesNavigatorWidth: workspace.setChangesNavigatorWidth,
            setHistoryReviewWidth: workspace.setHistoryReviewWidth,
            setCommitRailWidth: workspace.setCommitRailWidth,
            setToast: workspace.setToast,
            setNotificationOpen: workspace.setNotificationOpen,
            setProcessesOpen: workspace.setProcessesOpen,
            setActiveToolWindow: workspace.setActiveToolWindow,
            setMaximizedToolWindow: workspace.setMaximizedToolWindow,
            setShareProjectProvider: workspace.setShareProjectProvider,
            setShareExistingRemotes: workspace.setShareExistingRemotes,
            setNotifications: workspace.setNotifications,
            setBalloonId: workspace.setBalloonId,
            setEditorStatus: workspace.setEditorStatus,
        })),
    );
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
    const { jumpToLastToolWindow } = useRepositoryToolWindowController(state);
    const { setEditorStatus, setProcessesOpen } = state;

    useEffect(() => {
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
    }, [activity, productSettings.processWindowAutoShow, setProcessesOpen]);
    useEffect(
        () =>
            listenWorkbenchEvent("git-client:editor-status", (detail) => {
                setEditorStatus(isEditorStatus(detail) ? detail : undefined);
            }),
        [setEditorStatus],
    );

    return { ...state, dialog, jumpToLastToolWindow, terminalTabCount };
}

export type RepositoryToolWindowState = ReturnType<
    typeof useRepositoryToolWindowState
>;
