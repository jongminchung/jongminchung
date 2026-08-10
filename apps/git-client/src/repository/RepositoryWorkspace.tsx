import { Button } from "@jongminchung/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jongminchung/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppDialog } from "../components/AppDialog";
import { BookmarksToolWindow } from "../components/BookmarksToolWindow";
import { BottomPanel } from "../components/BottomPanel";
import { BranchTree } from "../components/BranchTree";
import { ChangesWorkspace } from "../components/ChangesWorkspace";
import { useCommands, useDismissLayer } from "../components/CommandProvider";
import { CommitContextMenu } from "../components/CommitContextMenu";
import { CommitLog } from "../components/CommitLog";
import { ConflictEditorDialog } from "../components/ConflictEditorDialog";
import { DetailsPane } from "../components/DetailsPane";
import { DiffViewer } from "../components/DiffViewer";
import { HistoryRewriteWorkspace } from "../components/HistoryRewriteWorkspace";
import { Icon } from "../components/Icon";
import {
  NotificationBalloon,
  NotificationToolWindow,
  type ProductNotification,
} from "../components/NotificationToolWindow";
import { EmptyState, StatePill } from "../components/ProductCollections";
import { ProjectToolWindow } from "../components/ProjectToolWindow";
import { RepositoryInspectorDialog } from "../components/RepositoryInspectorDialog";
import type { RepositoryToolKind } from "../components/RepositoryToolDialog";
import { RevisionComparison } from "../components/RevisionComparison";
import { ScratchEditor } from "../components/ScratchEditor";
import { ShareExistingRemotesDialog } from "../components/ShareExistingRemotesDialog";
import { ShareProjectDialog, type ShareProjectBinding } from "../components/ShareProjectDialog";
import { deriveActionAvailability } from "../domain/actionAvailability";
import {
  allLineBookmarks,
  createBookmarkGroup,
  deleteBookmarkGroup,
  describeBookmark,
  moveBookmark,
  removeBookmark,
  renameBookmarkGroup,
  setDefaultBookmarkGroup,
} from "../domain/bookmarks";
import { reconcileChangeSelection, type DiffPreferences } from "../domain/changeReview";
import { COMMAND_ENABLED, commandDisabled, type CommandDefinition } from "../domain/commands";
import { commitUrl } from "../domain/forge";
import { type ProductSettings } from "../domain/productSettings";
import { terminalService } from "../domain/TerminalService";
import { toVoidHandler } from "../domain/toVoidHandler";
import type {
  ActionAvailability,
  Commit,
  FileChange,
  Ref,
  RepositoryView,
  StashEntry,
} from "../domain/types";
import {
  MAX_SIDE_TOOL_WINDOW_WIDTH,
  MIN_SIDE_TOOL_WINDOW_WIDTH,
} from "../domain/workspacePersistence";
import type { GitSessionController } from "../git-session/useGitSessionController";
import { isElectronRuntime } from "../platform/electron";
import {
  openExternalUrl,
  selectPatchExportPath,
  selectPatchImportPath,
} from "../platform/electronActions";
import type { DiffOptions, FileSource } from "../shared/contracts/model";
import { useRepositoryBookmarkController } from "./hooks/useRepositoryBookmarkController";
import { useRepositoryContentLoader } from "./hooks/useRepositoryContentLoader";
import { useRepositoryEditorController } from "./hooks/useRepositoryEditorController";
import { useRepositoryEditorFeatures } from "./hooks/useRepositoryEditorFeatures";
import { useRepositoryHostingCoordinator } from "./hooks/useRepositoryHostingCoordinator";
import { useRepositoryNotifications } from "./hooks/useRepositoryNotifications";
import { useRepositoryPersistence } from "./hooks/useRepositoryPersistence";
import {
  editorPanelDomId,
  editorTabDomId,
  useRepositoryTabCoordinator,
} from "./hooks/useRepositoryTabCoordinator";
import { useRepositoryToolWindowController } from "./hooks/useRepositoryToolWindowController";
import { useRepositoryVcsController } from "./hooks/useRepositoryVcsController";
import { useRepositoryWorkspaceLifecycle } from "./hooks/useRepositoryWorkspaceLifecycle";
import {
  RepositoryLoadingSkeleton,
  RepositoryRightToolStripe,
  RepositoryToolStripe,
} from "./RepositoryChrome";
import { RepositoryStatusBar } from "./RepositoryStatusBar";
import {
  RepositoryWorkspaceStoreProvider,
  useRepositoryWorkspaceStore,
} from "./state/RepositoryWorkspaceStoreProvider";
import { inspectorKey, type EditorStatus } from "./state/workspaceTypes";
import { RepositoryNavigationSurface } from "./surfaces/RepositoryNavigationSurface";
import { RepositoryOverlays } from "./surfaces/RepositoryOverlays";
import { useRepositoryCommands } from "./useRepositoryCommands";
import { useRepositoryPalette } from "./useRepositoryPalette";

function remoteBrowserUrl(remote: string): string | null {
  try {
    const url = new URL(remote);
    if (url.protocol === "https:" || url.protocol === "http:") {
      url.username = "";
      url.password = "";
      url.pathname = url.pathname.replace(/\.git$/u, "");
      url.search = "";
      url.hash = "";
      return url.toString();
    }
    if (url.protocol === "ssh:") {
      return `https://${url.hostname}${url.pathname.replace(/\.git$/u, "")}`;
    }
  } catch {
    const match = /^(?:[^@\s]+@)?([^:/\s]+):(.+)$/u.exec(remote);
    if (match?.[1] && match[2]) {
      return `https://${match[1]}/${match[2].replace(/\.git$/u, "")}`;
    }
  }
  return null;
}

function isEditorStatus(value: unknown): value is EditorStatus {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<EditorStatus>;
  return (
    typeof candidate.path === "string" &&
    typeof candidate.line === "number" &&
    typeof candidate.column === "number" &&
    typeof candidate.readOnly === "boolean" &&
    typeof candidate.language === "string" &&
    (candidate.lineSeparator === "LF" || candidate.lineSeparator === "CRLF") &&
    typeof candidate.indentation === "string" &&
    typeof candidate.columnSelection === "boolean" &&
    (candidate.symbol === undefined || typeof candidate.symbol === "string") &&
    (candidate.selectedText === undefined || typeof candidate.selectedText === "string")
  );
}

type GitSession = GitSessionController;
const commitFilesCache = new Map<string, readonly FileChange[]>();
const COMMIT_FILES_CACHE_LIMIT = 200;
const EMPTY_TREE_OID = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function nativeDiffOptions(preferences: DiffPreferences): DiffOptions {
  return {
    whitespace: preferences.whitespace,
    contextLines: preferences.contextLines === "full" ? null : preferences.contextLines,
  };
}

function cacheCommitFiles(key: string, files: readonly FileChange[]): void {
  commitFilesCache.delete(key);
  commitFilesCache.set(key, files);
  const oldest = commitFilesCache.keys().next().value;
  if (commitFilesCache.size > COMMIT_FILES_CACHE_LIMIT && typeof oldest === "string") {
    commitFilesCache.delete(oldest);
  }
}

export function clearCommitFilesCache(): void {
  commitFilesCache.clear();
}

interface RepositoryWorkspaceProps {
  readonly repository: RepositoryView;
  readonly session: GitSession;
  readonly productSettings: ProductSettings;
  readonly onAddRepository: () => void;
  readonly onOpenPush: (localRevision?: string, knownRewrite?: boolean) => void;
  readonly onOpenRepositoryTool: (kind: RepositoryToolKind) => void;
  readonly showNotifications: boolean;
  readonly showShortcutConflictWarning: boolean;
  readonly onDirtyEditorCountChange: (count: number) => void;
  readonly onDismissShortcutConflictWarning: () => void;
  readonly onOpenSettings: () => void;
  readonly onChromeModeChange: (mode: "editor" | "terminal") => void;
}

export function RepositoryWorkspace(props: RepositoryWorkspaceProps) {
  const { repository } = props;
  return (
    <RepositoryWorkspaceStoreProvider
      electronRuntime={isElectronRuntime()}
      repositoryId={repository.snapshot.id}
      repositoryName={repository.snapshot.name}
      selectedRef={repository.refs.find((ref) => ref.current)?.name}
    >
      <RepositoryWorkspaceContent {...props} />
    </RepositoryWorkspaceStoreProvider>
  );
}

function RepositoryWorkspaceContent({
  repository,
  session,
  productSettings,
  onAddRepository,
  onOpenPush,
  onOpenRepositoryTool,
  showNotifications,
  showShortcutConflictWarning,
  onDirtyEditorCountChange,
  onDismissShortcutConflictWarning,
  onOpenSettings,
  onChromeModeChange,
}: RepositoryWorkspaceProps) {
  const {
    activity: sessionActivityCapability,
    mutations: sessionMutations,
    queries: sessionQueries,
    repository: sessionRepositoryCapability,
    workspace: sessionWorkspace,
  } = session.capabilities;
  const {
    cancel: sessionCancelActivity,
    clearConsole: sessionClearGitConsole,
    current: sessionActivity,
    gitConsoleEntries: sessionGitConsoleEntries,
  } = sessionActivityCapability;
  const {
    abortOperation: sessionAbortOperation,
    applyShelf: sessionApplyShelf,
    commitChangelist: sessionCommitChangelist,
    createShelf: sessionCreateShelf,
    deleteChangelist: sessionDeleteChangelist,
    deleteShelf: sessionDeleteShelf,
    executeOperation: sessionExecuteOperation,
    importPatch: sessionImportPatch,
    putLocalHistoryLabel: sessionPutLocalHistoryLabel,
    resolveBinaryConflict: sessionResolveBinaryConflict,
    restoreRecoveryEntry: sessionRestoreRecoveryEntry,
    revertLocalHistory: sessionRevertLocalHistory,
    saveChangelist: sessionSaveChangelist,
    saveConflictResult: sessionSaveConflictResult,
    writeWorkingTreeFile: sessionWriteWorkingTreeFile,
  } = sessionMutations;
  const {
    createLocalHistoryPatch: sessionCreateLocalHistoryPatch,
    createPatchText: sessionCreatePatchText,
    exportPatch: sessionExportPatch,
    indexLog: sessionIndexLog,
    listLocalHistoryActivities: sessionListLocalHistoryActivities,
    loadBlame: sessionLoadBlame,
    loadCommitDiff: sessionLoadCommitDiff,
    loadCommitFiles: sessionLoadCommitFiles,
    loadCommitSignature: sessionLoadCommitSignature,
    loadFileHistory: sessionLoadFileHistory,
    loadFiles: sessionLoadFiles,
    loadHistoryRewritePreview: sessionLoadHistoryRewritePreview,
    loadLocalChangesPatch: sessionLoadLocalChangesPatch,
    loadLocalHistoryDiff: sessionLoadLocalHistoryDiff,
    loadLog: sessionLoadLog,
    loadRevisionDiff: sessionLoadRevisionDiff,
    loadStashFiles: sessionLoadStashFiles,
    loadStashPatch: sessionLoadStashPatch,
    loadSubmoduleDiff: sessionLoadSubmoduleDiff,
    loadTree: sessionLoadTree,
    loadWorkingDiff: sessionLoadWorkingDiff,
    openWorkingTreeFile: sessionOpenWorkingTreeFile,
    preCommitCheck: sessionPreCommitCheck,
    readConflict: sessionReadConflict,
    readFile: sessionReadFile,
    readFilePreview: sessionReadFilePreview,
    readLocalHistoryActivity: sessionReadLocalHistoryActivity,
    reload: sessionReload,
    searchProjectText: sessionSearchProjectText,
  } = sessionQueries;
  const {
    accessMode: sessionAccessMode,
    changelists: sessionChangelists,
    fixture: sessionFixture,
    hasMoreCommits: sessionHasMoreCommits,
    loading: sessionLoading,
    logError: sessionLogError,
    logLoading: sessionLogLoading,
    recoveryEntries: sessionRecoveryEntries,
    remotes: sessionRemotes,
    shelves: sessionShelves,
    stale: sessionStale,
    stashes: sessionStashes,
  } = sessionRepositoryCapability;
  const { error: sessionError } = sessionWorkspace;
  const { execute: executeCommand, openPaletteFor } = useCommands();
  const safeMode = sessionAccessMode === "safe";
  const review = useRepositoryWorkspaceStore(
    useShallow((state) => ({
      selectedOids: state.selectedOids,
      selectedRef: state.selectedRef,
      repositoryViewMode: state.repositoryViewMode,
      changeSelection: state.changeSelection,
      historySelectedPath: state.historySelectedPath,
      historyParentRevision: state.historyParentRevision,
      diffPreferences: state.diffPreferences,
      commitDraft: state.commitDraft,
      historyDiff: state.historyDiff,
      changeDiff: state.changeDiff,
      historyPreview: state.historyPreview,
      changePreview: state.changePreview,
      historyContent: state.historyContent,
      changeContent: state.changeContent,
      historySubmodule: state.historySubmodule,
      changeSubmodule: state.changeSubmodule,
      contextPosition: state.contextPosition,
      diffState: state.diffState,
      revisionComparison: state.revisionComparison,
      conflictContent: state.conflictContent,
      commitFiles: state.commitFiles,
      commitFilesLoading: state.commitFilesLoading,
      commitSignature: state.commitSignature,
      historyRewrite: state.historyRewrite,
      setSelectedOids: state.setSelectedOids,
      setSelectedRef: state.setSelectedRef,
      setRepositoryViewMode: state.setRepositoryViewMode,
      setChangeSelection: state.setChangeSelection,
      setHistorySelectedPath: state.setHistorySelectedPath,
      setHistoryParentRevision: state.setHistoryParentRevision,
      setDiffPreferences: state.setDiffPreferences,
      setCommitDraft: state.setCommitDraft,
      setHistoryDiff: state.setHistoryDiff,
      setChangeDiff: state.setChangeDiff,
      setHistorySubmodule: state.setHistorySubmodule,
      setChangeSubmodule: state.setChangeSubmodule,
      setContextPosition: state.setContextPosition,
      setDiffState: state.setDiffState,
      setRevisionComparison: state.setRevisionComparison,
      setConflictContent: state.setConflictContent,
      setCommitFiles: state.setCommitFiles,
      setCommitFilesLoading: state.setCommitFilesLoading,
      setCommitSignature: state.setCommitSignature,
      setHistoryRewrite: state.setHistoryRewrite,
    })),
  );
  const {
    selectedOids,
    selectedRef,
    repositoryViewMode,
    changeSelection,
    historySelectedPath,
    historyParentRevision,
    diffPreferences,
    commitDraft,
    historyDiff,
    changeDiff,
    historyPreview,
    changePreview,
    historyContent,
    changeContent,
    historySubmodule,
    changeSubmodule,
    contextPosition,
    diffState,
    revisionComparison,
    conflictContent,
    commitFiles,
    commitFilesLoading,
    commitSignature,
    historyRewrite,
    setSelectedOids,
    setSelectedRef,
    setRepositoryViewMode,
    setChangeSelection,
    setHistorySelectedPath,
    setHistoryParentRevision,
    setDiffPreferences,
    setCommitDraft,
    setHistoryDiff,
    setChangeDiff,
    setHistorySubmodule,
    setChangeSubmodule,
    setContextPosition,
    setDiffState,
    setRevisionComparison,
    setConflictContent,
    setCommitFiles,
    setCommitFilesLoading,
    setCommitSignature,
    setHistoryRewrite,
  } = review;
  useEffect(() => {
    const openRequestedView = (event: Event): void => {
      if (!safeMode && event instanceof CustomEvent && event.detail === "changes") {
        setRepositoryViewMode("changes");
      }
    };
    window.addEventListener("git-client:repository-view-request", openRequestedView);
    return () =>
      window.removeEventListener("git-client:repository-view-request", openRequestedView);
  }, [safeMode, setRepositoryViewMode]);
  const {
    activeInspectorKey,
    bookmarks,
    closeInspectors,
    dirtyInspectorKeys,
    findResults,
    inspector,
    inspectorTabs,
    navigateInspectorHistory,
    navigationHistory,
    navigationIndex,
    openInspector,
    pinnedInspectorKeys,
    previewInspectorKey,
    projectFiles,
    recentInspectors,
    scratchFiles,
    setActiveInspectorKey,
    setBookmarks,
    setBookmarksPopupMode,
    setCodeAnalysisRequest,
    setDirtyInspectorKeys,
    setExportToHtmlOpen,
    setInspectionResults,
    setPreviewInspectorKey,
    setProjectSearchInitialQuery,
    setProjectSearchSurface,
    setRecentFindUsagesOpen,
    setReplaceInFilesOpen,
    setRunInspectionOpen,
    setScratchFileChooserOpen,
    setScratchFiles,
    setStackTraceOpen,
    setVcsOperationsOpen,
  } = useRepositoryEditorController({
    loadFiles: sessionLoadFiles,
    onDirtyEditorCountChange,
    repository,
  });
  const layout = useRepositoryWorkspaceStore(
    useShallow((state) => ({
      bottomCollapsed: state.bottomCollapsed,
      projectOpen: state.projectOpen,
      bookmarksOpen: state.bookmarksOpen,
      logOpen: state.logOpen,
      logTabIds: state.logTabIds,
      activeLogTabId: state.activeLogTabId,
      logIndexing: state.logIndexing,
      logIndexingEnabled: state.logIndexingEnabled,
      bottomPanelHeight: state.bottomPanelHeight,
      sideToolWindowWidth: state.sideToolWindowWidth,
      bottomPanelTab: state.bottomPanelTab,
      changesNavigatorWidth: state.changesNavigatorWidth,
      historyReviewWidth: state.historyReviewWidth,
      commitRailWidth: state.commitRailWidth,
      toast: state.toast,
      notificationOpen: state.notificationOpen,
      processesOpen: state.processesOpen,
      activeToolWindow: state.activeToolWindow,
      maximizedToolWindow: state.maximizedToolWindow,
      shareProjectProvider: state.shareProjectProvider,
      shareExistingRemotes: state.shareExistingRemotes,
      notifications: state.notifications,
      balloonId: state.balloonId,
      editorStatus: state.editorStatus,
      setBottomCollapsed: state.setBottomCollapsed,
      setProjectOpen: state.setProjectOpen,
      setBookmarksOpen: state.setBookmarksOpen,
      setLogOpen: state.setLogOpen,
      setLogTabIds: state.setLogTabIds,
      setActiveLogTabId: state.setActiveLogTabId,
      setLogIndexing: state.setLogIndexing,
      setLogIndexingEnabled: state.setLogIndexingEnabled,
      setBottomPanelHeight: state.setBottomPanelHeight,
      setSideToolWindowWidth: state.setSideToolWindowWidth,
      setBottomPanelTab: state.setBottomPanelTab,
      setChangesNavigatorWidth: state.setChangesNavigatorWidth,
      setHistoryReviewWidth: state.setHistoryReviewWidth,
      setCommitRailWidth: state.setCommitRailWidth,
      setToast: state.setToast,
      setNotificationOpen: state.setNotificationOpen,
      setProcessesOpen: state.setProcessesOpen,
      setActiveToolWindow: state.setActiveToolWindow,
      setMaximizedToolWindow: state.setMaximizedToolWindow,
      setShareProjectProvider: state.setShareProjectProvider,
      setShareExistingRemotes: state.setShareExistingRemotes,
      setNotifications: state.setNotifications,
      setBalloonId: state.setBalloonId,
      setEditorStatus: state.setEditorStatus,
    })),
  );
  const {
    bottomCollapsed,
    projectOpen,
    bookmarksOpen,
    logOpen,
    logTabIds,
    activeLogTabId,
    logIndexing,
    logIndexingEnabled,
    bottomPanelHeight,
    sideToolWindowWidth,
    bottomPanelTab,
    changesNavigatorWidth,
    historyReviewWidth,
    commitRailWidth,
    toast,
    notificationOpen,
    processesOpen,
    activeToolWindow,
    maximizedToolWindow,
    shareProjectProvider,
    shareExistingRemotes,
    notifications,
    balloonId,
    editorStatus,
    setBottomCollapsed,
    setProjectOpen,
    setBookmarksOpen,
    setLogOpen,
    setLogTabIds,
    setActiveLogTabId,
    setLogIndexing,
    setLogIndexingEnabled,
    setBottomPanelHeight,
    setSideToolWindowWidth,
    setBottomPanelTab,
    setChangesNavigatorWidth,
    setHistoryReviewWidth,
    setCommitRailWidth,
    setToast,
    setNotificationOpen,
    setProcessesOpen,
    setActiveToolWindow,
    setMaximizedToolWindow,
    setShareProjectProvider,
    setShareExistingRemotes,
    setNotifications,
    setBalloonId,
    setEditorStatus,
  } = layout;
  useSyncExternalStore(
    terminalService.subscribe,
    terminalService.snapshot,
    terminalService.snapshot,
  );
  const terminalTabCount = terminalService.sessions(repository.snapshot.id).length;
  const dialog = useAppDialog();
  const lastAutoShownActivity = useRef<string | undefined>(undefined);
  const { jumpToLastToolWindow } = useRepositoryToolWindowController({
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
  });
  useEffect(() => {
    const activity = sessionActivity;
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
  }, [productSettings.processWindowAutoShow, sessionActivity, setProcessesOpen]);
  useEffect(() => {
    const update = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      setEditorStatus(isEditorStatus(event.detail) ? event.detail : undefined);
    };
    window.addEventListener("git-client:editor-status", update);
    return () => window.removeEventListener("git-client:editor-status", update);
  }, [setEditorStatus]);
  const {
    createScratchFile,
    exportToHtml,
    openCodeIssue,
    openScratchFile,
    openStackFrame,
    replaceInProjectFiles,
    runCodeCleanup,
    runCodeInspection,
  } = useRepositoryEditorFeatures({
    inspector,
    loadFile: sessionReadFile,
    openInspector,
    reload: sessionReload,
    repository,
    writeWorkingTreeFile: sessionWriteWorkingTreeFile,
  });
  const {
    beginMnemonicBookmark,
    chooseBookmarkMnemonic,
    openLineBookmark,
    requestToggleBookmark,
    toggleCurrentBookmark,
  } = useRepositoryBookmarkController({ openInspector, repository });
  const {
    closeLogTab,
    editorTabsId,
    nextLogTabNumber,
    openGitLogTab,
    openNewLogTab,
    requestCloseInspector,
    requestCloseInspectors,
    requestOpenRepositoryTool,
    setInspectorDirty,
  } = useRepositoryTabCoordinator({
    activeInspectorKey,
    activeLogTabId,
    closeInspectors,
    dialog,
    dirtyInspectorKeys,
    inspectorTabs,
    logOpen,
    logTabIds,
    onOpenRepositoryTool,
    setActiveInspectorKey,
    setActiveLogTabId,
    setDirtyInspectorKeys,
    setLogOpen,
    setLogTabIds,
    setPreviewInspectorKey,
    setRepositoryViewMode,
  });
  const {
    applyPatchFromClipboard,
    applyPatchFromFile,
    compareVcsFile,
    conflictedFile,
    createPatchFromLocalChanges,
    hasTrackedWorkingChanges,
    openVcsFileTab,
    rollbackVcsFile,
    showVcsFileChanges,
    untrackedPaths,
    vcsFileChange,
    vcsFileEntry,
    vcsFilePath,
    vcsFileVersioned,
    workingEntries,
  } = useRepositoryVcsController({
    executeOperation: sessionExecuteOperation,
    importPatch: sessionImportPatch,
    inspector,
    loadLocalChangesPatch: sessionLoadLocalChangesPatch,
    loadRevisionDiff: sessionLoadRevisionDiff,
    openInspector,
    repository,
  });
  const commitsByOid = useMemo(
    () => new Map(repository.commits.map((commit) => [commit.oid, commit])),
    [repository.commits],
  );
  const selectedCommits = useMemo(
    () =>
      selectedOids
        .map((oid) => commitsByOid.get(oid))
        .filter((commit): commit is Commit => Boolean(commit)),
    [commitsByOid, selectedOids],
  );
  const primaryCommit = selectedCommits[0];
  const primaryCommitOid = primaryCommit?.oid;
  const primaryIndex = primaryCommit
    ? repository.commits.findIndex((commit) => commit.oid === primaryCommit.oid)
    : -1;
  const selectedInHistoryOrder = repository.commits.filter((commit) =>
    selectedOids.includes(commit.oid),
  );
  const selectedAreContiguousFirstParent =
    selectedInHistoryOrder.length === selectedOids.length &&
    selectedInHistoryOrder.every((commit, index) => {
      const older = selectedInHistoryOrder[index + 1];
      return !older || commit.parents[0] === older.oid;
    });
  const availability = useMemo(
    () =>
      deriveActionAvailability({
        selectedCommits,
        currentBranch: repository.snapshot.currentBranch ?? undefined,
        headOid: repository.snapshot.headOid ?? undefined,
        upstream: repository.snapshot.upstream ?? undefined,
        selectedIsAncestorOfHead: primaryIndex >= 0,
        selectedIsAheadOfUpstream: primaryIndex >= 0 && primaryIndex < repository.status.ahead,
        selectedAreContiguousFirstParent,
        selectedIncludesMerge: selectedCommits.some((commit) => commit.parents.length > 1),
        hasChild: Boolean(
          primaryCommit &&
          repository.commits.some((commit) => commit.parents.includes(primaryCommit.oid)),
        ),
        repositoryHasCommits: repository.snapshot.hasCommits,
        operationInProgress: repository.snapshot.operation !== null,
      }),
    [
      primaryCommit,
      primaryIndex,
      repository.commits,
      repository.snapshot,
      repository.status.ahead,
      selectedCommits,
      selectedAreContiguousFirstParent,
    ],
  );

  useEffect(() => {
    if (sessionLoading || selectedOids.length === 0) return;
    const validOids = selectedOids.filter((oid) =>
      repository.commits.some((commit) => commit.oid === oid),
    );
    if (validOids.length !== selectedOids.length) setSelectedOids(validOids);
  }, [repository.commits, selectedOids, sessionLoading, setSelectedOids]);

  useEffect(() => {
    setChangeSelection((current) => reconcileChangeSelection(current, workingEntries));
  }, [workingEntries, setChangeSelection]);

  useEffect(() => {
    setHistoryParentRevision(primaryCommit?.parents[0] ?? (primaryCommit ? EMPTY_TREE_OID : null));
  }, [primaryCommit?.oid, primaryCommit, setHistoryParentRevision]);

  useRepositoryPersistence({
    nextLogTabNumber,
    repositoryId: repository.snapshot.id,
    repositoryName: repository.snapshot.name,
  });
  useRepositoryNotifications({
    sessionActivity,
    sessionError,
    showNotifications,
    showShortcutConflictWarning,
  });
  useEffect(() => {
    if (!primaryCommitOid) {
      setCommitFiles([]);
      setCommitFilesLoading(false);
      return;
    }
    const cacheKey = `${repository.snapshot.id}:${primaryCommitOid}`;
    const cached = commitFilesCache.get(cacheKey);
    if (cached) {
      setCommitFiles(cached);
      setCommitFilesLoading(false);
      return;
    }
    let active = true;
    const load = async (): Promise<void> => {
      setCommitFilesLoading(true);
      try {
        const files = await sessionLoadCommitFiles(primaryCommitOid);
        if (active) {
          cacheCommitFiles(cacheKey, files);
          setCommitFiles(files);
        }
      } catch (error) {
        console.warn("Could not load commit files", error);
        if (active) setCommitFiles([]);
      } finally {
        if (active) setCommitFilesLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    primaryCommitOid,
    repository.snapshot.id,
    sessionLoadCommitFiles,
    setCommitFiles,
    setCommitFilesLoading,
  ]);

  useEffect(() => {
    setHistorySelectedPath((current) => {
      if (current && commitFiles.some((file) => file.path === current)) {
        return current;
      }
      return commitFiles[0]?.path ?? null;
    });
  }, [commitFiles, setHistorySelectedPath]);

  useEffect(() => {
    const file = commitFiles.find((candidate) => candidate.path === historySelectedPath);
    if (!primaryCommit || !file || !historyParentRevision) {
      setHistoryDiff({ patch: "", loading: false });
      return;
    }
    if (file.binary || file.submodule) {
      setHistoryDiff({ patch: "", loading: false });
      return;
    }
    let active = true;
    const load = async (): Promise<void> => {
      setHistoryDiff((current) => ({ ...current, loading: true }));
      try {
        const patch = await sessionLoadCommitDiff(
          primaryCommit,
          file.path,
          nativeDiffOptions(diffPreferences),
          historyParentRevision,
        );
        if (active) setHistoryDiff({ patch, loading: false });
      } catch (error) {
        if (active) {
          setHistoryDiff({
            patch: `Unable to load diff: ${String(error)}`,
            loading: false,
          });
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    commitFiles,
    historyParentRevision,
    historySelectedPath,
    primaryCommit,
    sessionLoadCommitDiff,
    diffPreferences,
    setHistoryDiff,
  ]);

  useEffect(() => {
    const entry = workingEntries.find(
      (candidate) =>
        changeSelection?.path === candidate.selection.path &&
        changeSelection.layer === candidate.selection.layer,
    );
    if (!entry || entry.file.status === "conflicted" || entry.file.binary || entry.file.submodule) {
      setChangeDiff({ patch: "", loading: false });
      return;
    }
    let active = true;
    const load = async (): Promise<void> => {
      setChangeDiff((current) => ({ ...current, loading: true }));
      try {
        const patch = await sessionLoadWorkingDiff(
          entry.file.path,
          entry.selection.layer === "index",
          nativeDiffOptions(diffPreferences),
        );
        if (active) setChangeDiff({ patch, loading: false });
      } catch (error) {
        if (active) {
          setChangeDiff({
            patch: `Unable to load diff: ${String(error)}`,
            loading: false,
          });
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [changeSelection, sessionLoadWorkingDiff, workingEntries, setChangeDiff, diffPreferences]);

  useEffect(() => {
    const file = commitFiles.find((candidate) => candidate.path === historySelectedPath);
    if (!primaryCommit || !file?.submodule || !historyParentRevision) {
      setHistorySubmodule({ value: null, loading: false });
      return;
    }
    let active = true;
    setHistorySubmodule((current) => ({ ...current, loading: true }));
    void sessionLoadSubmoduleDiff(
      { kind: "revision", revision: historyParentRevision },
      { kind: "revision", revision: primaryCommit.oid },
      file.path,
    ).then(
      (value) => {
        if (active) setHistorySubmodule({ value, loading: false });
      },
      () => {
        if (active) setHistorySubmodule({ value: null, loading: false });
      },
    );
    return () => {
      active = false;
    };
  }, [
    commitFiles,
    historyParentRevision,
    historySelectedPath,
    primaryCommit,
    sessionLoadSubmoduleDiff,
    setHistorySubmodule,
  ]);

  useEffect(() => {
    const entry = workingEntries.find(
      (candidate) =>
        changeSelection?.path === candidate.selection.path &&
        changeSelection.layer === candidate.selection.layer,
    );
    if (!entry?.file.submodule) {
      setChangeSubmodule({ value: null, loading: false });
      return;
    }
    const before: FileSource =
      entry.selection.layer === "index"
        ? {
            kind: "revision",
            revision: repository.snapshot.headOid ?? EMPTY_TREE_OID,
          }
        : { kind: "index" };
    const after: FileSource =
      entry.selection.layer === "index" ? { kind: "index" } : { kind: "workingTree" };
    let active = true;
    setChangeSubmodule((current) => ({ ...current, loading: true }));
    void sessionLoadSubmoduleDiff(before, after, entry.file.path).then(
      (value) => {
        if (active) setChangeSubmodule({ value, loading: false });
      },
      () => {
        if (active) setChangeSubmodule({ value: null, loading: false });
      },
    );
    return () => {
      active = false;
    };
  }, [
    changeSelection,
    repository.snapshot.headOid,
    sessionLoadSubmoduleDiff,
    workingEntries,
    setChangeSubmodule,
  ]);

  useEffect(() => {
    if (!primaryCommitOid || !isElectronRuntime()) {
      setCommitSignature(undefined);
      return;
    }
    let active = true;
    void sessionLoadCommitSignature(primaryCommitOid).then(
      (signature) => active && setCommitSignature(signature),
      () => active && setCommitSignature(undefined),
    );
    return () => {
      active = false;
    };
  }, [primaryCommitOid, sessionLoadCommitSignature, setCommitSignature]);

  useEffect(() => {
    if (selectedCommits.length !== 2) {
      setRevisionComparison(undefined);
      return;
    }
    const [to, from] = selectedCommits;
    if (!from || !to) return;
    let active = true;
    setRevisionComparison({
      from: from.oid,
      to: to.oid,
      patch: "",
      loading: true,
    });
    void sessionLoadRevisionDiff(from.oid, to.oid, nativeDiffOptions(diffPreferences)).then(
      (patch) => {
        if (active) {
          setRevisionComparison({
            from: from.oid,
            to: to.oid,
            patch,
            loading: false,
          });
        }
      },
      (error) => {
        if (active) {
          setRevisionComparison({
            from: from.oid,
            to: to.oid,
            patch: `Unable to compare revisions: ${String(error)}`,
            loading: false,
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [selectedCommits, sessionLoadRevisionDiff, setRevisionComparison, diffPreferences]);

  const openStashDiff = useCallback(
    (stash: StashEntry): void => {
      const file: FileChange = {
        path: stash.selector,
        status: "modified",
        staged: false,
        worktree: false,
      };
      setDiffState({ file, patch: "", loading: true, mode: "readOnly" });
      const load = async (): Promise<void> => {
        try {
          setDiffState({
            file,
            patch: await sessionLoadStashPatch(stash.selector),
            loading: false,
            mode: "readOnly",
          });
        } catch (error) {
          setDiffState({
            file,
            patch: `Unable to load stash: ${String(error)}`,
            loading: false,
            mode: "readOnly",
          });
        }
      };
      void load();
    },
    [sessionLoadStashPatch, setDiffState],
  );

  const selectRelative = useCallback(
    (direction: "parent" | "child"): void => {
      if (!primaryCommit) return;
      const oid =
        direction === "parent"
          ? primaryCommit.parents[0]
          : repository.commits.find((commit) => commit.parents.includes(primaryCommit.oid))?.oid;
      if (oid && commitsByOid.has(oid)) setSelectedOids([oid]);
    },
    [commitsByOid, primaryCommit, repository.commits, setSelectedOids],
  );

  const runAction = useCallback(
    async (action: keyof ActionAvailability): Promise<void> => {
      setContextPosition(undefined);
      if (!primaryCommit || !availability[action]) return;
      if (action === "copyRevision") {
        await navigator.clipboard.writeText(primaryCommit.oid);
        setToast(`Copied ${primaryCommit.oid.slice(0, 8)}`);
      } else if (action === "goToParent") selectRelative("parent");
      else if (action === "goToChild") selectRelative("child");
      else if (action === "cherryPick") {
        await sessionExecuteOperation({
          kind: "cherryPick",
          revisions: selectedCommits.map((commit) => commit.oid),
          noCommit: false,
        });
      } else if (action === "revert") {
        await sessionExecuteOperation({
          kind: "revert",
          revisions: selectedCommits.map((commit) => commit.oid),
          noCommit: false,
        });
      } else if (action === "reset") {
        const accepted = await dialog.confirm({
          title: `Reset ${repository.snapshot.currentBranch ?? "HEAD"}?`,
          description:
            "A mixed reset moves the branch and resets the index while keeping working-tree changes.",
          impact: `Target: ${primaryCommit.oid.slice(0, 12)}`,
          confirmLabel: "Reset branch",
          dangerous: true,
        });
        if (accepted) {
          const mode = await dialog.input({
            title: "Choose reset mode",
            label: "Mode: soft, mixed, hard, or keep",
            initialValue: "mixed",
            description:
              "Hard discards index and working-tree changes; keep refuses to overwrite local changes.",
          });
          if (!mode || !["soft", "mixed", "hard", "keep"].includes(mode)) {
            if (mode) setToast("Reset mode must be soft, mixed, hard, or keep.");
            return;
          }
          await sessionExecuteOperation({
            kind: "reset",
            revision: primaryCommit.oid,
            mode: mode as "soft" | "mixed" | "hard" | "keep",
          });
        }
      } else if (action === "undoCommit") {
        const accepted = await dialog.confirm({
          title: "Undo the last commit?",
          description:
            "Moves HEAD to its parent with a soft reset, keeping all committed changes staged.",
          impact: `${primaryCommit.oid.slice(0, 8)} ${primaryCommit.subject}`,
          confirmLabel: "Undo commit",
          dangerous: true,
        });
        if (accepted) await sessionExecuteOperation({ kind: "undoCommit" });
      } else if (action === "reword") {
        const message = await dialog.input({
          title: "Reword commit",
          label: "New commit message",
          initialValue: primaryCommit.subject,
          description: "Interactive rebase rewrites this commit and all descendants.",
        });
        if (message)
          await sessionExecuteOperation({
            kind: "rewordCommit",
            revision: primaryCommit.oid,
            message,
          });
      } else if (action === "fixup") {
        await sessionExecuteOperation({
          kind: "createFixupCommit",
          revision: primaryCommit.oid,
        });
      } else if (action === "squashInto") {
        await sessionExecuteOperation({
          kind: "createSquashCommit",
          revision: primaryCommit.oid,
        });
      } else if (action === "newBranch") {
        const name = await dialog.input({
          title: "Create branch",
          label: "Branch name",
          initialValue: "feat/",
          description: `Starts at ${primaryCommit.oid.slice(0, 12)} without checking it out.`,
        });
        if (name) {
          await sessionExecuteOperation({
            kind: "createBranch",
            name,
            startPoint: primaryCommit.oid,
            checkout: false,
          });
        }
      } else if (action === "newTag") {
        const name = await dialog.input({
          title: "Create tag",
          label: "Tag name",
          initialValue: "v0.1.0",
          description: `Creates a lightweight tag at ${primaryCommit.oid.slice(0, 12)}.`,
        });
        if (name) {
          await sessionExecuteOperation({
            kind: "createTag",
            name,
            revision: primaryCommit.oid,
            message: null,
          });
        }
      } else if (action === "pushUpTo") {
        onOpenPush(primaryCommit.oid);
      } else if (action === "interactiveRebase") {
        setHistoryRewrite({
          fromRevision: primaryCommit.oid,
          squashOids: [],
        });
      } else if (action === "viewInBrowser") {
        const url = repository.snapshot.remoteUrl
          ? commitUrl(repository.snapshot.remoteUrl, primaryCommit.oid)
          : undefined;
        if (!url) setToast("The origin remote is not a supported GitHub or GitLab URL.");
        else await openExternalUrl(url);
      } else if (action === "createPatch") {
        const targetPath = await selectPatchExportPath(`${primaryCommit.oid.slice(0, 8)}.patch`);
        if (!targetPath) return;
        const result = await sessionExportPatch(
          selectedCommits.map((commit) => commit.oid),
          targetPath,
        );
        setToast(
          `Exported ${result.commitCount} commit(s) · ${result.sizeBytes.toLocaleString()} bytes`,
        );
      } else if (action === "copyPatch") {
        const patch = await sessionCreatePatchText(selectedCommits.map((commit) => commit.oid));
        await navigator.clipboard.writeText(patch);
        setToast(`Copied patch · ${patch.length.toLocaleString()} characters`);
      } else if (action === "showRepositoryAtRevision") {
        openInspector({
          revision: primaryCommit.oid,
          source: { kind: "revision", revision: primaryCommit.oid },
          tab: "tree",
        });
      } else if (action === "compareVersions") {
        setRepositoryViewMode("history");
      } else if (action === "drop") {
        const accepted = await dialog.confirm({
          title: `Drop ${selectedCommits.length} commit(s)?`,
          description: "Interactive rebase rewrites this branch and all descendant commit IDs.",
          impact: selectedCommits
            .map((commit) => `${commit.oid.slice(0, 8)} ${commit.subject}`)
            .join("\n"),
          confirmLabel: "Rewrite and drop",
          dangerous: true,
        });
        if (accepted) {
          await sessionExecuteOperation({
            kind: "dropCommits",
            revisions: selectedCommits.map((commit) => commit.oid),
          });
        }
      } else if (action === "squash") {
        const selected = new Set(selectedCommits.map((commit) => commit.oid));
        const oldest = repository.commits.findLast((commit) => selected.has(commit.oid));
        if (oldest) {
          setHistoryRewrite({
            fromRevision: oldest.oid,
            squashOids: selectedCommits.map((commit) => commit.oid),
          });
        }
      }
    },
    [
      availability,
      openInspector,
      primaryCommit,
      repository.snapshot,
      selectRelative,
      selectedCommits,
      onOpenPush,
      dialog,
      repository.commits,
      setRepositoryViewMode,
      setContextPosition,
      setToast,
      setHistoryRewrite,
      sessionExportPatch,
      sessionCreatePatchText,
      sessionExecuteOperation,
    ],
  );

  useRepositoryContentLoader({
    loadFile: sessionReadFile,
    loadFilePreview: sessionReadFilePreview,
    primaryCommit,
    repository,
    workingEntries,
  });
  const selectRef = (ref: Ref): void => {
    setSelectedRef(ref.name);
    if (commitsByOid.has(ref.oid)) setSelectedOids([ref.oid]);
  };

  const openConflict = useCallback(
    (file: FileChange): void => {
      const load = async (): Promise<void> => {
        try {
          setConflictContent(await sessionReadConflict(file.path));
        } catch (error) {
          setToast(`Unable to read conflict: ${String(error)}`);
        }
      };
      void load();
    },
    [sessionReadConflict, setConflictContent, setToast],
  );

  const repositoryBusy = sessionLoading || sessionActivity?.status === "running";
  const repositoryAvailability = (): ReturnType<CommandDefinition["availability"]> =>
    safeMode
      ? commandDisabled("Git changes and executable tools are unavailable in Safe Mode.")
      : repositoryBusy
        ? commandDisabled(sessionActivity?.label ?? "Repository data is loading.")
        : COMMAND_ENABLED;
  const inspectorTabKeys = useMemo(
    () => inspectorTabs.map((tab) => inspectorKey(tab)),
    [inspectorTabs],
  );
  const activeInspectorIndex = activeInspectorKey
    ? inspectorTabKeys.indexOf(activeInspectorKey)
    : -1;
  const activateRelativeInspector = useCallback(
    (offset: -1 | 1): void => {
      if (activeInspectorIndex < 0 || inspectorTabKeys.length < 2) return;
      const nextIndex =
        (activeInspectorIndex + offset + inspectorTabKeys.length) % inspectorTabKeys.length;
      setActiveInspectorKey(inspectorTabKeys[nextIndex]);
      setRepositoryViewMode("history");
    },
    [activeInspectorIndex, inspectorTabKeys, setRepositoryViewMode, setActiveInspectorKey],
  );
  const editorTabAvailability = (): ReturnType<CommandDefinition["availability"]> =>
    inspector ? COMMAND_ENABLED : commandDisabled("There is no active file editor tab.");
  const readOnlyInspectorKeys = useMemo(
    () =>
      inspectorTabs
        .filter(
          (tab) =>
            (tab.scratchId === undefined && tab.source.kind !== "workingTree") ||
            tab.tab === "tree",
        )
        .map((tab) => inspectorKey(tab)),
    [inspectorTabs],
  );
  const dispatchEditorSearch = useCallback(
    (
      action:
        | "find"
        | "replace"
        | "next"
        | "previous"
        | "nextWord"
        | "previousWord"
        | "selectionScope",
    ): boolean => {
      const event = new CustomEvent("git-client:editor-search", {
        cancelable: true,
        detail: { action },
      });
      return !window.dispatchEvent(event);
    },
    [],
  );
  const dispatchEditorAction = useCallback((action: string): boolean => {
    return !window.dispatchEvent(
      new CustomEvent("git-client:editor-action", {
        cancelable: true,
        detail: { action },
      }),
    );
  }, []);
  const editorActionAvailability = useCallback(
    (requiresEditable: boolean): ReturnType<CommandDefinition["availability"]> => {
      const activeEditor =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.closest<HTMLElement>(".cm-editor")
          : null;
      if (activeEditor === null) {
        return commandDisabled("Place the caret in a file editor first.");
      }
      const editable =
        activeEditor.querySelector<HTMLElement>(".cm-content")?.contentEditable === "true";
      return !requiresEditable || editable
        ? COMMAND_ENABLED
        : commandDisabled("The active file editor is read-only.");
    },
    [],
  );
  const focusCurrentSearch = useCallback((): void => {
    if (dispatchEditorSearch("find")) return;
    const focusedDiff =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.closest<HTMLElement>("[data-diff-viewer]")
        : null;
    const search =
      focusedDiff?.querySelector<HTMLInputElement>("[data-command-search]") ??
      document.querySelector<HTMLInputElement>(
        repositoryViewMode === "history"
          ? '[data-command-search="history"]'
          : '[data-command-search="changes"]',
      ) ??
      document.querySelector<HTMLInputElement>("[data-command-search]");
    search?.focus();
    search?.select();
  }, [dispatchEditorSearch, repositoryViewMode]);
  const { requestShareProject } = useRepositoryHostingCoordinator({
    remotes: sessionRemotes,
    setShareExistingRemotes,
    setShareProjectProvider,
  });
  useRepositoryCommands({
    setScratchFileChooserOpen,
    setExportToHtmlOpen,
    inspector,
    projectFiles,
    setRepositoryViewMode,
    setBookmarksOpen,
    setProjectOpen,
    bookmarksOpen,
    projectOpen,
    repositoryViewMode,
    logTabIds,
    setLogTabIds,
    setLogOpen,
    setActiveLogTabId,
    setActiveInspectorKey,
    logOpen,
    openGitLogTab,
    focusCurrentSearch,
    dispatchEditorSearch,
    dispatchEditorAction,
    editorStatus,
    editorActionAvailability,
    activeToolWindow,
    setBottomCollapsed,
    setMaximizedToolWindow,
    setActiveToolWindow,
    bottomPanelTab,
    terminalTabCount,
    setSideToolWindowWidth,
    setBottomPanelHeight,
    notifications,
    setNotifications,
    balloonId,
    setBalloonId,
    setNotificationOpen,
    notificationOpen,
    openPaletteFor,
    setProjectSearchInitialQuery,
    setProjectSearchSurface,
    navigateInspectorHistory,
    navigationIndex,
    navigationHistory,
    setReplaceInFilesOpen,
    setRecentFindUsagesOpen,
    onOpenSettings,
    setCodeAnalysisRequest,
    runCodeCleanup,
    setRunInspectionOpen,
    setInspectionResults,
    setStackTraceOpen,
    setBottomPanelTab,
    toggleCurrentBookmark,
    beginMnemonicBookmark,
    bookmarks,
    openLineBookmark,
    setBookmarksPopupMode,
    productSettings,
    requestCloseInspector,
    editorTabAvailability,
    activateRelativeInspector,
    inspectorTabKeys,
    setPreviewInspectorKey,
    previewInspectorKey,
    activeInspectorKey,
    requestCloseInspectors,
    dirtyInspectorKeys,
    pinnedInspectorKeys,
    activeInspectorIndex,
    readOnlyInspectorKeys,
    dialog,
    session,
    repositoryAvailability,
    jumpToLastToolWindow,
    setProcessesOpen,
    processesOpen,
    changeSelection,
    historySelectedPath,
    repository,
    onOpenPush,
    requestOpenRepositoryTool,
    primaryCommit,
    setToast,
    workingEntries,
    requestShareProject,
    createPatchFromLocalChanges,
    applyPatchFromFile,
    applyPatchFromClipboard,
    setVcsOperationsOpen,
    untrackedPaths,
    hasTrackedWorkingChanges,
    rollbackVcsFile,
    vcsFileChange,
    showVcsFileChanges,
    vcsFileEntry,
    vcsFilePath,
    compareVcsFile,
    vcsFileVersioned,
    openVcsFileTab,
    conflictedFile,
    openConflict,
    runAction,
    availability,
    maximizedToolWindow,
    repositoryBusy,
  });

  const vcsOperationGroups = useRepositoryPalette({
    hasTrackedWorkingChanges,
    vcsFileEntry,
    vcsFileChange,
    vcsFileVersioned,
    repository,
    workingEntries,
    session,
    untrackedPaths,
    conflictedFile,
    vcsFilePath,
    recentInspectors,
    projectFiles,
    setRepositoryViewMode,
    openInspector,
    scratchFiles,
    openScratchFile,
    primaryCommit,
    availability,
    setHistoryRewrite,
    selectRef,
    setSelectedOids,
    setChangeSelection,
  });

  useDismissLayer(
    useMemo(
      () => ({
        id: "commit-context-menu",
        priority: 110,
        active: contextPosition !== undefined,
        dismiss: () => setContextPosition(undefined),
      }),
      [contextPosition, setContextPosition],
    ),
  );
  useDismissLayer(
    useMemo(
      () => ({
        id: "standalone-diff",
        priority: 60,
        active: diffState !== undefined,
        dismiss: () => setDiffState(undefined),
      }),
      [diffState, setDiffState],
    ),
  );
  useDismissLayer(
    useMemo(
      () => ({
        id: "history-multi-selection",
        priority: 20,
        active: selectedOids.length > 1,
        dismiss: () => setSelectedOids(primaryCommitOid ? [primaryCommitOid] : []),
      }),
      [primaryCommitOid, selectedOids.length, setSelectedOids],
    ),
  );

  const abortInProgressOperation = async (): Promise<void> => {
    const operation = repository.snapshot.operation;
    if (!operation || operation === "bisect") return;
    await sessionAbortOperation(operation);
  };

  const commitToolWindow = (
    <ChangesWorkspace
      afterContent={changeContent.after}
      afterPreview={changePreview.after}
      beforeContent={changeContent.before}
      beforePreview={changePreview.before}
      submoduleDiff={changeSubmodule.value}
      commitRailWidth={commitRailWidth}
      navigatorWidth={changesNavigatorWidth}
      changelists={sessionChangelists}
      diffLoading={
        changeDiff.loading ||
        changeContent.loading ||
        changePreview.loading ||
        changeSubmodule.loading
      }
      draft={commitDraft}
      entries={workingEntries}
      onCloseToolWindow={() => setRepositoryViewMode("history")}
      onCommitChangelist={async (changelistId, message, amend, signOff, gpgSign) => {
        await sessionCommitChangelist(changelistId, message, amend, signOff, gpgSign);
      }}
      onDeleteChangelist={sessionDeleteChangelist}
      onDraftChange={setCommitDraft}
      onInspectFile={(file, layer, tab) => {
        setRepositoryViewMode("history");
        openInspector({
          revision: repository.snapshot.headOid ?? "HEAD",
          source: layer === "index" ? { kind: "index" } : { kind: "workingTree" },
          path: file.path,
          tab,
        });
      }}
      onOpenConflict={openConflict}
      onOpenPush={() => onOpenPush()}
      onCommitRailWidthChange={(width) =>
        setCommitRailWidth(Math.min(480, Math.max(280, Math.round(width))))
      }
      onNavigatorWidthChange={(width) =>
        setChangesNavigatorWidth(Math.min(420, Math.max(190, Math.round(width))))
      }
      onOpenExternally={(file) => sessionOpenWorkingTreeFile(file.path)}
      onCommitOperation={(operation) => sessionExecuteOperation(operation, true)}
      onOperation={sessionExecuteOperation}
      onPreCommitCheck={sessionPreCommitCheck}
      onPreferencesChange={setDiffPreferences}
      onSaveChangelist={sessionSaveChangelist}
      onSelectionChange={setChangeSelection}
      patch={changeDiff.patch}
      preferences={diffPreferences}
      selection={changeSelection}
      status={repository.status}
      toolWindow
    />
  );
  const leftToolWindowOpen = repositoryViewMode === "changes" || projectOpen || bookmarksOpen;
  const hasEditorTabs = logOpen || inspectorTabs.length > 0;
  const activeEditorTabValue =
    activeInspectorKey === undefined ? `log:${activeLogTabId}` : `inspector:${activeInspectorKey}`;
  const closeInspectorEditorTab = useCallback(
    async (key: string): Promise<void> => {
      const closingIndex = inspectorTabs.findIndex((candidate) => inspectorKey(candidate) === key);
      const remaining = inspectorTabs.filter((candidate) => inspectorKey(candidate) !== key);
      const replacement =
        remaining[Math.min(Math.max(closingIndex, 0), remaining.length - 1)] ?? remaining.at(-1);
      const fallbackValue = replacement
        ? `inspector:${inspectorKey(replacement)}`
        : logOpen
          ? `log:${activeLogTabId}`
          : undefined;
      const wasActive = activeInspectorKey === key;

      await requestCloseInspector(key);
      if (!wasActive) return;
      window.requestAnimationFrame(() => {
        const retainedTab = document.getElementById(
          editorTabDomId(editorTabsId, `inspector:${key}`),
        );
        if (retainedTab) {
          retainedTab.focus();
          return;
        }
        if (fallbackValue) {
          document.getElementById(editorTabDomId(editorTabsId, fallbackValue))?.focus();
          return;
        }
        document.querySelector<HTMLElement>("[data-open-git-log]")?.focus();
      });
    },
    [
      activeInspectorKey,
      activeLogTabId,
      editorTabsId,
      inspectorTabs,
      logOpen,
      requestCloseInspector,
    ],
  );
  const { navigationStatus, terminalFocused } = useRepositoryWorkspaceLifecycle({
    bottomCollapsed,
    bottomPanelTab,
    editorStatus,
    hasEditorTabs,
    onChromeModeChange,
    productSettings,
    repository,
    safeMode,
    sessionLoading,
    setBottomCollapsed,
    setHistoryRewrite,
    setRepositoryViewMode,
    setShareExistingRemotes,
    setShareProjectProvider,
  });

  return (
    <>
      <RepositoryOverlays
        activity={sessionActivity}
        cancelActivity={sessionCancelActivity}
        chooseBookmarkMnemonic={chooseBookmarkMnemonic}
        createScratchFile={createScratchFile}
        executeCommand={executeCommand}
        exportToHtml={exportToHtml}
        inspector={inspector}
        openCodeIssue={openCodeIssue}
        openInspector={openInspector}
        openLineBookmark={openLineBookmark}
        openStackFrame={openStackFrame}
        productSettings={productSettings}
        replaceInProjectFiles={replaceInProjectFiles}
        repository={repository}
        runCodeCleanup={runCodeCleanup}
        runCodeInspection={runCodeInspection}
        searchProjectText={sessionSearchProjectText}
        vcsOperationGroups={vcsOperationGroups}
      />
      <RepositoryNavigationSurface
        navigationStatus={navigationStatus}
        productSettings={productSettings}
      />
      <Tabs
        className="contents"
        onValueChange={(value) => {
          if (value.startsWith("log:")) {
            setActiveLogTabId(value.slice("log:".length));
            setActiveInspectorKey(undefined);
            setRepositoryViewMode("history");
            return;
          }
          if (value.startsWith("inspector:")) {
            setActiveInspectorKey(value.slice("inspector:".length));
          }
        }}
        value={hasEditorTabs ? activeEditorTabValue : null}
      >
        {hasEditorTabs && (
          <div
            className={`commandbar [html[data-tool-window-bars-visible=false]_&]:left-0! [html[data-tool-window-bars-visible=false]_&]:right-0! [html[data-distraction-free-mode=true]_&]:hidden! [html[data-presentation-mode=true]_&]:hidden! [html[data-navigation-bar=top]_&]:top-[59px]! [align-items:center] [background:var(--card)] [border-bottom:1px_solid_var(--border)] rounded-t-lg rounded-b-none [display:flex] [gap:3px] [height:32px] [left:var(--editor-left,_39px)] [padding:0_5px_0_0] [position:absolute] [right:35px] [top:35px] [z-index:8] [&>_button]:[align-items:center] [&>_button]:[background:transparent] [&>_button]:[display:flex] [&>_button]:[gap:6px] [&>_button]:[height:30px] [&>_button]:[padding:0_7px] [&>_button:hover]:[background:var(--muted)] [&>_button_>_em]:[align-items:center] [&>_button_>_em]:[background:var(--primary)] [&>_button_>_em]:rounded-lg [&>_button_>_em]:[color:var(--primary-foreground)] [&>_button_>_em]:[display:inline-flex] [&>_button_>_em]:[font-size:9px] [&>_button_>_em]:[font-style:normal] [&>_button_>_em]:[height:15px] [&>_button_>_em]:[justify-content:center] [&>_button_>_em]:[min-width:15px] [&>_button_>_em]:[padding:0_4px] commandbar rounded-t-lg rounded-b-none [&>_button_>_em]:rounded-lg`}
            style={
              {
                "--editor-left":
                  leftToolWindowOpen && !sessionLoading
                    ? `${(repositoryViewMode === "changes" ? 302 : sideToolWindowWidth) + 42}px`
                    : "39px",
              } as CSSProperties
            }
          >
            <TabsList
              render={
                <nav
                  aria-label={!inspector ? "Log" : "Editor tabs"}
                  className={`editorTabs [align-items:center] [align-self:stretch] [display:flex] [&_button[aria-current=page]]:rounded-sm [&_button[aria-current=page]]:bg-muted! [&_button[aria-current=page]]:text-foreground! [&_button[aria-current=page]]:shadow-[inset_0_0_0_1px_var(--input)]! [&_button:hover:not([aria-current=page])]:rounded-sm [&_button:hover:not([aria-current=page])]:bg-overlay-hover editorTabs`}
                />
              }
            >
              {logOpen &&
                logTabIds.map((tabId, index) => {
                  const label = index === 0 ? "Log" : `Log ${index + 1}`;
                  const value = `log:${tabId}`;
                  return (
                    <span
                      className={cn(
                        "group",
                        `workspaceTab [display:inline-flex] [flex:0_0_auto] [&_em]:[color:var(--destructive)] [&_em]:[font-size:15px] [&_em]:[font-style:normal] [&_em]:[line-height:1] data-[preview=true]:[&>button:first-child]:italic data-[pinned=true]:[&>button:first-child]:after:size-1 data-[pinned=true]:[&>button:first-child]:after:rounded-full data-[pinned=true]:[&>button:first-child]:after:bg-current data-[pinned=true]:[&>button:first-child]:after:opacity-55 data-[pinned=true]:[&>button:first-child]:after:content-[""] workspaceTab`,
                      )}
                      key={tabId}
                      role="presentation"
                    >
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <TabsTrigger
                              aria-controls={editorPanelDomId(editorTabsId, value)}
                              aria-keyshortcuts="Delete"
                              aria-label={label}
                              id={editorTabDomId(editorTabsId, value)}
                              onKeyDown={(event) => {
                                if (event.key !== "Delete" && event.key !== "Backspace") return;
                                event.preventDefault();
                                event.stopPropagation();
                                closeLogTab(tabId);
                              }}
                              render={
                                <Button
                                  className="h-[32px]! max-w-[210px] gap-1! overflow-hidden px-2! py-0! text-xs! text-ellipsis text-muted-foreground data-active:bg-accent data-active:text-foreground"
                                  variant="ghost"
                                  size="xs"
                                />
                              }
                              value={value}
                            >
                              <Icon name="branch" size={14} />
                              <span className="truncate">{label}</span>
                              <span
                                aria-hidden="true"
                                className="inline-flex h-6 shrink-0 items-center justify-center rounded-md px-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                                data-close-tab={value}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  closeLogTab(tabId);
                                }}
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                              >
                                <Icon name="close" size={10} />
                              </span>
                            </TabsTrigger>
                          }
                        />
                        <TooltipContent>{`${label} · Delete to close`}</TooltipContent>
                      </Tooltip>
                    </span>
                  );
                })}
              {inspectorTabs.map((tab) => {
                const key = inspectorKey(tab);
                const label = tab.path?.split("/").at(-1) ?? "Repository";
                const value = `inspector:${key}`;
                return (
                  <span
                    className={cn(
                      "group",
                      `workspaceTab [display:inline-flex] [flex:0_0_auto] [&_em]:[color:var(--destructive)] [&_em]:[font-size:15px] [&_em]:[font-style:normal] [&_em]:[line-height:1] data-[preview=true]:[&>button:first-child]:italic data-[pinned=true]:[&>button:first-child]:after:size-1 data-[pinned=true]:[&>button:first-child]:after:rounded-full data-[pinned=true]:[&>button:first-child]:after:bg-current data-[pinned=true]:[&>button:first-child]:after:opacity-55 data-[pinned=true]:[&>button:first-child]:after:content-[""] workspaceTab`,
                    )}
                    data-pinned={pinnedInspectorKeys.has(key)}
                    data-preview={previewInspectorKey === key}
                    key={key}
                    role="presentation"
                  >
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <TabsTrigger
                            aria-controls={editorPanelDomId(editorTabsId, value)}
                            aria-keyshortcuts="Delete"
                            aria-label={`Editor ${tab.path ?? "Repository"}`}
                            id={editorTabDomId(editorTabsId, value)}
                            onKeyDown={(event) => {
                              if (event.key !== "Delete" && event.key !== "Backspace") return;
                              event.preventDefault();
                              event.stopPropagation();
                              void closeInspectorEditorTab(key);
                            }}
                            render={
                              <Button
                                className={cn(
                                  "h-[32px]! max-w-[210px] gap-1! overflow-hidden px-2! py-0! text-xs! text-ellipsis text-muted-foreground data-active:bg-accent data-active:text-foreground",
                                )}
                                variant="ghost"
                                size="xs"
                              />
                            }
                            value={value}
                          >
                            <Icon name={tab.tab === "tree" ? "folder" : "file"} size={14} />
                            <span className="truncate">{label}</span>
                            {dirtyInspectorKeys.has(key) && <span aria-label="Modified">*</span>}
                            <span
                              aria-hidden="true"
                              className="inline-flex h-6 shrink-0 items-center justify-center rounded-md px-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                              data-close-tab={value}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void closeInspectorEditorTab(key);
                              }}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                            >
                              <Icon name="close" size={10} />
                            </span>
                          </TabsTrigger>
                        }
                      />
                      <TooltipContent>{`${tab.path ?? "Repository"} · Delete to close`}</TooltipContent>
                    </Tooltip>
                  </span>
                );
              })}
            </TabsList>
            <span className={`editorToolbarSpacer [flex:1] editorToolbarSpacer`} />
            {sessionStale && <StatePill>Changed</StatePill>}
            {repository.snapshot.isShallow && <StatePill>Shallow</StatePill>}
            {repository.snapshot.isBare && <StatePill>Bare</StatePill>}
            {repository.snapshot.operation && (
              <StatePill className="gap-1" tone="destructive">
                <Icon name="warning" size={13} />
                {repository.snapshot.operation} in progress
              </StatePill>
            )}
            {repository.snapshot.operation && repository.snapshot.operation !== "bisect" && (
              <>
                <Button
                  className={cn("h-6 px-2 text-xs")}
                  onClick={() =>
                    void sessionExecuteOperation({
                      kind: "continue",
                      operation: repository.snapshot.operation as
                        | "merge"
                        | "rebase"
                        | "cherryPick"
                        | "revert",
                    })
                  }
                  variant="secondary"
                  size="xs"
                >
                  Continue
                </Button>
                {(repository.snapshot.operation === "rebase" ||
                  repository.snapshot.operation === "cherryPick") && (
                  <Button
                    className={cn("h-6 px-2 text-xs")}
                    onClick={() =>
                      void sessionExecuteOperation({
                        kind: "skip",
                        operation: repository.snapshot.operation as "rebase" | "cherryPick",
                      })
                    }
                    variant="secondary"
                    size="xs"
                  >
                    Skip
                  </Button>
                )}
                <Button
                  className={cn("h-6 border-destructive px-2 text-xs shadow-xs")}
                  onClick={toVoidHandler(async () => {
                    const accepted = await dialog.confirm({
                      title: `Abort ${repository.snapshot.operation}?`,
                      description:
                        "Restores the state recorded before the in-progress Git operation.",
                      confirmLabel: "Abort operation",
                      dangerous: true,
                    });
                    if (
                      accepted &&
                      repository.snapshot.operation &&
                      repository.snapshot.operation !== "bisect"
                    ) {
                      await abortInProgressOperation();
                    }
                  })}
                  variant="destructive"
                  size="xs"
                >
                  Abort
                </Button>
              </>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="View Options"
                    className="h-6 w-[30px] flex-[0_0_30px] rounded-none border-y-0 border-r border-l-0 bg-transparent p-0 text-xs text-muted-foreground hover:text-accent-foreground"
                    onClick={() => void sessionReload()}
                    variant="outline"
                    size="xs"
                  >
                    <Icon name="more" size={16} />
                  </Button>
                }
              />
              <TooltipContent>View Options</TooltipContent>
            </Tooltip>
          </div>
        )}
        <main
          className={`workspace [grid-row:2_/_4] [min-height:0] [position:relative] [html[data-navigation-bar=top]_&]:pt-[29px]! workspace`}
          aria-busy={sessionLoading}
        >
          {sessionLoading ? (
            <RepositoryLoadingSkeleton />
          ) : (
            <div
              className={`workbench [display:grid] [grid-template-columns:39px_minmax(0,_1fr)_35px] [height:100%] [min-height:0] [min-width:0] [html[data-tool-window-bars-visible=false]_&]:grid-cols-[0_minmax(0,1fr)_0]! [html[data-distraction-free-mode=true]_&]:grid-cols-[0_minmax(0,1fr)_0]! [html[data-presentation-mode=true]_&]:grid-cols-[0_minmax(0,1fr)_0]! workbench`}
            >
              <RepositoryToolStripe
                bookmarksOpen={bookmarksOpen}
                changes={repository.status.changes.length}
                mode={repositoryViewMode}
                onModeChange={(mode) => {
                  if (mode === "changes") {
                    setProjectOpen(false);
                    setBookmarksOpen(false);
                    setRepositoryViewMode((current) =>
                      current === "changes" ? "history" : "changes",
                    );
                    return;
                  }
                  setRepositoryViewMode("history");
                }}
                onOpenGitConsole={() =>
                  window.dispatchEvent(new CustomEvent("git-client:open-git-console"))
                }
                onOpenBookmarks={() => {
                  setRepositoryViewMode("history");
                  setProjectOpen(false);
                  setBookmarksOpen((value) => !value);
                }}
                onOpenProject={() => {
                  if (repositoryViewMode === "changes") {
                    setRepositoryViewMode("history");
                    setProjectOpen(true);
                    setBookmarksOpen(false);
                    return;
                  }
                  if (bookmarksOpen) {
                    setBookmarksOpen(false);
                    setProjectOpen(true);
                    return;
                  }
                  setProjectOpen((value) => !value);
                }}
                projectOpen={projectOpen && repositoryViewMode === "history"}
                readOnly={safeMode}
                terminalFocused={terminalFocused}
              />
              <div
                className={`${`workbenchSurface [background:var(--background)] [display:grid] [grid-template-rows:minmax(0,_1fr)_auto] [min-height:0] [min-width:0] workbenchSurface`} ${maximizedToolWindow === "bottom" ? `maximizedBottomTool [grid-template-rows:minmax(0,_1fr)] [&>_.workbenchContent]:[display:none] [&>_[data-tool-window-position=bottom]]:[height:100%!important] maximizedBottomTool` : ""}`}
              >
                <div
                  className={`${`workbenchContent [display:grid] [gap:3px] [grid-template-columns:minmax(0,_1fr)] [min-height:0] [min-width:0] [html[data-distraction-free-mode=true]_&]:grid-cols-[minmax(0,1fr)]! [html[data-presentation-mode=true]_&]:grid-cols-[minmax(0,1fr)]! workbenchContent`} ${leftToolWindowOpen ? `projectToolOpen [grid-template-columns:minmax(302px,_var(--side-tool-window-width,_clamp(352px,_32.7vw,_458px)))_minmax(0,_1fr)] projectToolOpen` : ""} ${maximizedToolWindow === "project" || maximizedToolWindow === "bookmarks" ? `maximizedSideTool [grid-template-columns:minmax(0,_1fr)] [&>_[data-workspace-main]]:[display:none] maximizedSideTool` : ""}`}
                  style={
                    {
                      "--side-tool-window-width": `${repositoryViewMode === "changes" ? 302 : sideToolWindowWidth}px`,
                      "--details-pane-width": `${historyReviewWidth}px`,
                    } as CSSProperties
                  }
                >
                  {bookmarksOpen && repositoryViewMode === "history" && (
                    <BookmarksToolWindow
                      onClose={() => setBookmarksOpen(false)}
                      onCreateGroup={(name, isDefault) =>
                        setBookmarks((current) =>
                          createBookmarkGroup(current, crypto.randomUUID(), name, isDefault),
                        )
                      }
                      onDeleteBookmark={(bookmarkId) =>
                        setBookmarks((current) => removeBookmark(current, bookmarkId))
                      }
                      onDeleteGroup={(group) => {
                        void dialog
                          .confirm({
                            title: "Delete Bookmark List",
                            description: `Are you sure you want to delete ‘${group.name}’ bookmark list? This action can't be undone.`,
                            impact: `${group.bookmarks.length} bookmark${group.bookmarks.length === 1 ? "" : "s"} will be deleted.`,
                            confirmLabel: "Delete",
                            dangerous: true,
                          })
                          .then((accepted) => {
                            if (accepted) {
                              setBookmarks((current) => deleteBookmarkGroup(current, group.id));
                            }
                          });
                      }}
                      onDescribeBookmark={(bookmarkId, description) =>
                        setBookmarks((current) =>
                          describeBookmark(current, bookmarkId, description),
                        )
                      }
                      onMoveBookmark={(bookmarkId, offset) =>
                        setBookmarks((current) => moveBookmark(current, bookmarkId, offset))
                      }
                      onOpenBookmark={openLineBookmark}
                      onRenameGroup={(groupId, name) =>
                        setBookmarks((current) => renameBookmarkGroup(current, groupId, name))
                      }
                      onSetDefaultGroup={(groupId) =>
                        setBookmarks((current) => setDefaultBookmarkGroup(current, groupId))
                      }
                      onViewOptionsChange={(view) =>
                        setBookmarks((current) => ({
                          ...current,
                          view,
                        }))
                      }
                      state={bookmarks}
                    />
                  )}
                  {projectOpen && repositoryViewMode === "history" && (
                    <ProjectToolWindow
                      activePath={inspector?.path}
                      changes={repository.status.changes}
                      hasCommits={repository.snapshot.hasCommits}
                      loadTree={sessionLoadTree}
                      onClose={() => setProjectOpen(false)}
                      onNew={toVoidHandler(async () => {
                        const path = await dialog.input({
                          title: "New File",
                          label: "Path relative to the project",
                          placeholder: "src/new-file.ts",
                          confirmLabel: "Create",
                        });
                        if (!path) return;
                        try {
                          await sessionWriteWorkingTreeFile(path, "");
                          openInspector({
                            revision: repository.snapshot.headOid ?? "HEAD",
                            source: {
                              kind: "workingTree",
                            },
                            path,
                            tab: "file",
                          });
                        } catch (error) {
                          setToast(error instanceof Error ? error.message : String(error));
                        }
                      })}
                      onNewScratch={() => setScratchFileChooserOpen(true)}
                      onOpenFile={(path, keepOpen = true) =>
                        openInspector(
                          {
                            revision: repository.snapshot.headOid ?? "HEAD",
                            source: {
                              kind: "workingTree",
                            },
                            path,
                            tab: "file",
                          },
                          keepOpen,
                        )
                      }
                      onOpenScratch={openScratchFile}
                      repositoryName={repository.snapshot.name}
                      repositoryPath={repository.snapshot.path}
                      scratches={scratchFiles}
                      width={sideToolWindowWidth}
                      onWidthChange={(width) =>
                        setSideToolWindowWidth(
                          Math.min(
                            MAX_SIDE_TOOL_WINDOW_WIDTH,
                            Math.max(MIN_SIDE_TOOL_WINDOW_WIDTH, Math.round(width)),
                          ),
                        )
                      }
                    />
                  )}
                  {repositoryViewMode === "changes" && commitToolWindow}
                  <div
                    className={`${`activeWorkspace [background:var(--card)] rounded-lg [display:grid] [min-height:0] [min-width:0] [overflow:hidden] [padding-top:32px] [position:relative] activeWorkspace rounded-lg`} ${!hasEditorTabs ? `activeWorkspaceNoTabs [padding-top:0] activeWorkspaceNoTabs` : ""}`}
                    data-workspace-main
                  >
                    {logOpen &&
                      logTabIds.map((tabId) => {
                        const value = `log:${tabId}`;
                        return (
                          <TabsContent
                            aria-labelledby={editorTabDomId(editorTabsId, value)}
                            className={`editorSurface [height:100%] [min-height:0] [min-width:0] [&[hidden]]:[display:none] editorSurface`}
                            id={editorPanelDomId(editorTabsId, value)}
                            keepMounted
                            key={tabId}
                            value={value}
                          >
                            {tabId === activeLogTabId && (
                              <div
                                className={`mainPanes [display:grid] [grid-template-columns:30px_minmax(0,_1fr)_var(--details-pane-width,_253px)] [height:100%] [min-height:0] [min-width:0] max-[900px]:[grid-template-columns:30px_minmax(0,_1fr)] max-[900px]:[&>_*:last-child]:[display:none] [html[data-distraction-free-mode=true]_&>*:first-child]:hidden! [html[data-distraction-free-mode=true]_&>*:last-child]:hidden! [html[data-presentation-mode=true]_&>*:first-child]:hidden! [html[data-presentation-mode=true]_&>*:last-child]:hidden! mainPanes`}
                                style={
                                  {
                                    "--history-review-width": `${historyReviewWidth}px`,
                                  } as CSSProperties
                                }
                              >
                                <BranchTree
                                  compact
                                  onAdd={onAddRepository}
                                  onActivate={() => void requestOpenRepositoryTool("refs")}
                                  onSelect={selectRef}
                                  refs={repository.refs}
                                  selected={selectedRef}
                                />
                                <CommitLog
                                  ahead={repository.status.ahead}
                                  behind={repository.status.behind}
                                  canCherryPick={availability.cherryPick}
                                  commits={repository.commits}
                                  hasMore={sessionHasMoreCommits}
                                  loading={sessionLogLoading}
                                  error={sessionLogError}
                                  refs={repository.refs}
                                  onLoad={sessionLoadLog}
                                  onOpenNewTab={openNewLogTab}
                                  indexing={logIndexing}
                                  indexingEnabled={logIndexingEnabled}
                                  powerSaveMode={productSettings.powerSaveMode}
                                  relativeTimeBaseSeconds={
                                    sessionFixture ? repository.commits[0]?.authoredAt : undefined
                                  }
                                  onEnableIndexing={async (filters, order) => {
                                    setLogIndexing(true);
                                    try {
                                      await sessionIndexLog(filters, order);
                                      setLogIndexingEnabled(true);
                                    } finally {
                                      setLogIndexing(false);
                                    }
                                  }}
                                  onCherryPick={() => void runAction("cherryPick")}
                                  onImportPatch={toVoidHandler(async () => {
                                    const selectedPath = await selectPatchImportPath();
                                    if (selectedPath === null) return;
                                    await sessionImportPatch(selectedPath);
                                    setToast("Patch applied to the index and working tree.");
                                  })}
                                  onRefresh={() => void sessionReload()}
                                  onContextMenu={(event, commit) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (!selectedOids.includes(commit.oid))
                                      setSelectedOids([commit.oid]);
                                    setContextPosition({
                                      x: event.clientX,
                                      y: event.clientY,
                                    });
                                  }}
                                  onSelectionChange={setSelectedOids}
                                  selectedOids={selectedOids}
                                  upstream={repository.status.upstream}
                                />
                                {revisionComparison ? (
                                  <RevisionComparison
                                    from={revisionComparison.from}
                                    loading={revisionComparison.loading}
                                    onPreferencesChange={setDiffPreferences}
                                    onReviewWidthChange={(width) =>
                                      setHistoryReviewWidth(
                                        Math.min(480, Math.max(180, Math.round(width))),
                                      )
                                    }
                                    patch={revisionComparison.patch}
                                    preferences={diffPreferences}
                                    reviewWidth={historyReviewWidth}
                                    readFile={sessionReadFile}
                                    to={revisionComparison.to}
                                  />
                                ) : (
                                  <DetailsPane
                                    afterContent={historyContent.after}
                                    afterPreview={historyPreview.after}
                                    beforeContent={historyContent.before}
                                    beforePreview={historyPreview.before}
                                    submoduleDiff={historySubmodule.value}
                                    commit={primaryCommit}
                                    diffLoading={
                                      historyDiff.loading ||
                                      historyContent.loading ||
                                      historyPreview.loading ||
                                      historySubmodule.loading
                                    }
                                    files={commitFiles}
                                    loading={commitFilesLoading}
                                    onLoadDiff={(commit, file) =>
                                      sessionLoadCommitDiff(
                                        commit,
                                        file.path,
                                        nativeDiffOptions(diffPreferences),
                                        historyParentRevision ?? undefined,
                                      )
                                    }
                                    onReadFile={sessionReadFile}
                                    onRevertSelectedChanges={async () => {
                                      if (!historyDiff.patch || !historySelectedPath) {
                                        return;
                                      }
                                      const accepted = await dialog.confirm({
                                        title: "Revert selected changes?",
                                        description:
                                          "Applies the inverse of this file change to the working tree.",
                                        impact: historySelectedPath,
                                        confirmLabel: "Revert selected changes",
                                        dangerous: true,
                                      });
                                      if (!accepted) return;
                                      await sessionExecuteOperation({
                                        kind: "applyPatch",
                                        patch: historyDiff.patch,
                                        cached: false,
                                        reverse: true,
                                      });
                                    }}
                                    signature={commitSignature}
                                    parentRevision={historyParentRevision}
                                    patch={historyDiff.patch}
                                    preferences={diffPreferences}
                                    reviewWidth={historyReviewWidth}
                                    selectedPath={historySelectedPath}
                                    onNext={() => selectRelative("child")}
                                    onPrevious={() => selectRelative("parent")}
                                    onReviewWidthChange={(width) =>
                                      setHistoryReviewWidth(
                                        Math.min(480, Math.max(180, Math.round(width))),
                                      )
                                    }
                                    onParentRevisionChange={setHistoryParentRevision}
                                    onPreferencesChange={setDiffPreferences}
                                    onSelectFile={(file) => setHistorySelectedPath(file.path)}
                                    onInspectFile={(file, tab) => {
                                      if (primaryCommit) {
                                        openInspector({
                                          revision: primaryCommit.oid,
                                          source: {
                                            kind: "revision",
                                            revision: primaryCommit.oid,
                                          },
                                          path: file.path,
                                          tab,
                                        });
                                      }
                                    }}
                                    onOpenTree={() => {
                                      if (primaryCommit) {
                                        openInspector({
                                          revision: primaryCommit.oid,
                                          source: {
                                            kind: "revision",
                                            revision: primaryCommit.oid,
                                          },
                                          tab: "tree",
                                        });
                                      }
                                    }}
                                  />
                                )}
                              </div>
                            )}
                          </TabsContent>
                        );
                      })}
                    {!inspector && !logOpen && (
                      <EmptyState className="gap-3 p-0 [&_[data-slot=empty-content]]:gap-3 [&_kbd]:ml-1.5 [&_kbd]:font-sans">
                        <Button
                          className={cn("p-0 text-[13px] text-muted-foreground hover:underline")}
                          data-open-git-log
                          onClick={openGitLogTab}
                          variant="ghost"
                          size="default"
                        >
                          Open Git Log <kbd>⌥G</kbd>
                        </Button>
                        <Button
                          className={cn("p-0 text-[13px] text-muted-foreground hover:underline")}
                          onClick={() => setRepositoryViewMode("changes")}
                          variant="ghost"
                          size="default"
                        >
                          Commit <kbd>⌘0</kbd>
                        </Button>
                      </EmptyState>
                    )}
                    {inspectorTabs.map((tab) => {
                      const key = inspectorKey(tab);
                      const value = `inspector:${key}`;
                      const scratch = tab.scratchId
                        ? scratchFiles.find((candidate) => candidate.id === tab.scratchId)
                        : undefined;
                      return (
                        <TabsContent
                          aria-labelledby={editorTabDomId(editorTabsId, value)}
                          className={`editorSurface [height:100%] [min-height:0] [min-width:0] [&[hidden]]:[display:none] editorSurface`}
                          id={editorPanelDomId(editorTabsId, value)}
                          keepMounted
                          key={key}
                          value={value}
                        >
                          {scratch ? (
                            <ScratchEditor
                              bookmarkedLines={allLineBookmarks(bookmarks)
                                .filter((bookmark) => bookmark.path === `Scratches/${scratch.name}`)
                                .map((bookmark) => bookmark.line)}
                              file={scratch}
                              initialColumn={tab.column}
                              initialLine={tab.line}
                              onChange={(content) =>
                                setScratchFiles((current) =>
                                  current.map((candidate) =>
                                    candidate.id === scratch.id
                                      ? {
                                          ...candidate,
                                          content,
                                          updatedAtMs: Date.now(),
                                        }
                                      : candidate,
                                  ),
                                )
                              }
                              onToggleBookmark={(line, column) =>
                                requestToggleBookmark({
                                  path: `Scratches/${scratch.name}`,
                                  line,
                                  column,
                                })
                              }
                            />
                          ) : (
                            <RepositoryInspectorDialog
                              bookmarkedLines={
                                tab.path
                                  ? allLineBookmarks(bookmarks)
                                      .filter((bookmark) => bookmark.path === tab.path)
                                      .map((bookmark) => bookmark.line)
                                  : []
                              }
                              embedded
                              initialPath={tab.path}
                              initialColumn={tab.column}
                              initialLine={tab.line}
                              initialTab={tab.tab}
                              loadBlame={sessionLoadBlame}
                              loadFileHistory={sessionLoadFileHistory}
                              loadTree={sessionLoadTree}
                              onClose={() => void requestCloseInspector(key)}
                              onDirtyChange={(dirty) => setInspectorDirty(key, dirty)}
                              onToggleBookmark={(path, line, column) =>
                                requestToggleBookmark({
                                  path,
                                  line,
                                  column,
                                })
                              }
                              openWorkingTreeFile={sessionOpenWorkingTreeFile}
                              readFile={sessionReadFile}
                              readFilePreview={sessionReadFilePreview}
                              readOnly={safeMode}
                              writeWorkingTreeFile={sessionWriteWorkingTreeFile}
                              revision={tab.revision}
                              source={tab.source}
                            />
                          )}
                        </TabsContent>
                      );
                    })}
                  </div>
                </div>
                <BottomPanel
                  collapsed={bottomCollapsed}
                  height={bottomPanelHeight}
                  active={bottomPanelTab}
                  fixture={sessionFixture}
                  onApplyShelf={(shelfId, drop) => void sessionApplyShelf(shelfId, drop)}
                  onCreateShelf={(message, paths) => void sessionCreateShelf(message, paths)}
                  onDeleteShelf={(shelfId) => void sessionDeleteShelf(shelfId)}
                  onLoadStashFiles={(stash) => sessionLoadStashFiles(stash.selector)}
                  onOpenStashDiff={openStashDiff}
                  onOperation={sessionExecuteOperation}
                  onRestoreRecovery={sessionRestoreRecoveryEntry}
                  onToggle={() => setBottomCollapsed((value) => !value)}
                  onHeightChange={setBottomPanelHeight}
                  onActiveChange={setBottomPanelTab}
                  recoveryEntries={sessionRecoveryEntries}
                  gitConsoleEntries={sessionGitConsoleEntries}
                  onClearGitConsole={sessionClearGitConsole}
                  onLoadLocalHistoryActivities={sessionListLocalHistoryActivities}
                  onLoadLocalHistoryActivity={sessionReadLocalHistoryActivity}
                  onLoadLocalHistoryDiff={sessionLoadLocalHistoryDiff}
                  onCreateLocalHistoryPatch={sessionCreateLocalHistoryPatch}
                  onPutLocalHistoryLabel={sessionPutLocalHistoryLabel}
                  findResults={findResults}
                  onOpenFindResult={(result) => {
                    setRepositoryViewMode("history");
                    openInspector({
                      revision: repository.snapshot.headOid ?? "HEAD",
                      source: { kind: "workingTree" },
                      path: result.path,
                      tab: "file",
                      line: result.line,
                      column: result.column,
                    });
                  }}
                  onSearchAgain={() => {
                    setProjectSearchInitialQuery("");
                    setProjectSearchSurface("find");
                  }}
                  onRevertLocalHistory={sessionRevertLocalHistory}
                  repositoryId={repository.snapshot.id}
                  repositoryName={repository.snapshot.name}
                  shelves={sessionShelves}
                  stashes={sessionStashes}
                  status={repository.status}
                />
              </div>
              {notificationOpen && (
                <NotificationToolWindow
                  notifications={notifications}
                  onClear={() => setNotifications([])}
                  onClose={() => setNotificationOpen(false)}
                />
              )}
              {balloonId &&
                (() => {
                  const notification = notifications.find((item) => item.id === balloonId);
                  return notification ? (
                    <NotificationBalloon
                      notification={notification}
                      onAction={(action) => {
                        if (action === "modifyShortcuts") {
                          onOpenSettings();
                        } else if (action === "openUrl" && notification.url) {
                          void openExternalUrl(notification.url);
                        } else if (action === "dismiss") {
                          onDismissShortcutConflictWarning();
                          setNotifications((current) =>
                            current.filter((item) => item.id !== notification.id),
                          );
                        } else {
                          setNotificationOpen(true);
                        }
                        setBalloonId(undefined);
                      }}
                      onDismiss={() => setBalloonId(undefined)}
                    />
                  ) : null;
                })()}
              <RepositoryRightToolStripe
                notificationCount={notifications.length}
                notificationsOpen={notificationOpen}
                onToggleNotifications={() => setNotificationOpen((current) => !current)}
              />
            </div>
          )}
        </main>
      </Tabs>
      <RepositoryStatusBar
        navigationStatus={navigationStatus}
        productSettings={productSettings}
        session={session}
        terminalFocused={terminalFocused}
      />
      {contextPosition && (
        <CommitContextMenu
          availability={availability}
          onClose={() => setContextPosition(undefined)}
          onAction={(action) => void runAction(action)}
          x={contextPosition.x}
          y={contextPosition.y}
        />
      )}
      {diffState && (
        <section
          className={`standaloneDiff [background:var(--card)] [display:grid] [grid-template-rows:38px_minmax(0,_1fr)] [inset:70px_0_23px] [position:fixed] [z-index:44] [&>_header]:[align-items:center] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[padding:0_9px] [&>_header_span]:[flex:1] standaloneDiff`}
          aria-label="Standalone diff review"
        >
          <header>
            <strong>Comparison</strong>
            <span />
            <Button
              className={cn("min-h-7 px-2 text-xs")}
              onClick={() => setDiffState(undefined)}
              variant="secondary"
              size="sm"
            >
              Back to workspace
            </Button>
          </header>
          <DiffViewer
            file={diffState.file}
            loading={diffState.loading}
            mode="readOnly"
            onPreferencesChange={setDiffPreferences}
            patch={diffState.patch}
            preferences={diffPreferences}
            sourceLabel="Comparison"
          />
        </section>
      )}
      {conflictContent && (
        <ConflictEditorDialog
          content={conflictContent}
          onAbort={async () => {
            await abortInProgressOperation();
            setConflictContent(undefined);
          }}
          onClose={() => setConflictContent(undefined)}
          onContinue={async () => {
            const operation = repository.snapshot.operation;
            if (!operation || operation === "bisect") return;
            await sessionExecuteOperation({
              kind: "continue",
              operation,
            });
            setConflictContent(undefined);
          }}
          onResolveBinary={async (side) => {
            await sessionResolveBinaryConflict(conflictContent.path, side);
            setConflictContent(undefined);
          }}
          onSave={async (result) => {
            await sessionSaveConflictResult(conflictContent.path, result, true);
            setConflictContent(undefined);
          }}
          operation={repository.snapshot.operation}
        />
      )}
      {historyRewrite && (
        <HistoryRewriteWorkspace
          currentHeadOid={repository.snapshot.headOid}
          fromRevision={historyRewrite.fromRevision}
          onClose={() => setHistoryRewrite(null)}
          onExecute={(operation) => sessionExecuteOperation(operation, true)}
          onLoadPreview={sessionLoadHistoryRewritePreview}
          onOpenPush={() => {
            setHistoryRewrite(null);
            onOpenPush("HEAD", true);
          }}
          operationInProgress={repository.snapshot.operation !== null}
          squashOids={historyRewrite.squashOids}
        />
      )}
      {shareExistingRemotes && (
        <ShareExistingRemotesDialog
          onCancel={() => setShareExistingRemotes(undefined)}
          onOpenRemote={(remote) => {
            const url = remoteBrowserUrl(remote);
            if (url === null) {
              setToast("This remote URL cannot be opened in a browser.");
              return;
            }
            void openExternalUrl(url);
          }}
          onShareAnyway={() => {
            setShareProjectProvider(shareExistingRemotes.provider);
            setShareExistingRemotes(undefined);
          }}
          remotes={shareExistingRemotes.remotes}
          service={shareExistingRemotes.provider === "gitHub" ? "GitHub" : "GitLab"}
        />
      )}
      {shareProjectProvider && !shareExistingRemotes && (
        <ShareProjectDialog
          currentBranch={repository.snapshot.currentBranch}
          changes={repository.status.changes}
          hasCommits={repository.snapshot.hasCommits}
          onBind={async (binding: ShareProjectBinding) => {
            const existingRemote = sessionRemotes.find(
              (remote) => remote.name === binding.remoteName,
            );
            if (!existingRemote) {
              await sessionExecuteOperation(
                {
                  kind: "remoteAdd",
                  name: binding.remoteName,
                  url: binding.remoteUrl,
                },
                true,
              );
            } else if (
              existingRemote.fetchUrl !== binding.remoteUrl &&
              existingRemote.pushUrl !== binding.remoteUrl
            ) {
              throw new Error(
                `Remote '${binding.remoteName}' now points to a different repository.`,
              );
            }
            if (binding.initialCommit && !repository.snapshot.hasCommits) {
              const selectedPaths = new Set(binding.initialCommit.paths);
              const excludedStagedPaths = repository.status.changes
                .filter((change) => change.staged && !selectedPaths.has(change.path))
                .map((change) => change.path);
              if (excludedStagedPaths.length > 0) {
                await sessionExecuteOperation(
                  {
                    kind: "removeCached",
                    paths: excludedStagedPaths,
                  },
                  true,
                );
              }
              await sessionExecuteOperation(
                {
                  kind: "stage",
                  paths: [...binding.initialCommit.paths],
                },
                true,
              );
              await sessionExecuteOperation(
                {
                  kind: "commitAdvanced",
                  message: binding.initialCommit.message,
                  amend: false,
                  signOff: false,
                  gpgSign: false,
                  skipHooks: false,
                  commitAll: false,
                },
                true,
              );
            }
            if (repository.snapshot.hasCommits || binding.initialCommit !== null) {
              const branch = repository.snapshot.currentBranch;
              if (!branch) {
                throw new Error("Check out a local branch before pushing the shared project.");
              }
              await sessionExecuteOperation(
                {
                  kind: "push",
                  destination: {
                    remote: binding.remoteName,
                    remoteRef: `refs/heads/${branch}`,
                    localRevision: branch,
                    setUpstream: true,
                  },
                  mode: { kind: "normal" },
                },
                true,
              );
            }
            const service = shareProjectProvider === "gitHub" ? "GitHub" : "GitLab";
            const createdEmptyRepository =
              !repository.snapshot.hasCommits && binding.initialCommit === null;
            setToast(
              createdEmptyRepository
                ? `Successfully created empty repository on ${service}`
                : `Project shared on ${service}`,
            );
            const notification: ProductNotification = {
              id: crypto.randomUUID(),
              title: createdEmptyRepository
                ? `Successfully created empty repository on ${service}`
                : `Successfully shared on ${service}`,
              message: binding.webUrl,
              kind: "success",
              createdAt: Date.now(),
              actions: ["openUrl"],
              url: binding.webUrl,
            };
            setNotifications((current) => [notification, ...current]);
            setBalloonId(notification.id);
          }}
          onClose={() => setShareProjectProvider(undefined)}
          onManageAccounts={() => void requestOpenRepositoryTool("hosting")}
          projectName={repository.snapshot.name}
          provider={shareProjectProvider}
          remoteNames={sessionRemotes.map((remote) => remote.name)}
        />
      )}
      {dialog.node}
      {toast && (
        <div
          className={`toast [align-items:center] [background:var(--inverse)] rounded-lg [bottom:36px] [box-shadow:var(--shadow-lg)] [color:var(--inverse-foreground)] [display:flex] [gap:7px] [left:50%] [padding:9px_13px] [position:fixed] [transform:translateX(-50%)] [z-index:80] toast rounded-lg`}
        >
          <Icon name="check" size={15} />
          {toast}
        </div>
      )}
    </>
  );
}
