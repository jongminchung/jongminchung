import { useEffect, type MutableRefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import { isElectronRuntime } from "../../../application/desktop/DesktopPort";
import { parseProjectBookmarks } from "../../../domain/bookmarks";
import {
    hydrateRepositoryBookmarks,
    hydrateRepositoryUiState,
    persistRepositoryBookmarks,
    persistRepositoryUiState,
} from "../state/repositoryWorkspacePersistence";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";

export function useRepositoryPersistence({
    nextLogTabNumber,
    repositoryId,
    repositoryName,
}: {
    readonly nextLogTabNumber: MutableRefObject<number>;
    readonly repositoryId: string;
    readonly repositoryName: string;
}): void {
    const state = useRepositoryWorkspaceStore(
        useShallow((store) => ({
            activeLogTabId: store.activeLogTabId,
            bookmarks: store.bookmarks,
            bookmarksOpen: store.bookmarksOpen,
            bookmarksRestored: store.bookmarksRestored,
            bottomCollapsed: store.bottomCollapsed,
            bottomPanelHeight: store.bottomPanelHeight,
            bottomPanelTab: store.bottomPanelTab,
            changeSelection: store.changeSelection,
            changesNavigatorWidth: store.changesNavigatorWidth,
            commitDraft: store.commitDraft,
            commitRailWidth: store.commitRailWidth,
            diffPreferences: store.diffPreferences,
            historyReviewWidth: store.historyReviewWidth,
            historySelectedPath: store.historySelectedPath,
            logOpen: store.logOpen,
            logTabIds: store.logTabIds,
            projectOpen: store.projectOpen,
            repositoryViewMode: store.repositoryViewMode,
            selectedOids: store.selectedOids,
            selectedRef: store.selectedRef,
            sideToolWindowWidth: store.sideToolWindowWidth,
            uiStateRestored: store.uiStateRestored,
            setActiveLogTabId: store.setActiveLogTabId,
            setBookmarks: store.setBookmarks,
            setBookmarksOpen: store.setBookmarksOpen,
            setBookmarksRestored: store.setBookmarksRestored,
            setBottomCollapsed: store.setBottomCollapsed,
            setBottomPanelHeight: store.setBottomPanelHeight,
            setBottomPanelTab: store.setBottomPanelTab,
            setChangeSelection: store.setChangeSelection,
            setChangesNavigatorWidth: store.setChangesNavigatorWidth,
            setCommitDraft: store.setCommitDraft,
            setCommitRailWidth: store.setCommitRailWidth,
            setDiffPreferences: store.setDiffPreferences,
            setHistoryReviewWidth: store.setHistoryReviewWidth,
            setHistorySelectedPath: store.setHistorySelectedPath,
            setLogOpen: store.setLogOpen,
            setLogTabIds: store.setLogTabIds,
            setProjectOpen: store.setProjectOpen,
            setRepositoryViewMode: store.setRepositoryViewMode,
            setSelectedOids: store.setSelectedOids,
            setSelectedRef: store.setSelectedRef,
            setSideToolWindowWidth: store.setSideToolWindowWidth,
            setUiStateRestored: store.setUiStateRestored,
        })),
    );
    const {
        activeLogTabId,
        bookmarks,
        bookmarksOpen,
        bookmarksRestored,
        bottomCollapsed,
        bottomPanelHeight,
        bottomPanelTab,
        changeSelection,
        changesNavigatorWidth,
        commitDraft,
        commitRailWidth,
        diffPreferences,
        historyReviewWidth,
        historySelectedPath,
        logOpen,
        logTabIds,
        projectOpen,
        repositoryViewMode,
        selectedOids,
        selectedRef,
        sideToolWindowWidth,
        uiStateRestored,
        setActiveLogTabId,
        setBookmarks,
        setBookmarksOpen,
        setBookmarksRestored,
        setBottomCollapsed,
        setBottomPanelHeight,
        setBottomPanelTab,
        setChangeSelection,
        setChangesNavigatorWidth,
        setCommitDraft,
        setCommitRailWidth,
        setDiffPreferences,
        setHistoryReviewWidth,
        setHistorySelectedPath,
        setLogOpen,
        setLogTabIds,
        setProjectOpen,
        setRepositoryViewMode,
        setSelectedOids,
        setSelectedRef,
        setSideToolWindowWidth,
        setUiStateRestored,
    } = state;

    useEffect(() => {
        if (!isElectronRuntime()) return;
        let active = true;
        const restore = async (): Promise<void> => {
            try {
                const migrated = await hydrateRepositoryUiState(repositoryId);
                if (!active) return;
                setSelectedOids(migrated.selectedOids);
                setSelectedRef(migrated.selectedRef ?? undefined);
                setBottomCollapsed(migrated.bottomCollapsed);
                setBottomPanelHeight(migrated.bottomPanelHeight);
                setBottomPanelTab(migrated.bottomPanelTab);
                setRepositoryViewMode(migrated.activeView);
                setChangeSelection(migrated.selectedChange);
                setHistorySelectedPath(migrated.historySelectedPath);
                setDiffPreferences(migrated.diffPreferences);
                setCommitDraft(migrated.commitDraft);
                setChangesNavigatorWidth(migrated.changesNavigatorWidth);
                setHistoryReviewWidth(migrated.historyReviewWidth);
                setCommitRailWidth(migrated.commitRailWidth);
                setSideToolWindowWidth(migrated.sideToolWindowWidth);
                setProjectOpen(migrated.projectOpen && !migrated.bookmarksOpen);
                setBookmarksOpen(migrated.bookmarksOpen);
                setLogOpen(migrated.logOpen);
                setLogTabIds(migrated.logTabIds);
                setActiveLogTabId(
                    migrated.activeLogTabId &&
                        migrated.logTabIds.includes(migrated.activeLogTabId)
                        ? migrated.activeLogTabId
                        : (migrated.logTabIds[0] ?? "log-1"),
                );
                nextLogTabNumber.current =
                    Math.max(
                        1,
                        ...migrated.logTabIds.map((tabId) => {
                            const value = Number(tabId.replace(/^log-/, ""));
                            return Number.isFinite(value) ? value : 1;
                        }),
                    ) + 1;
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
    }, [
        nextLogTabNumber,
        repositoryId,
        setDiffPreferences,
        setHistorySelectedPath,
        setSideToolWindowWidth,
        setProjectOpen,
        setCommitRailWidth,
        setActiveLogTabId,
        setSelectedRef,
        setRepositoryViewMode,
        setLogOpen,
        setUiStateRestored,
        setChangeSelection,
        setHistoryReviewWidth,
        setBottomPanelTab,
        setLogTabIds,
        setBottomCollapsed,
        setBookmarksOpen,
        setChangesNavigatorWidth,
        setCommitDraft,
        setBottomPanelHeight,
        setSelectedOids,
    ]);

    useEffect(() => {
        if (!isElectronRuntime() || !uiStateRestored) return;
        const persist = async (): Promise<void> => {
            try {
                await persistRepositoryUiState(repositoryId, {
                    selectedOids: [...selectedOids],
                    selectedRef: selectedRef ?? null,
                    bottomCollapsed,
                    bottomPanelHeight,
                    bottomPanelTab,
                    activeView: repositoryViewMode,
                    selectedChange: changeSelection,
                    historySelectedPath,
                    diffPreferences,
                    commitDraft,
                    changesNavigatorWidth,
                    historyReviewWidth,
                    commitRailWidth,
                    sideToolWindowWidth,
                    projectOpen,
                    bookmarksOpen,
                    logOpen,
                    logTabIds,
                    activeLogTabId,
                });
            } catch (error) {
                console.warn("Could not persist repository UI state", error);
            }
        };
        void persist();
    }, [
        bottomCollapsed,
        bottomPanelHeight,
        bottomPanelTab,
        changeSelection,
        changesNavigatorWidth,
        commitDraft,
        commitRailWidth,
        projectOpen,
        bookmarksOpen,
        logOpen,
        logTabIds,
        activeLogTabId,
        diffPreferences,
        historySelectedPath,
        historyReviewWidth,
        sideToolWindowWidth,
        repositoryId,
        repositoryViewMode,
        selectedOids,
        selectedRef,
        uiStateRestored,
    ]);

    useEffect(() => {
        if (!isElectronRuntime()) {
            setBookmarks(parseProjectBookmarks(null, repositoryName));
            setBookmarksRestored(true);
            return;
        }
        let active = true;
        setBookmarksRestored(false);
        const restore = async (): Promise<void> => {
            try {
                const stored = await hydrateRepositoryBookmarks(
                    repositoryId,
                    repositoryName,
                );
                if (active) {
                    setBookmarks(stored);
                }
            } catch (error) {
                console.warn("Could not restore project bookmarks", error);
                if (active) {
                    setBookmarks(parseProjectBookmarks(null, repositoryName));
                }
            } finally {
                if (active) setBookmarksRestored(true);
            }
        };
        void restore();
        return () => {
            active = false;
        };
    }, [repositoryId, repositoryName, setBookmarks, setBookmarksRestored]);

    useEffect(() => {
        if (!isElectronRuntime() || !bookmarksRestored) return;
        void persistRepositoryBookmarks(repositoryId, bookmarks).catch(
            (error: unknown) => {
                console.warn("Could not persist project bookmarks", error);
            },
        );
    }, [bookmarks, bookmarksRestored, repositoryId]);
}
