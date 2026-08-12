import { useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { GitSessionCapabilities } from "../../../application/git-session/ports/GitSessionCapabilities";
import { listenWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import { runInBackground } from "../../../domain/toVoidHandler";
import type { RepositoryView } from "../../../domain/types";
import {
    hydrateScratchFiles,
    persistScratchFiles,
} from "../state/repositoryWorkspacePersistence";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";
import { inspectorKey, type InspectorState } from "../state/workspaceTypes";

interface RepositoryEditorControllerOptions {
    readonly repository: RepositoryView;
    readonly loadFiles: GitSessionCapabilities["queries"]["loadFiles"];
    readonly onDirtyEditorCountChange: (count: number) => void;
}

export function useRepositoryEditorController({
    repository,
    loadFiles,
    onDirtyEditorCountChange,
}: RepositoryEditorControllerOptions) {
    const editorTools = useRepositoryWorkspaceStore(
        useShallow((state) => ({
            inspectorTabs: state.inspectorTabs,
            recentInspectors: state.recentInspectors,
            navigationIndex: state.navigationIndex,
            projectFiles: state.projectFiles,
            fileInventoryRefreshToken: state.fileInventoryRefreshToken,
            projectSearchSurface: state.projectSearchSurface,
            projectSearchInitialQuery: state.projectSearchInitialQuery,
            scratchFiles: state.scratchFiles,
            scratchFilesRestored: state.scratchFilesRestored,
            scratchFileChooserOpen: state.scratchFileChooserOpen,
            exportToHtmlOpen: state.exportToHtmlOpen,
            replaceInFilesOpen: state.replaceInFilesOpen,
            findResults: state.findResults,
            recentFindUsages: state.recentFindUsages,
            recentFindUsagesOpen: state.recentFindUsagesOpen,
            codeAnalysisRequest: state.codeAnalysisRequest,
            runInspectionOpen: state.runInspectionOpen,
            stackTraceOpen: state.stackTraceOpen,
            vcsOperationsOpen: state.vcsOperationsOpen,
            inspectionResults: state.inspectionResults,
            activeInspectorKey: state.activeInspectorKey,
            previewInspectorKey: state.previewInspectorKey,
            pinnedInspectorKeys: state.pinnedInspectorKeys,
            dirtyInspectorKeys: state.dirtyInspectorKeys,
            bookmarks: state.bookmarks,
            bookmarksPopupMode: state.bookmarksPopupMode,
            bookmarkMnemonicTarget: state.bookmarkMnemonicTarget,
            bookmarkGroupTarget: state.bookmarkGroupTarget,
            setInspectorTabs: state.setInspectorTabs,
            setRecentInspectors: state.setRecentInspectors,
            setNavigationIndex: state.setNavigationIndex,
            setProjectFiles: state.setProjectFiles,
            setFileInventoryRefreshToken: state.setFileInventoryRefreshToken,
            setProjectSearchSurface: state.setProjectSearchSurface,
            setProjectSearchInitialQuery: state.setProjectSearchInitialQuery,
            setScratchFiles: state.setScratchFiles,
            setScratchFilesRestored: state.setScratchFilesRestored,
            setScratchFileChooserOpen: state.setScratchFileChooserOpen,
            setExportToHtmlOpen: state.setExportToHtmlOpen,
            setReplaceInFilesOpen: state.setReplaceInFilesOpen,
            setFindResults: state.setFindResults,
            setRecentFindUsages: state.setRecentFindUsages,
            setRecentFindUsagesOpen: state.setRecentFindUsagesOpen,
            setCodeAnalysisRequest: state.setCodeAnalysisRequest,
            setRunInspectionOpen: state.setRunInspectionOpen,
            setStackTraceOpen: state.setStackTraceOpen,
            setVcsOperationsOpen: state.setVcsOperationsOpen,
            setInspectionResults: state.setInspectionResults,
            setActiveInspectorKey: state.setActiveInspectorKey,
            setPreviewInspectorKey: state.setPreviewInspectorKey,
            setPinnedInspectorKeys: state.setPinnedInspectorKeys,
            setDirtyInspectorKeys: state.setDirtyInspectorKeys,
            setBookmarks: state.setBookmarks,
            setBookmarksPopupMode: state.setBookmarksPopupMode,
            setBookmarkMnemonicTarget: state.setBookmarkMnemonicTarget,
            setBookmarkGroupTarget: state.setBookmarkGroupTarget,
        })),
    );
    const {
        activeInspectorKey,
        dirtyInspectorKeys,
        fileInventoryRefreshToken,
        inspectorTabs,
        navigationIndex,
        pinnedInspectorKeys,
        previewInspectorKey,
        scratchFiles,
        scratchFilesRestored,
        setActiveInspectorKey,
        setDirtyInspectorKeys,
        setFileInventoryRefreshToken,
        setInspectorTabs,
        setNavigationIndex,
        setPinnedInspectorKeys,
        setPreviewInspectorKey,
        setProjectFiles,
        setRecentInspectors,
        setScratchFiles,
        setScratchFilesRestored,
    } = editorTools;
    const navigationHistory = useRef<readonly InspectorState[]>([]);
    const navigationInProgress = useRef(false);

    useEffect(() => {
        onDirtyEditorCountChange(dirtyInspectorKeys.size);
    }, [dirtyInspectorKeys.size, onDirtyEditorCountChange]);

    useEffect(
        () => () => onDirtyEditorCountChange(0),
        [onDirtyEditorCountChange],
    );

    const inspector = useMemo(
        () =>
            inspectorTabs.find(
                (candidate) => inspectorKey(candidate) === activeInspectorKey,
            ),
        [activeInspectorKey, inspectorTabs],
    );
    const fileInventoryKey = useMemo(
        () =>
            repository.status.changes
                .map(
                    (change) =>
                        `${change.status}:${change.oldPath ?? ""}:${change.path}`,
                )
                .sort()
                .join("\0"),
        [repository.status.changes],
    );

    useEffect(() => {
        let active = true;
        setProjectFiles([]);
        void loadFiles().then(
            (files) => {
                if (active) setProjectFiles(files);
            },
            () => {
                if (active) setProjectFiles([]);
            },
        );
        return () => {
            active = false;
        };
    }, [
        fileInventoryKey,
        fileInventoryRefreshToken,
        loadFiles,
        repository.snapshot.id,
        setProjectFiles,
    ]);

    useEffect(() => {
        let active = true;
        void hydrateScratchFiles()
            .then((value) => {
                if (active) setScratchFiles(value);
            })
            .catch(() => undefined)
            .finally(() => {
                if (active) setScratchFilesRestored(true);
            });
        return () => {
            active = false;
        };
    }, [setScratchFiles, setScratchFilesRestored]);

    useEffect(() => {
        if (!scratchFilesRestored) return;
        runInBackground(
            persistScratchFiles(scratchFiles),
            "Scratch file persistence",
        );
    }, [scratchFiles, scratchFilesRestored]);

    useEffect(() => {
        return listenWorkbenchEvent("git-client:repair-indexes", () =>
            setFileInventoryRefreshToken((value) => value + 1),
        );
    }, [setFileInventoryRefreshToken]);

    const openInspector = useCallback(
        (next: InspectorState, keepOpen = true): void => {
            const key = inspectorKey(next);
            if (next.path) {
                setRecentInspectors((current) =>
                    [
                        next,
                        ...current.filter(
                            (candidate) => inspectorKey(candidate) !== key,
                        ),
                    ].slice(0, 50),
                );
                if (!navigationInProgress.current) {
                    setNavigationIndex((currentIndex) => {
                        const current = navigationHistory.current.slice(
                            0,
                            currentIndex + 1,
                        );
                        const last = current.at(-1);
                        if (!last || inspectorKey(last) !== key)
                            current.push(next);
                        else current[current.length - 1] = next;
                        navigationHistory.current = current.slice(-100);
                        return navigationHistory.current.length - 1;
                    });
                }
            }
            setInspectorTabs((current) => {
                const existing = current.findIndex(
                    (candidate) => inspectorKey(candidate) === key,
                );
                if (existing >= 0) {
                    return current.map((candidate, index) =>
                        index === existing ? next : candidate,
                    );
                }
                if (
                    !keepOpen &&
                    previewInspectorKey &&
                    !dirtyInspectorKeys.has(previewInspectorKey) &&
                    !pinnedInspectorKeys.has(previewInspectorKey)
                ) {
                    const previewIndex = current.findIndex(
                        (candidate) =>
                            inspectorKey(candidate) === previewInspectorKey,
                    );
                    if (previewIndex >= 0) {
                        return current.map((candidate, index) =>
                            index === previewIndex ? next : candidate,
                        );
                    }
                }
                return [...current, next];
            });
            if (keepOpen) {
                setPreviewInspectorKey((current) =>
                    current === key ? undefined : current,
                );
            } else {
                setPreviewInspectorKey(key);
            }
            setActiveInspectorKey(key);
        },
        [
            dirtyInspectorKeys,
            pinnedInspectorKeys,
            previewInspectorKey,
            setActiveInspectorKey,
            setInspectorTabs,
            setNavigationIndex,
            setPreviewInspectorKey,
            setRecentInspectors,
        ],
    );

    const navigateInspectorHistory = useCallback(
        (offset: -1 | 1): void => {
            const nextIndex = navigationIndex + offset;
            const next = navigationHistory.current[nextIndex];
            if (!next) return;
            navigationInProgress.current = true;
            openInspector(next);
            navigationInProgress.current = false;
            setNavigationIndex(nextIndex);
        },
        [navigationIndex, openInspector, setNavigationIndex],
    );

    const closeInspectors = useCallback(
        (keys: readonly string[]): void => {
            const closing = new Set(keys);
            if (closing.size === 0) return;
            const activeIndex = inspectorTabs.findIndex(
                (candidate) => inspectorKey(candidate) === activeInspectorKey,
            );
            const next = inspectorTabs.filter(
                (candidate) => !closing.has(inspectorKey(candidate)),
            );
            const replacement =
                next[Math.min(Math.max(activeIndex, 0), next.length - 1)] ??
                next.at(-1);
            setInspectorTabs(next);
            setDirtyInspectorKeys((current) => {
                const updated = new Set(current);
                for (const key of closing) updated.delete(key);
                return updated;
            });
            setPinnedInspectorKeys((current) => {
                const updated = new Set(current);
                for (const key of closing) updated.delete(key);
                return updated;
            });
            setPreviewInspectorKey((current) =>
                current && closing.has(current) ? undefined : current,
            );
            setActiveInspectorKey((current) =>
                current && closing.has(current)
                    ? replacement
                        ? inspectorKey(replacement)
                        : undefined
                    : current,
            );
        },
        [
            activeInspectorKey,
            inspectorTabs,
            setActiveInspectorKey,
            setDirtyInspectorKeys,
            setInspectorTabs,
            setPinnedInspectorKeys,
            setPreviewInspectorKey,
        ],
    );

    return {
        ...editorTools,
        closeInspectors,
        inspector,
        navigationHistory,
        navigateInspectorHistory,
        openInspector,
    };
}
