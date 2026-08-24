import type { SetStateAction } from "react";
import type { StateCreator } from "zustand/vanilla";
import type { BookmarksPopupMode } from "../../../components/BookmarksPopup";
import type { BottomPanelTab } from "../../../components/BottomPanel";
import type { FindResultsSession } from "../../../components/FindResultsPanel";
import type { ProductNotification } from "../../../components/NotificationToolWindow";
import type { ProjectSearchSurface } from "../../../components/ProjectSearchDialog";
import type { ProjectBookmarks } from "../../../domain/bookmarks";
import type {
  ChangeSelection,
  CommitDraft,
  DiffPreferences,
  RepositoryViewMode,
} from "../../../domain/changeReview";
import type { CodeInspectionId, CodeIssue } from "../../../domain/codeAnalysis";
import type { ScratchFile } from "../../../domain/scratchFiles";
import type { FileChange } from "../../../domain/types";
import type {
  CommitSignature,
  ConflictContent,
} from "../../../shared/contracts/model/index";
import type {
  BookmarkGroupTarget,
  BookmarkMnemonicTarget,
  ContextPosition,
  DiffContentPair,
  DiffPreviewPair,
  DiffState,
  EditorStatus,
  HistoryRewriteRequest,
  InspectorState,
  PersistentDiffState,
  RepositoryToolWindow,
  RevisionComparisonState,
  ShareExistingRemotes,
  ShareProjectProvider,
  SubmoduleDiffState,
} from "./workspaceTypes";

export type RepositoryStateSetter<T> = (value: SetStateAction<T>) => void;

export interface RepositoryWorkspaceStoreOptions {
  readonly repositoryId: string;
  readonly repositoryName: string;
  readonly selectedRef?: string;
  readonly electronRuntime: boolean;
}

export interface RepositoryRequestToken {
  readonly repositoryId: string;
  readonly generation: number;
}

export interface RepositoryScopeSlice {
  readonly repositoryId: string;
  readonly generation: number;
  readonly createRequestToken: () => RepositoryRequestToken;
  readonly isRequestCurrent: (token: RepositoryRequestToken) => boolean;
  readonly runRepositoryTask: <T>(
    task: () => Promise<T>,
    commit: (value: T) => void,
    reject?: (error: unknown) => void,
  ) => Promise<boolean>;
  readonly invalidateScope: () => void;
}

export interface ReviewSlice {
  readonly selectedOids: readonly string[];
  readonly selectedRef: string | undefined;
  readonly repositoryViewMode: RepositoryViewMode;
  readonly changeSelection: ChangeSelection | null;
  readonly historySelectedPath: string | null;
  readonly historyParentRevision: string | null;
  readonly diffPreferences: DiffPreferences;
  readonly commitDraft: CommitDraft;
  readonly historyDiff: PersistentDiffState;
  readonly changeDiff: PersistentDiffState;
  readonly historyPreview: DiffPreviewPair;
  readonly changePreview: DiffPreviewPair;
  readonly historyContent: DiffContentPair;
  readonly changeContent: DiffContentPair;
  readonly historySubmodule: SubmoduleDiffState;
  readonly changeSubmodule: SubmoduleDiffState;
  readonly contextPosition: ContextPosition | undefined;
  readonly diffState: DiffState | undefined;
  readonly revisionComparison: RevisionComparisonState | undefined;
  readonly conflictContent: ConflictContent | undefined;
  readonly commitFiles: readonly FileChange[];
  readonly commitFilesLoading: boolean;
  readonly commitSignature: CommitSignature | undefined;
  readonly historyRewrite: HistoryRewriteRequest | null;
  readonly setSelectedOids: RepositoryStateSetter<readonly string[]>;
  readonly setSelectedRef: RepositoryStateSetter<string | undefined>;
  readonly setRepositoryViewMode: RepositoryStateSetter<RepositoryViewMode>;
  readonly setChangeSelection: RepositoryStateSetter<ChangeSelection | null>;
  readonly setHistorySelectedPath: RepositoryStateSetter<string | null>;
  readonly setHistoryParentRevision: RepositoryStateSetter<string | null>;
  readonly setDiffPreferences: RepositoryStateSetter<DiffPreferences>;
  readonly setCommitDraft: RepositoryStateSetter<CommitDraft>;
  readonly setHistoryDiff: RepositoryStateSetter<PersistentDiffState>;
  readonly setChangeDiff: RepositoryStateSetter<PersistentDiffState>;
  readonly setHistoryPreview: RepositoryStateSetter<DiffPreviewPair>;
  readonly setChangePreview: RepositoryStateSetter<DiffPreviewPair>;
  readonly setHistoryContent: RepositoryStateSetter<DiffContentPair>;
  readonly setChangeContent: RepositoryStateSetter<DiffContentPair>;
  readonly setHistorySubmodule: RepositoryStateSetter<SubmoduleDiffState>;
  readonly setChangeSubmodule: RepositoryStateSetter<SubmoduleDiffState>;
  readonly setContextPosition: RepositoryStateSetter<
    ContextPosition | undefined
  >;
  readonly setDiffState: RepositoryStateSetter<DiffState | undefined>;
  readonly setRevisionComparison: RepositoryStateSetter<
    RevisionComparisonState | undefined
  >;
  readonly setConflictContent: RepositoryStateSetter<
    ConflictContent | undefined
  >;
  readonly setCommitFiles: RepositoryStateSetter<readonly FileChange[]>;
  readonly setCommitFilesLoading: RepositoryStateSetter<boolean>;
  readonly setCommitSignature: RepositoryStateSetter<
    CommitSignature | undefined
  >;
  readonly setHistoryRewrite: RepositoryStateSetter<HistoryRewriteRequest | null>;
}

export interface EditorToolsSlice {
  readonly inspectorTabs: readonly InspectorState[];
  readonly recentInspectors: readonly InspectorState[];
  readonly navigationIndex: number;
  readonly projectFiles: readonly string[];
  readonly fileInventoryRefreshToken: number;
  readonly projectSearchSurface: ProjectSearchSurface | undefined;
  readonly projectSearchInitialQuery: string;
  readonly scratchFiles: readonly ScratchFile[];
  readonly scratchFilesRestored: boolean;
  readonly scratchFileChooserOpen: boolean;
  readonly exportToHtmlOpen: boolean;
  readonly replaceInFilesOpen: boolean;
  readonly findResults: FindResultsSession | null;
  readonly recentFindUsages: readonly FindResultsSession[];
  readonly recentFindUsagesOpen: boolean;
  readonly codeAnalysisRequest:
    | {
        readonly mode: "inspect" | "cleanup";
        readonly inspectionId?: CodeInspectionId;
      }
    | undefined;
  readonly runInspectionOpen: boolean;
  readonly stackTraceOpen: boolean;
  readonly vcsOperationsOpen: boolean;
  readonly inspectionResults:
    | { readonly title: string; readonly issues: readonly CodeIssue[] }
    | undefined;
  readonly activeInspectorKey: string | undefined;
  readonly previewInspectorKey: string | undefined;
  readonly pinnedInspectorKeys: ReadonlySet<string>;
  readonly dirtyInspectorKeys: ReadonlySet<string>;
  readonly bookmarks: ProjectBookmarks;
  readonly bookmarksPopupMode: BookmarksPopupMode | undefined;
  readonly bookmarkMnemonicTarget: BookmarkMnemonicTarget | undefined;
  readonly bookmarkGroupTarget: BookmarkGroupTarget | undefined;
  readonly bookmarksRestored: boolean;
  readonly setInspectorTabs: RepositoryStateSetter<readonly InspectorState[]>;
  readonly setRecentInspectors: RepositoryStateSetter<
    readonly InspectorState[]
  >;
  readonly setNavigationIndex: RepositoryStateSetter<number>;
  readonly setProjectFiles: RepositoryStateSetter<readonly string[]>;
  readonly setFileInventoryRefreshToken: RepositoryStateSetter<number>;
  readonly setProjectSearchSurface: RepositoryStateSetter<
    ProjectSearchSurface | undefined
  >;
  readonly setProjectSearchInitialQuery: RepositoryStateSetter<string>;
  readonly setScratchFiles: RepositoryStateSetter<readonly ScratchFile[]>;
  readonly setScratchFilesRestored: RepositoryStateSetter<boolean>;
  readonly setScratchFileChooserOpen: RepositoryStateSetter<boolean>;
  readonly setExportToHtmlOpen: RepositoryStateSetter<boolean>;
  readonly setReplaceInFilesOpen: RepositoryStateSetter<boolean>;
  readonly setFindResults: RepositoryStateSetter<FindResultsSession | null>;
  readonly setRecentFindUsages: RepositoryStateSetter<
    readonly FindResultsSession[]
  >;
  readonly setRecentFindUsagesOpen: RepositoryStateSetter<boolean>;
  readonly setCodeAnalysisRequest: RepositoryStateSetter<
    EditorToolsSlice["codeAnalysisRequest"]
  >;
  readonly setRunInspectionOpen: RepositoryStateSetter<boolean>;
  readonly setStackTraceOpen: RepositoryStateSetter<boolean>;
  readonly setVcsOperationsOpen: RepositoryStateSetter<boolean>;
  readonly setInspectionResults: RepositoryStateSetter<
    EditorToolsSlice["inspectionResults"]
  >;
  readonly setActiveInspectorKey: RepositoryStateSetter<string | undefined>;
  readonly setPreviewInspectorKey: RepositoryStateSetter<string | undefined>;
  readonly setPinnedInspectorKeys: RepositoryStateSetter<ReadonlySet<string>>;
  readonly setDirtyInspectorKeys: RepositoryStateSetter<ReadonlySet<string>>;
  readonly setBookmarks: RepositoryStateSetter<ProjectBookmarks>;
  readonly setBookmarksPopupMode: RepositoryStateSetter<
    BookmarksPopupMode | undefined
  >;
  readonly setBookmarkMnemonicTarget: RepositoryStateSetter<
    BookmarkMnemonicTarget | undefined
  >;
  readonly setBookmarkGroupTarget: RepositoryStateSetter<
    BookmarkGroupTarget | undefined
  >;
  readonly setBookmarksRestored: RepositoryStateSetter<boolean>;
}

export interface LayoutSlice {
  readonly bottomCollapsed: boolean;
  readonly projectOpen: boolean;
  readonly bookmarksOpen: boolean;
  readonly logOpen: boolean;
  readonly logTabIds: readonly string[];
  readonly activeLogTabId: string;
  readonly logIndexing: boolean;
  readonly logIndexingEnabled: boolean;
  readonly bottomPanelHeight: number;
  readonly sideToolWindowWidth: number;
  readonly bottomPanelTab: BottomPanelTab;
  readonly changesNavigatorWidth: number;
  readonly historyReviewWidth: number;
  readonly commitRailWidth: number;
  readonly toast: string | undefined;
  readonly notificationOpen: boolean;
  readonly processesOpen: boolean;
  readonly activeToolWindow: RepositoryToolWindow | null;
  readonly maximizedToolWindow: RepositoryToolWindow | null;
  readonly shareProjectProvider: ShareProjectProvider | undefined;
  readonly shareExistingRemotes: ShareExistingRemotes | undefined;
  readonly notifications: readonly ProductNotification[];
  readonly balloonId: string | undefined;
  readonly uiStateRestored: boolean;
  readonly editorStatus: EditorStatus | undefined;
  readonly setBottomCollapsed: RepositoryStateSetter<boolean>;
  readonly setProjectOpen: RepositoryStateSetter<boolean>;
  readonly setBookmarksOpen: RepositoryStateSetter<boolean>;
  readonly setLogOpen: RepositoryStateSetter<boolean>;
  readonly setLogTabIds: RepositoryStateSetter<readonly string[]>;
  readonly setActiveLogTabId: RepositoryStateSetter<string>;
  readonly setLogIndexing: RepositoryStateSetter<boolean>;
  readonly setLogIndexingEnabled: RepositoryStateSetter<boolean>;
  readonly setBottomPanelHeight: RepositoryStateSetter<number>;
  readonly setSideToolWindowWidth: RepositoryStateSetter<number>;
  readonly setBottomPanelTab: RepositoryStateSetter<BottomPanelTab>;
  readonly setChangesNavigatorWidth: RepositoryStateSetter<number>;
  readonly setHistoryReviewWidth: RepositoryStateSetter<number>;
  readonly setCommitRailWidth: RepositoryStateSetter<number>;
  readonly setToast: RepositoryStateSetter<string | undefined>;
  readonly setNotificationOpen: RepositoryStateSetter<boolean>;
  readonly setProcessesOpen: RepositoryStateSetter<boolean>;
  readonly setActiveToolWindow: RepositoryStateSetter<RepositoryToolWindow | null>;
  readonly setMaximizedToolWindow: RepositoryStateSetter<RepositoryToolWindow | null>;
  readonly setShareProjectProvider: RepositoryStateSetter<
    ShareProjectProvider | undefined
  >;
  readonly setShareExistingRemotes: RepositoryStateSetter<
    ShareExistingRemotes | undefined
  >;
  readonly setNotifications: RepositoryStateSetter<
    readonly ProductNotification[]
  >;
  readonly setBalloonId: RepositoryStateSetter<string | undefined>;
  readonly setUiStateRestored: RepositoryStateSetter<boolean>;
  readonly setEditorStatus: RepositoryStateSetter<EditorStatus | undefined>;
}

export type RepositoryWorkspaceStore = RepositoryScopeSlice &
  ReviewSlice &
  EditorToolsSlice &
  LayoutSlice;

export type RepositoryWorkspaceSliceCreator<T> = StateCreator<
  RepositoryWorkspaceStore,
  [],
  [],
  T
>;
