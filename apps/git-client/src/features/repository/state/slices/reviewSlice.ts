import {
    DEFAULT_DIFF_PREFERENCES,
    EMPTY_COMMIT_DRAFT,
} from "../../../../domain/changeReview";
import type {
    RepositoryWorkspaceSliceCreator,
    RepositoryWorkspaceStoreOptions,
    ReviewSlice,
} from "../repositoryWorkspaceStoreTypes";
import type {
    DiffContentPair,
    DiffPreviewPair,
    PersistentDiffState,
    SubmoduleDiffState,
} from "../workspaceTypes";
import { resolveRepositoryState } from "./stateUpdater";

const EMPTY_DIFF: PersistentDiffState = { patch: "", loading: false };
const EMPTY_PREVIEW: DiffPreviewPair = {
    before: null,
    after: null,
    loading: false,
};
const EMPTY_CONTENT: DiffContentPair = {
    before: null,
    after: null,
    loading: false,
};
const EMPTY_SUBMODULE: SubmoduleDiffState = { value: null, loading: false };

export const createReviewSlice = (
    options: RepositoryWorkspaceStoreOptions,
): RepositoryWorkspaceSliceCreator<ReviewSlice> =>
    ((set) => ({
        selectedOids: [],
        selectedRef: options.selectedRef,
        repositoryViewMode: "history",
        changeSelection: null,
        historySelectedPath: null,
        historyParentRevision: null,
        diffPreferences: DEFAULT_DIFF_PREFERENCES,
        commitDraft: EMPTY_COMMIT_DRAFT,
        historyDiff: EMPTY_DIFF,
        changeDiff: EMPTY_DIFF,
        historyPreview: EMPTY_PREVIEW,
        changePreview: EMPTY_PREVIEW,
        historyContent: EMPTY_CONTENT,
        changeContent: EMPTY_CONTENT,
        historySubmodule: EMPTY_SUBMODULE,
        changeSubmodule: EMPTY_SUBMODULE,
        contextPosition: undefined,
        diffState: undefined,
        revisionComparison: undefined,
        conflictContent: undefined,
        commitFiles: [],
        commitFilesLoading: false,
        commitSignature: undefined,
        historyRewrite: null,
        setSelectedOids: (value) =>
            set((state) => ({
                selectedOids: resolveRepositoryState(value, state.selectedOids),
            })),
        setSelectedRef: (value) =>
            set((state) => ({
                selectedRef: resolveRepositoryState(value, state.selectedRef),
            })),
        setRepositoryViewMode: (value) =>
            set((state) => ({
                repositoryViewMode: resolveRepositoryState(
                    value,
                    state.repositoryViewMode,
                ),
            })),
        setChangeSelection: (value) =>
            set((state) => ({
                changeSelection: resolveRepositoryState(
                    value,
                    state.changeSelection,
                ),
            })),
        setHistorySelectedPath: (value) =>
            set((state) => ({
                historySelectedPath: resolveRepositoryState(
                    value,
                    state.historySelectedPath,
                ),
            })),
        setHistoryParentRevision: (value) =>
            set((state) => ({
                historyParentRevision: resolveRepositoryState(
                    value,
                    state.historyParentRevision,
                ),
            })),
        setDiffPreferences: (value) =>
            set((state) => ({
                diffPreferences: resolveRepositoryState(
                    value,
                    state.diffPreferences,
                ),
            })),
        setCommitDraft: (value) =>
            set((state) => ({
                commitDraft: resolveRepositoryState(value, state.commitDraft),
            })),
        setHistoryDiff: (value) =>
            set((state) => ({
                historyDiff: resolveRepositoryState(value, state.historyDiff),
            })),
        setChangeDiff: (value) =>
            set((state) => ({
                changeDiff: resolveRepositoryState(value, state.changeDiff),
            })),
        setHistoryPreview: (value) =>
            set((state) => ({
                historyPreview: resolveRepositoryState(
                    value,
                    state.historyPreview,
                ),
            })),
        setChangePreview: (value) =>
            set((state) => ({
                changePreview: resolveRepositoryState(
                    value,
                    state.changePreview,
                ),
            })),
        setHistoryContent: (value) =>
            set((state) => ({
                historyContent: resolveRepositoryState(
                    value,
                    state.historyContent,
                ),
            })),
        setChangeContent: (value) =>
            set((state) => ({
                changeContent: resolveRepositoryState(
                    value,
                    state.changeContent,
                ),
            })),
        setHistorySubmodule: (value) =>
            set((state) => ({
                historySubmodule: resolveRepositoryState(
                    value,
                    state.historySubmodule,
                ),
            })),
        setChangeSubmodule: (value) =>
            set((state) => ({
                changeSubmodule: resolveRepositoryState(
                    value,
                    state.changeSubmodule,
                ),
            })),
        setContextPosition: (value) =>
            set((state) => ({
                contextPosition: resolveRepositoryState(
                    value,
                    state.contextPosition,
                ),
            })),
        setDiffState: (value) =>
            set((state) => ({
                diffState: resolveRepositoryState(value, state.diffState),
            })),
        setRevisionComparison: (value) =>
            set((state) => ({
                revisionComparison: resolveRepositoryState(
                    value,
                    state.revisionComparison,
                ),
            })),
        setConflictContent: (value) =>
            set((state) => ({
                conflictContent: resolveRepositoryState(
                    value,
                    state.conflictContent,
                ),
            })),
        setCommitFiles: (value) =>
            set((state) => ({
                commitFiles: resolveRepositoryState(value, state.commitFiles),
            })),
        setCommitFilesLoading: (value) =>
            set((state) => ({
                commitFilesLoading: resolveRepositoryState(
                    value,
                    state.commitFilesLoading,
                ),
            })),
        setCommitSignature: (value) =>
            set((state) => ({
                commitSignature: resolveRepositoryState(
                    value,
                    state.commitSignature,
                ),
            })),
        setHistoryRewrite: (value) =>
            set((state) => ({
                historyRewrite: resolveRepositoryState(
                    value,
                    state.historyRewrite,
                ),
            })),
    })) satisfies RepositoryWorkspaceSliceCreator<ReviewSlice>;
