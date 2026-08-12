import { parseProjectBookmarks } from "../../../../domain/bookmarks";
import type {
    EditorToolsSlice,
    RepositoryWorkspaceSliceCreator,
    RepositoryWorkspaceStoreOptions,
} from "../repositoryWorkspaceStoreTypes";
import { resolveRepositoryState } from "./stateUpdater";

export const createEditorToolsSlice = (
    options: RepositoryWorkspaceStoreOptions,
): RepositoryWorkspaceSliceCreator<EditorToolsSlice> =>
    ((set) => ({
        inspectorTabs: [],
        recentInspectors: [],
        navigationIndex: -1,
        projectFiles: [],
        fileInventoryRefreshToken: 0,
        projectSearchSurface: undefined,
        projectSearchInitialQuery: "",
        scratchFiles: [],
        scratchFilesRestored: !options.electronRuntime,
        scratchFileChooserOpen: false,
        exportToHtmlOpen: false,
        replaceInFilesOpen: false,
        findResults: null,
        recentFindUsages: [],
        recentFindUsagesOpen: false,
        codeAnalysisRequest: undefined,
        runInspectionOpen: false,
        stackTraceOpen: false,
        vcsOperationsOpen: false,
        inspectionResults: undefined,
        activeInspectorKey: undefined,
        previewInspectorKey: undefined,
        pinnedInspectorKeys: new Set(),
        dirtyInspectorKeys: new Set(),
        bookmarks: parseProjectBookmarks(null, options.repositoryName),
        bookmarksPopupMode: undefined,
        bookmarkMnemonicTarget: undefined,
        bookmarkGroupTarget: undefined,
        bookmarksRestored: !options.electronRuntime,
        setInspectorTabs: (value) =>
            set((state) => ({
                inspectorTabs: resolveRepositoryState(
                    value,
                    state.inspectorTabs,
                ),
            })),
        setRecentInspectors: (value) =>
            set((state) => ({
                recentInspectors: resolveRepositoryState(
                    value,
                    state.recentInspectors,
                ),
            })),
        setNavigationIndex: (value) =>
            set((state) => ({
                navigationIndex: resolveRepositoryState(
                    value,
                    state.navigationIndex,
                ),
            })),
        setProjectFiles: (value) =>
            set((state) => ({
                projectFiles: resolveRepositoryState(value, state.projectFiles),
            })),
        setFileInventoryRefreshToken: (value) =>
            set((state) => ({
                fileInventoryRefreshToken: resolveRepositoryState(
                    value,
                    state.fileInventoryRefreshToken,
                ),
            })),
        setProjectSearchSurface: (value) =>
            set((state) => ({
                projectSearchSurface: resolveRepositoryState(
                    value,
                    state.projectSearchSurface,
                ),
            })),
        setProjectSearchInitialQuery: (value) =>
            set((state) => ({
                projectSearchInitialQuery: resolveRepositoryState(
                    value,
                    state.projectSearchInitialQuery,
                ),
            })),
        setScratchFiles: (value) =>
            set((state) => ({
                scratchFiles: resolveRepositoryState(value, state.scratchFiles),
            })),
        setScratchFilesRestored: (value) =>
            set((state) => ({
                scratchFilesRestored: resolveRepositoryState(
                    value,
                    state.scratchFilesRestored,
                ),
            })),
        setScratchFileChooserOpen: (value) =>
            set((state) => ({
                scratchFileChooserOpen: resolveRepositoryState(
                    value,
                    state.scratchFileChooserOpen,
                ),
            })),
        setExportToHtmlOpen: (value) =>
            set((state) => ({
                exportToHtmlOpen: resolveRepositoryState(
                    value,
                    state.exportToHtmlOpen,
                ),
            })),
        setReplaceInFilesOpen: (value) =>
            set((state) => ({
                replaceInFilesOpen: resolveRepositoryState(
                    value,
                    state.replaceInFilesOpen,
                ),
            })),
        setFindResults: (value) =>
            set((state) => ({
                findResults: resolveRepositoryState(value, state.findResults),
            })),
        setRecentFindUsages: (value) =>
            set((state) => ({
                recentFindUsages: resolveRepositoryState(
                    value,
                    state.recentFindUsages,
                ),
            })),
        setRecentFindUsagesOpen: (value) =>
            set((state) => ({
                recentFindUsagesOpen: resolveRepositoryState(
                    value,
                    state.recentFindUsagesOpen,
                ),
            })),
        setCodeAnalysisRequest: (value) =>
            set((state) => ({
                codeAnalysisRequest: resolveRepositoryState(
                    value,
                    state.codeAnalysisRequest,
                ),
            })),
        setRunInspectionOpen: (value) =>
            set((state) => ({
                runInspectionOpen: resolveRepositoryState(
                    value,
                    state.runInspectionOpen,
                ),
            })),
        setStackTraceOpen: (value) =>
            set((state) => ({
                stackTraceOpen: resolveRepositoryState(
                    value,
                    state.stackTraceOpen,
                ),
            })),
        setVcsOperationsOpen: (value) =>
            set((state) => ({
                vcsOperationsOpen: resolveRepositoryState(
                    value,
                    state.vcsOperationsOpen,
                ),
            })),
        setInspectionResults: (value) =>
            set((state) => ({
                inspectionResults: resolveRepositoryState(
                    value,
                    state.inspectionResults,
                ),
            })),
        setActiveInspectorKey: (value) =>
            set((state) => ({
                activeInspectorKey: resolveRepositoryState(
                    value,
                    state.activeInspectorKey,
                ),
            })),
        setPreviewInspectorKey: (value) =>
            set((state) => ({
                previewInspectorKey: resolveRepositoryState(
                    value,
                    state.previewInspectorKey,
                ),
            })),
        setPinnedInspectorKeys: (value) =>
            set((state) => ({
                pinnedInspectorKeys: resolveRepositoryState(
                    value,
                    state.pinnedInspectorKeys,
                ),
            })),
        setDirtyInspectorKeys: (value) =>
            set((state) => ({
                dirtyInspectorKeys: resolveRepositoryState(
                    value,
                    state.dirtyInspectorKeys,
                ),
            })),
        setBookmarks: (value) =>
            set((state) => ({
                bookmarks: resolveRepositoryState(value, state.bookmarks),
            })),
        setBookmarksPopupMode: (value) =>
            set((state) => ({
                bookmarksPopupMode: resolveRepositoryState(
                    value,
                    state.bookmarksPopupMode,
                ),
            })),
        setBookmarkMnemonicTarget: (value) =>
            set((state) => ({
                bookmarkMnemonicTarget: resolveRepositoryState(
                    value,
                    state.bookmarkMnemonicTarget,
                ),
            })),
        setBookmarkGroupTarget: (value) =>
            set((state) => ({
                bookmarkGroupTarget: resolveRepositoryState(
                    value,
                    state.bookmarkGroupTarget,
                ),
            })),
        setBookmarksRestored: (value) =>
            set((state) => ({
                bookmarksRestored: resolveRepositoryState(
                    value,
                    state.bookmarksRestored,
                ),
            })),
    })) satisfies RepositoryWorkspaceSliceCreator<EditorToolsSlice>;
