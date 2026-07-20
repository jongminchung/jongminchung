import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { ActivityMonitorDialog } from "./components/ActivityMonitorDialog";
import { useAppDialog } from "./components/AppDialog";
import { AppearanceMenu } from "./components/AppearanceMenu";
import { AppearanceProvider } from "./components/AppearanceProvider";
import { useAppearance } from "./components/AppearanceProvider";
import { BookmarkGroupSelectDialog } from "./components/BookmarkGroupSelectDialog";
import { BookmarkMnemonicDialog } from "./components/BookmarkMnemonicDialog";
import { BookmarksPopup, type BookmarksPopupMode } from "./components/BookmarksPopup";
import { BookmarksToolWindow } from "./components/BookmarksToolWindow";
import { BottomPanel } from "./components/BottomPanel";
import type { BottomPanelTab } from "./components/BottomPanel";
import { BranchTree } from "./components/BranchTree";
import { ChangesWorkspace } from "./components/ChangesWorkspace";
import {
  CodeAnalysisScopeDialog,
  type CodeAnalysisScope,
} from "./components/CodeAnalysisScopeDialog";
import { CommandLineLauncherDialog } from "./components/CommandLineLauncherDialog";
import {
  CommandProvider,
  useCommandDefinitions,
  useCommands,
  useDismissLayer,
  usePaletteItems,
} from "./components/CommandProvider";
import { CommitContextMenu } from "./components/CommitContextMenu";
import { CommitLog } from "./components/CommitLog";
import { ConfigurationFileDialog } from "./components/ConfigurationFileDialog";
import { ConflictEditorDialog } from "./components/ConflictEditorDialog";
import { DetailsPane } from "./components/DetailsPane";
import { DiffViewer } from "./components/DiffViewer";
import { ExportToHtmlDialog, type HtmlExportScope } from "./components/ExportToHtmlDialog";
import type { FindResultsSession } from "./components/FindResultsPanel";
import { GitBranchesPopup } from "./components/GitBranchesPopup";
import { GitClientTheme } from "./components/GitClientTheme";
import { HistoryRewriteWorkspace } from "./components/HistoryRewriteWorkspace";
import { loadHostingAccounts } from "./components/hosting-persistence";
import { Icon } from "./components/Icon";
import { InspectionResultsDialog } from "./components/InspectionResultsDialog";
import { InvalidateCachesDialog } from "./components/InvalidateCachesDialog";
import { LeftoverDirectoriesDialog } from "./components/LeftoverDirectoriesDialog";
import {
  NotificationBalloon,
  NotificationToolWindow,
  type ProductNotification,
} from "./components/NotificationToolWindow";
import { ProcessesDialog } from "./components/ProcessesDialog";
import { ProductHelpDialog } from "./components/ProductHelpDialog";
import { ProjectSearchDialog, type ProjectSearchSurface } from "./components/ProjectSearchDialog";
import { ProjectSwitcherPopup } from "./components/ProjectSwitcherPopup";
import { ProjectToolWindow } from "./components/ProjectToolWindow";
import { PushDialog } from "./components/PushDialog";
import { QuickSwitchSchemeDialog } from "./components/QuickSwitchSchemeDialog";
import { RecentFindUsagesDialog } from "./components/RecentFindUsagesDialog";
import { RepairIdeDialog } from "./components/RepairIdeDialog";
import { ReplaceInFilesDialog } from "./components/ReplaceInFilesDialog";
import { RepositoryDialog } from "./components/RepositoryDialog";
import type { RepositoryDialogMode } from "./components/RepositoryDialog";
import {
  RepositoryInspectorDialog,
  type InspectorTab,
} from "./components/RepositoryInspectorDialog";
import { RepositoryToolDialog, type RepositoryToolKind } from "./components/RepositoryToolDialog";
import { RevisionComparison } from "./components/RevisionComparison";
import { RunConfigurationTemplatesDialog } from "./components/RunConfigurationTemplatesDialog";
import { RunInspectionDialog } from "./components/RunInspectionDialog";
import { SavedMacrosDialog } from "./components/SavedMacrosDialog";
import { ScratchEditor } from "./components/ScratchEditor";
import { ScratchFileChooserDialog } from "./components/ScratchFileChooserDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { ShareExistingRemotesDialog } from "./components/ShareExistingRemotesDialog";
import { ShareProjectDialog, type ShareProjectBinding } from "./components/ShareProjectDialog";
import { SpecialFilesDialog } from "./components/SpecialFilesDialog";
import { StackTraceDialog } from "./components/StackTraceDialog";
import { ToolWindowLayoutsDialog } from "./components/ToolWindowLayoutsDialog";
import { VcsOperationsPopup, type VcsOperationGroup } from "./components/VcsOperationsPopup";
import { WelcomeWorkspace } from "./components/WelcomeWorkspace";
import { WhatsNewDialog } from "./components/WhatsNewDialog";
import { deriveActionAvailability } from "./domain/actionAvailability";
import {
  DEFAULT_APPEARANCE_PREFERENCE,
  storedAppearancePreference,
  synchronizeAppearancePreference,
  type AppearancePreference,
} from "./domain/appearance";
import {
  allLineBookmarks,
  addLineBookmarkToGroup,
  assignBookmarkMnemonic,
  bookmarkAt,
  createBookmarkGroup,
  deleteBookmarkGroup,
  describeBookmark,
  moveBookmark,
  parseProjectBookmarks,
  relativeBookmark,
  removeBookmark,
  renameBookmarkGroup,
  setDefaultBookmarkGroup,
  toggleLineBookmark,
  type LineBookmark,
  type BookmarkMnemonic,
  type BookmarkLocation,
  type ProjectBookmarks,
} from "./domain/bookmarks";
import {
  DEFAULT_DIFF_PREFERENCES,
  EMPTY_COMMIT_DRAFT,
  changeEntries,
  reconcileChangeSelection,
  type ChangeSelection,
  type CommitDraft,
  type DiffPreferences,
  type RepositoryViewMode,
} from "./domain/changeReview";
import {
  cleanupText,
  inspectText,
  parseOfflineInspectionXml,
  type CodeInspectionId,
  type CodeIssue,
  type StackTraceFrame,
} from "./domain/codeAnalysis";
import {
  COMMAND_ENABLED,
  commandDefinition,
  commandDisabled,
  type CommandId,
  type CommandDefinition,
  type PaletteItem,
} from "./domain/commands";
import { commitUrl } from "./domain/forge";
import type { ActivityStatus } from "./domain/gitActivity";
import { parseSavedMacros, SAVED_MACROS_KEY, type SavedMacro } from "./domain/macros";
import {
  DEFAULT_PRODUCT_SETTINGS,
  parseProductSettings,
  PRODUCT_SETTINGS_KEY,
  type ProductSettings,
  type StatusBarWidget,
} from "./domain/productSettings";
import {
  replacementExpression,
  replaceProjectText,
  type ProjectSearchOptions,
  type ProjectSearchResult,
  type ProjectTextMatch,
} from "./domain/projectSearch";
import {
  DEFAULT_RUN_CONFIGURATION_TEMPLATES,
  parseRunConfigurationTemplates,
  RUN_CONFIGURATION_TEMPLATES_KEY,
  type RunConfigurationTemplate,
} from "./domain/runConfigurationTemplates";
import {
  nextScratchName,
  parseScratchFiles,
  SCRATCH_FILES_KEY,
  SCRATCH_LANGUAGES,
  type ScratchFile,
  type ScratchLanguage,
} from "./domain/scratchFiles";
import { terminalService } from "./domain/TerminalService";
import {
  DEFAULT_TOOL_WINDOW_LAYOUT,
  DEFAULT_NAMED_TOOL_WINDOW_LAYOUT,
  parseNamedToolWindowLayouts,
  parseToolWindowLayout,
  TOOL_WINDOW_LAYOUT_KEY,
  type NamedToolWindowLayout,
  type ToolWindowLayout,
} from "./domain/toolWindowLayouts";
import { toVoidHandler } from "./domain/toVoidHandler";
import type {
  ActionAvailability,
  Commit,
  FileChange,
  Ref,
  RepositoryView,
  StashEntry,
} from "./domain/types";
import {
  DEFAULT_BOTTOM_PANEL_HEIGHT,
  DEFAULT_SIDE_TOOL_WINDOW_WIDTH,
  MAX_BOTTOM_PANEL_HEIGHT,
  MAX_SIDE_TOOL_WINDOW_WIDTH,
  MIN_BOTTOM_PANEL_HEIGHT,
  MIN_SIDE_TOOL_WINDOW_WIDTH,
  migrateRepositoryUiState,
} from "./domain/workspacePersistence";
import { useGitSession, type WorkspaceRepositorySession } from "./hooks/useGitSession";
import { selectOfflineInspectionFiles } from "./platform/codeAnalysis";
import { electronApi, isElectronRuntime } from "./platform/electron";
import {
  getElectronFullScreen,
  collectDiagnosticLogs,
  deleteLeftoverDirectories,
  dumpDiagnosticThreads,
  exportPatchText,
  exportHtmlFiles,
  loadDiagnosticSnapshot,
  listLeftoverDirectories,
  loadCommandLineLauncherInfo,
  openKeyboardShortcutsPdf,
  openExternalUrl,
  readDiagnosticConfiguration,
  relaunchElectronApp,
  readClipboardText,
  revealDiagnosticPath,
  selectPatchExportPath,
  selectPatchImportPath,
  setElectronFullScreen,
  writeClipboardText,
  writeDiagnosticConfiguration,
} from "./platform/electronActions";
import {
  readElectronSetting,
  writeElectronSettings,
  exportElectronSettings,
  importElectronSettings,
} from "./platform/electronSettings";
import type { DiagnosticConfigurationKind } from "./shared/contracts/ipc";
import type {
  CommitSignature,
  ConflictContent,
  DiffOptions,
  FileContent,
  FilePreview,
  FileSource,
  SubmoduleDiff,
} from "./shared/contracts/model";
import { tw } from "./styles/tailwind";

interface ContextPosition {
  readonly x: number;
  readonly y: number;
}

interface ToolWindowLayoutCaptureDetail {
  readonly accept: (layout: ToolWindowLayout) => void;
}

interface ShareExistingRemotes {
  readonly provider: "gitHub" | "gitLab";
  readonly remotes: readonly string[];
}

function remoteHostname(remote: string): string | null {
  try {
    return new URL(remote).hostname.toLowerCase();
  } catch {
    const match = /^(?:[^@\s]+@)?([^:/\s]+):[^\s]+$/u.exec(remote);
    return match?.[1]?.toLowerCase() ?? null;
  }
}

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

const TOOL_WINDOW_RESIZE_STEP = 24;

interface DiffState {
  readonly file: FileChange;
  readonly patch: string;
  readonly loading: boolean;
  readonly mode: "readOnly" | "stage" | "unstage";
}

interface PersistentDiffState {
  readonly patch: string;
  readonly loading: boolean;
}

interface RevisionComparisonState {
  readonly from: string;
  readonly to: string;
  readonly patch: string;
  readonly loading: boolean;
}

interface DiffPreviewPair {
  readonly before: FilePreview | null;
  readonly after: FilePreview | null;
  readonly loading: boolean;
}

interface DiffContentPair {
  readonly before: FileContent | null;
  readonly after: FileContent | null;
  readonly loading: boolean;
}

interface SubmoduleDiffState {
  readonly value: SubmoduleDiff | null;
  readonly loading: boolean;
}

interface HistoryRewriteRequest {
  readonly fromRevision: string;
  readonly squashOids: readonly string[];
}

const EMPTY_PREVIEW_PAIR: DiffPreviewPair = {
  before: null,
  after: null,
  loading: false,
};

const EMPTY_CONTENT_PAIR: DiffContentPair = {
  before: null,
  after: null,
  loading: false,
};

const ACTIVITY_STATUS_CLASS = {
  running: "",
  succeeded: "text-success",
  failed: "border-error text-error",
  cancelled: "text-disabled",
} as const satisfies Readonly<Record<ActivityStatus, string>>;

const STATUS_BAR_WIDGET_COMMANDS = [
  ["view.statusWidgetStatusText", "statusText"],
  ["view.statusWidgetFileSystemSync", "fileSystemSync"],
  ["view.statusWidgetAggregator", "aggregator"],
  ["view.statusWidgetGridPosition", "gridPosition"],
  ["view.statusWidgetLineColumn", "lineColumn"],
  ["view.statusWidgetLanguageServices", "languageServices"],
  ["view.statusWidgetLineSeparator", "lineSeparator"],
  ["view.statusWidgetFileEncoding", "fileEncoding"],
  ["view.statusWidgetPowerSaveMode", "powerSaveMode"],
  ["view.statusWidgetEditorSelectionMode", "editorSelectionMode"],
  ["view.statusWidgetIndentation", "indentation"],
  ["view.statusWidgetReadOnlyAttribute", "readOnlyAttribute"],
  ["view.statusWidgetMemoryIndicator", "memoryIndicator"],
] as const satisfies readonly (readonly [`${string}.${string}`, StatusBarWidget])[];

interface InspectorState {
  readonly revision: string;
  readonly source: FileSource;
  readonly path?: string;
  readonly tab: InspectorTab;
  readonly line?: number;
  readonly column?: number;
  readonly scratchId?: string;
}

interface EditorStatus {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly readOnly: boolean;
  readonly language: string;
  readonly lineSeparator: "LF" | "CRLF";
  readonly indentation: string;
  readonly columnSelection: boolean;
  readonly symbol?: string;
  readonly selectedText?: string;
}

interface BookmarkMnemonicTarget {
  readonly bookmarkId: string;
  readonly location: BookmarkLocation;
  readonly current: BookmarkMnemonic | null;
  readonly description: string;
  readonly creating: boolean;
}

interface BookmarkGroupTarget {
  readonly bookmarkId: string;
  readonly location: BookmarkLocation;
  readonly mnemonic: BookmarkMnemonic | null;
  readonly description: string;
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

function inspectorKey(inspector: InspectorState): string {
  const source =
    inspector.source.kind === "revision"
      ? `revision:${inspector.source.revision}`
      : inspector.source.kind;
  return `${source}:${inspector.path ?? ""}`;
}

type GitSession = ReturnType<typeof useGitSession>;
const commitFilesCache = new Map<string, readonly FileChange[]>();
const COMMIT_FILES_CACHE_LIMIT = 200;
const EMPTY_TREE_OID = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const NEW_PROJECT_SETTINGS_KEY = "newProjectProductSettings";
const NEW_PROJECT_APPEARANCE_KEY = "newProjectAppearanceMode";

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

function WorkspaceTitlebar({
  session,
  onActivateProject,
  onCloneProject,
  onOpenProject,
  onOpenRecentProject,
  onOpenPush,
  onOpenRepositoryTool,
  onOpenSettings,
  onProjectSwitcherOpenChange,
  onRemoveRecentProject,
  projectSwitcherOpen,
  showRepositoryActions,
}: {
  readonly session: GitSession;
  readonly onActivateProject: (repositoryId: string) => Promise<void>;
  readonly onCloneProject: () => void;
  readonly onOpenProject: () => void;
  readonly onOpenRecentProject: (path: string) => Promise<void>;
  readonly onOpenPush: () => void;
  readonly onOpenRepositoryTool: (kind: RepositoryToolKind) => void;
  readonly onOpenSettings: () => void;
  readonly onProjectSwitcherOpenChange: (open: boolean) => void;
  readonly onRemoveRecentProject: (path: string) => void;
  readonly projectSwitcherOpen: boolean;
  readonly showRepositoryActions: boolean;
}) {
  const { openPalette } = useCommands();
  const repository = session.repository;
  const projectButton = useRef<HTMLButtonElement>(null);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const closeProjectSwitcher = useCallback((): void => {
    onProjectSwitcherOpenChange(false);
    window.requestAnimationFrame(() => projectButton.current?.focus());
  }, [onProjectSwitcherOpenChange]);
  return (
    <header className={tw.titlebar} aria-label="Main Toolbar">
      <div className={tw.trafficSpace} />
      <div className={tw.mainToolbarPopupAnchor}>
        <button
          aria-expanded={projectSwitcherOpen}
          aria-label={`Project: ${repository?.snapshot.name ?? "Git Client"}`}
          className={tw.projectSelector}
          onClick={() => onProjectSwitcherOpenChange(!projectSwitcherOpen)}
          ref={projectButton}
          title={repository?.snapshot.path ?? "Projects"}
        >
          <span className={tw.projectMark}>
            {repository?.snapshot.name.trim().charAt(0).toUpperCase() || "G"}
          </span>
          <span>{repository?.snapshot.name ?? "Git Client"}</span>
          <Icon name="chevron" size={10} />
        </button>
        {projectSwitcherOpen && repository && (
          <ProjectSwitcherPopup
            activeRepositoryId={repository.snapshot.id}
            onActivate={onActivateProject}
            onClone={onCloneProject}
            onClose={closeProjectSwitcher}
            onOpen={onOpenProject}
            onOpenRecent={onOpenRecentProject}
            onRemoveRecent={onRemoveRecentProject}
            openRepositories={session.openRepositories}
            recentProjects={session.recentProjects}
          />
        )}
      </div>
      {showRepositoryActions && (
        <>
          <div className={tw.mainToolbarPopupAnchor}>
            <button
              aria-expanded={branchesOpen}
              aria-label={repository?.snapshot.currentBranch ?? "No branch"}
              className={tw.mainToolbarAction}
              disabled={!repository}
              onClick={() => setBranchesOpen((value) => !value)}
              title={`Git Branch: ${repository?.snapshot.currentBranch ?? "No branch"}`}
            >
              <Icon name="branch" size={14} />
              <span>{repository?.snapshot.currentBranch ?? "No branch"}</span>
              <Icon name="chevron" size={10} />
            </button>
            {branchesOpen && repository && (
              <GitBranchesPopup
                currentBranch={repository.snapshot.currentBranch}
                onCheckout={(target) =>
                  session.executeOperation({
                    kind: "checkout",
                    target,
                    force: false,
                  })
                }
                onCompare={session.compareBranches}
                onCommit={() =>
                  window.dispatchEvent(
                    new CustomEvent("git-client:repository-view-request", {
                      detail: "changes",
                    }),
                  )
                }
                onOperation={session.executeOperation}
                onClose={() => setBranchesOpen(false)}
                onOpenSettings={() => {
                  setBranchesOpen(false);
                  onOpenRepositoryTool("refs");
                }}
                refs={repository.refs}
                remotes={session.remotes}
              />
            )}
          </div>
          <button
            aria-label="Update Project..."
            className={tw.mainToolbarIcon}
            disabled={!repository}
            onClick={() =>
              void session.executeOperation({
                kind: "pull",
                rebase: false,
              })
            }
            title="Update Project..."
          >
            <Icon name="pull" size={15} />
          </button>
          <button
            aria-label="Push…"
            className={tw.mainToolbarIcon}
            disabled={!repository}
            onClick={onOpenPush}
            title="Push…"
          >
            <Icon name="push" size={15} />
          </button>
        </>
      )}
      <span className={tw.mainToolbarDragRegion} />
      <button
        aria-label="Search Everywhere"
        className={tw.mainToolbarIcon}
        onClick={openPalette}
        title="Search Everywhere"
      >
        <Icon name="search" size={14} />
      </button>
      <AppearanceMenu />
      <button
        aria-label="IDE and Project Settings"
        className={tw.mainToolbarIcon}
        onClick={onOpenSettings}
        title="IDE and Project Settings"
      >
        <Icon name="settings" size={14} />
      </button>
    </header>
  );
}

function WelcomeTitlebar() {
  return (
    <header className={tw.welcomeTitlebar} data-testid="welcome-titlebar">
      Welcome to Git Client
    </header>
  );
}

function RepositoryToolStripe({
  changes,
  mode,
  onModeChange,
  onOpenProject,
  onOpenGitConsole,
  projectOpen,
  bookmarksOpen,
  onOpenBookmarks,
  terminalFocused,
  disabled = false,
}: {
  readonly changes: number;
  readonly mode: RepositoryViewMode;
  readonly onModeChange: (mode: RepositoryViewMode) => void;
  readonly onOpenProject: () => void;
  readonly onOpenGitConsole: () => void;
  readonly projectOpen: boolean;
  readonly bookmarksOpen: boolean;
  readonly onOpenBookmarks: () => void;
  readonly terminalFocused: boolean;
  readonly disabled?: boolean;
}) {
  const { openPalette } = useCommands();
  return (
    <nav aria-label="Left Toolbar" className={tw.toolStripe}>
      <div>
        <button
          aria-label="Project"
          aria-pressed={projectOpen}
          disabled={disabled}
          onClick={onOpenProject}
          title="Project"
        >
          <Icon name="folder" size={17} />
        </button>
        {bookmarksOpen && (
          <button
            aria-label="Bookmarks"
            aria-pressed
            disabled={disabled}
            onClick={onOpenBookmarks}
            title="Bookmarks"
          >
            <Icon name="bookmark" size={17} />
          </button>
        )}
        {!terminalFocused && (
          <button
            aria-label="Commit"
            aria-pressed={mode === "changes"}
            disabled={disabled}
            onClick={() => onModeChange("changes")}
            title="Commit"
          >
            <Icon name="changes" size={17} />
            {changes > 0 && <em>{changes}</em>}
          </button>
        )}
        <button
          aria-label="More"
          disabled={disabled}
          onClick={openPalette}
          title="More Tool Windows"
        >
          <Icon name="more" size={17} />
        </button>
      </div>
      <div>
        <button
          aria-label="Terminal"
          aria-pressed={terminalFocused}
          disabled={disabled}
          onClick={() => window.dispatchEvent(new CustomEvent("git-client:open-terminal"))}
          title="Terminal"
        >
          <Icon name="console" size={17} />
        </button>
        {!terminalFocused && (
          <button aria-label="Git" disabled={disabled} onClick={onOpenGitConsole} title="Git">
            <Icon name="branch" size={17} />
          </button>
        )}
      </div>
    </nav>
  );
}

function RepositoryRightToolStripe({
  notificationCount = 0,
  notificationsOpen = false,
  onToggleNotifications,
}: {
  readonly notificationCount?: number;
  readonly notificationsOpen?: boolean;
  readonly onToggleNotifications?: () => void;
} = {}) {
  return (
    <nav aria-label="Right Toolbar" className={tw.rightToolStripe}>
      <button
        aria-label="Notifications"
        aria-pressed={notificationsOpen}
        disabled={!onToggleNotifications}
        onClick={onToggleNotifications}
        title="Notifications"
      >
        <Icon name="warning" size={15} />
        {notificationCount > 0 && <em aria-hidden="true" />}
      </button>
      <button aria-label="More" disabled title="More Tool Windows">
        <Icon name="more" size={15} />
      </button>
    </nav>
  );
}

function StartupWorkspace({
  session,
  onCloneRepository,
  onNewProject,
  onOpenRepository,
  onOpenSettings,
  appearancePreference,
  onAppearancePreferenceChange,
}: {
  readonly session: GitSession;
  readonly onCloneRepository: () => void;
  readonly onNewProject: () => void;
  readonly onOpenRepository: () => void;
  readonly onOpenSettings: () => void;
  readonly appearancePreference: AppearancePreference;
  readonly onAppearancePreferenceChange: (preference: AppearancePreference) => void;
}) {
  if (session.restoring) {
    return (
      <main className={tw.startupWorkspace} aria-busy="true">
        <section className={tw.restoreWorkspace} role="status">
          <span className={tw.activitySpinner} />
          <strong>Restoring workspace…</strong>
          <p>Reopening repositories and validating saved paths.</p>
        </section>
      </main>
    );
  }
  return (
    <WelcomeWorkspace
      appearancePreference={appearancePreference}
      onAppearancePreferenceChange={onAppearancePreferenceChange}
      onCloneRepository={onCloneRepository}
      onNewProject={onNewProject}
      onOpenRecent={(path) => void session.openRepository(path)}
      onOpenRepository={onOpenRepository}
      onOpenSettings={onOpenSettings}
      recentProjects={session.recentProjects}
    />
  );
}

function RepositoryLoadingSkeleton(): React.ReactElement {
  return (
    <div className={tw.workbench} role="status">
      <RepositoryToolStripe
        bookmarksOpen={false}
        changes={0}
        mode="history"
        onModeChange={() => undefined}
        onOpenBookmarks={() => undefined}
        onOpenGitConsole={() => undefined}
        onOpenProject={() => undefined}
        projectOpen={false}
        terminalFocused={false}
        disabled
      />
      <div className={tw.workbenchSurface}>
        <div className={tw.workbenchContent}>
          <div className={tw.activeWorkspace}>
            <div aria-label="Log" className={tw.loadingEditorTabs} role="tablist">
              <span aria-hidden="true">
                <Icon name="branch" size={14} />
                Log
              </span>
            </div>
            <div className={tw.loadingVcsLog}>Loading VCS Log...</div>
          </div>
        </div>
      </div>
      <RepositoryRightToolStripe />
    </div>
  );
}

function RepositoryWorkspace({
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
}: {
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
}) {
  const { execute: executeCommand, openPaletteFor } = useCommands();
  const [selectedOids, setSelectedOids] = useState<readonly string[]>([]);
  const [selectedRef, setSelectedRef] = useState<string | undefined>(
    repository.refs.find((ref) => ref.current)?.name,
  );
  const [repositoryViewMode, setRepositoryViewMode] = useState<RepositoryViewMode>("history");
  useEffect(() => {
    const openRequestedView = (event: Event): void => {
      if (event instanceof CustomEvent && event.detail === "changes") {
        setRepositoryViewMode("changes");
      }
    };
    window.addEventListener("git-client:repository-view-request", openRequestedView);
    return () =>
      window.removeEventListener("git-client:repository-view-request", openRequestedView);
  }, []);
  const [changeSelection, setChangeSelection] = useState<ChangeSelection | null>(null);
  const [historySelectedPath, setHistorySelectedPath] = useState<string | null>(null);
  const [historyParentRevision, setHistoryParentRevision] = useState<string | null>(null);
  const [diffPreferences, setDiffPreferences] = useState<DiffPreferences>(DEFAULT_DIFF_PREFERENCES);
  const [commitDraft, setCommitDraft] = useState<CommitDraft>(EMPTY_COMMIT_DRAFT);
  const [historyDiff, setHistoryDiff] = useState<PersistentDiffState>({
    patch: "",
    loading: false,
  });
  const [changeDiff, setChangeDiff] = useState<PersistentDiffState>({
    patch: "",
    loading: false,
  });
  const [historyPreview, setHistoryPreview] = useState<DiffPreviewPair>(EMPTY_PREVIEW_PAIR);
  const [changePreview, setChangePreview] = useState<DiffPreviewPair>(EMPTY_PREVIEW_PAIR);
  const [historyContent, setHistoryContent] = useState<DiffContentPair>(EMPTY_CONTENT_PAIR);
  const [changeContent, setChangeContent] = useState<DiffContentPair>(EMPTY_CONTENT_PAIR);
  const historyContentGeneration = useRef(0);
  const changeContentGeneration = useRef(0);
  const [historySubmodule, setHistorySubmodule] = useState<SubmoduleDiffState>({
    value: null,
    loading: false,
  });
  const [changeSubmodule, setChangeSubmodule] = useState<SubmoduleDiffState>({
    value: null,
    loading: false,
  });
  const [contextPosition, setContextPosition] = useState<ContextPosition>();
  const [diffState, setDiffState] = useState<DiffState>();
  const [revisionComparison, setRevisionComparison] = useState<RevisionComparisonState>();
  const [conflictContent, setConflictContent] = useState<ConflictContent>();
  const [inspectorTabs, setInspectorTabs] = useState<readonly InspectorState[]>([]);
  const [recentInspectors, setRecentInspectors] = useState<readonly InspectorState[]>([]);
  const navigationHistory = useRef<readonly InspectorState[]>([]);
  const navigationInProgress = useRef(false);
  const [navigationIndex, setNavigationIndex] = useState(-1);
  const [projectFiles, setProjectFiles] = useState<readonly string[]>([]);
  const [fileInventoryRefreshToken, setFileInventoryRefreshToken] = useState(0);
  const [projectSearchSurface, setProjectSearchSurface] = useState<ProjectSearchSurface>();
  const [projectSearchInitialQuery, setProjectSearchInitialQuery] = useState("");
  const [scratchFiles, setScratchFiles] = useState<readonly ScratchFile[]>([]);
  const [scratchFilesRestored, setScratchFilesRestored] = useState(!isElectronRuntime());
  const [scratchFileChooserOpen, setScratchFileChooserOpen] = useState(false);
  const [exportToHtmlOpen, setExportToHtmlOpen] = useState(false);
  const [replaceInFilesOpen, setReplaceInFilesOpen] = useState(false);
  const [findResults, setFindResults] = useState<FindResultsSession | null>(null);
  const [recentFindUsages, setRecentFindUsages] = useState<readonly FindResultsSession[]>([]);
  const [recentFindUsagesOpen, setRecentFindUsagesOpen] = useState(false);
  const [codeAnalysisRequest, setCodeAnalysisRequest] = useState<{
    readonly mode: "inspect" | "cleanup";
    readonly inspectionId?: CodeInspectionId;
  }>();
  const [runInspectionOpen, setRunInspectionOpen] = useState(false);
  const [stackTraceOpen, setStackTraceOpen] = useState(false);
  const [vcsOperationsOpen, setVcsOperationsOpen] = useState(false);
  const [inspectionResults, setInspectionResults] = useState<{
    readonly title: string;
    readonly issues: readonly CodeIssue[];
  }>();
  const [activeInspectorKey, setActiveInspectorKey] = useState<string>();
  const [previewInspectorKey, setPreviewInspectorKey] = useState<string>();
  const [pinnedInspectorKeys, setPinnedInspectorKeys] = useState<ReadonlySet<string>>(new Set());
  const [dirtyInspectorKeys, setDirtyInspectorKeys] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    onDirtyEditorCountChange(dirtyInspectorKeys.size);
  }, [dirtyInspectorKeys.size, onDirtyEditorCountChange]);
  useEffect(() => () => onDirtyEditorCountChange(0), [onDirtyEditorCountChange]);
  const inspector = useMemo(
    () => inspectorTabs.find((candidate) => inspectorKey(candidate) === activeInspectorKey),
    [activeInspectorKey, inspectorTabs],
  );
  const fileInventoryKey = useMemo(
    () =>
      repository.status.changes
        .map((change) => `${change.status}:${change.oldPath ?? ""}:${change.path}`)
        .sort()
        .join("\0"),
    [repository.status.changes],
  );
  useEffect(() => {
    let active = true;
    setProjectFiles([]);
    void session.loadFiles().then(
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
  }, [fileInventoryKey, fileInventoryRefreshToken, repository.snapshot.id, session.loadFiles]);
  useEffect(() => {
    let active = true;
    void readElectronSetting(SCRATCH_FILES_KEY)
      .then((value) => {
        if (active) setScratchFiles(parseScratchFiles(value));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setScratchFilesRestored(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!scratchFilesRestored) return;
    void writeElectronSettings({ [SCRATCH_FILES_KEY]: scratchFiles });
  }, [scratchFiles, scratchFilesRestored]);
  useEffect(() => {
    const repair = (): void => setFileInventoryRefreshToken((value) => value + 1);
    window.addEventListener("git-client:repair-indexes", repair);
    return () => window.removeEventListener("git-client:repair-indexes", repair);
  }, []);
  const openInspector = useCallback(
    (next: InspectorState, keepOpen = true): void => {
      const key = inspectorKey(next);
      if (next.path) {
        setRecentInspectors((current) =>
          [next, ...current.filter((candidate) => inspectorKey(candidate) !== key)].slice(0, 50),
        );
        if (!navigationInProgress.current) {
          setNavigationIndex((currentIndex) => {
            const current = navigationHistory.current.slice(0, currentIndex + 1);
            const last = current.at(-1);
            if (!last || inspectorKey(last) !== key) current.push(next);
            else current[current.length - 1] = next;
            navigationHistory.current = current.slice(-100);
            return navigationHistory.current.length - 1;
          });
        }
      }
      setInspectorTabs((current) => {
        const existing = current.findIndex((candidate) => inspectorKey(candidate) === key);
        if (existing >= 0) {
          return current.map((candidate, index) => (index === existing ? next : candidate));
        }
        if (
          !keepOpen &&
          previewInspectorKey &&
          !dirtyInspectorKeys.has(previewInspectorKey) &&
          !pinnedInspectorKeys.has(previewInspectorKey)
        ) {
          const previewIndex = current.findIndex(
            (candidate) => inspectorKey(candidate) === previewInspectorKey,
          );
          if (previewIndex >= 0) {
            return current.map((candidate, index) => (index === previewIndex ? next : candidate));
          }
        }
        return [...current, next];
      });
      if (keepOpen) {
        setPreviewInspectorKey((current) => (current === key ? undefined : current));
      } else {
        setPreviewInspectorKey(key);
      }
      setActiveInspectorKey(key);
    },
    [dirtyInspectorKeys, pinnedInspectorKeys, previewInspectorKey],
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
    [navigationIndex, openInspector],
  );
  const closeInspectors = useCallback(
    (keys: readonly string[]): void => {
      const closing = new Set(keys);
      if (closing.size === 0) return;
      const activeIndex = inspectorTabs.findIndex(
        (candidate) => inspectorKey(candidate) === activeInspectorKey,
      );
      const next = inspectorTabs.filter((candidate) => !closing.has(inspectorKey(candidate)));
      const replacement = next[Math.min(Math.max(activeIndex, 0), next.length - 1)] ?? next.at(-1);
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
      setPreviewInspectorKey((current) => (current && closing.has(current) ? undefined : current));
      setActiveInspectorKey((current) =>
        current && closing.has(current)
          ? replacement
            ? inspectorKey(replacement)
            : undefined
          : current,
      );
    },
    [activeInspectorKey, inspectorTabs],
  );
  const [commitFiles, setCommitFiles] = useState<readonly FileChange[]>([]);
  const [commitFilesLoading, setCommitFilesLoading] = useState(false);
  const [commitSignature, setCommitSignature] = useState<CommitSignature>();
  const [historyRewrite, setHistoryRewrite] = useState<HistoryRewriteRequest | null>(null);
  const [bottomCollapsed, setBottomCollapsed] = useState(true);
  const [projectOpen, setProjectOpen] = useState(true);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<ProjectBookmarks>(() =>
    parseProjectBookmarks(null, repository.snapshot.name),
  );
  const [bookmarksPopupMode, setBookmarksPopupMode] = useState<BookmarksPopupMode>();
  const [bookmarkMnemonicTarget, setBookmarkMnemonicTarget] = useState<BookmarkMnemonicTarget>();
  const [bookmarkGroupTarget, setBookmarkGroupTarget] = useState<BookmarkGroupTarget>();
  const [bookmarksRestored, setBookmarksRestored] = useState(!isElectronRuntime());
  const [logOpen, setLogOpen] = useState(true);
  const [logTabIds, setLogTabIds] = useState<readonly string[]>(["log-1"]);
  const [activeLogTabId, setActiveLogTabId] = useState("log-1");
  const nextLogTabNumber = useRef(2);
  const [logIndexing, setLogIndexing] = useState(false);
  const [logIndexingEnabled, setLogIndexingEnabled] = useState(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(DEFAULT_BOTTOM_PANEL_HEIGHT);
  const [sideToolWindowWidth, setSideToolWindowWidth] = useState(DEFAULT_SIDE_TOOL_WINDOW_WIDTH);
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomPanelTab>("shelf");
  const [changesNavigatorWidth, setChangesNavigatorWidth] = useState(250);
  const [historyReviewWidth, setHistoryReviewWidth] = useState(210);
  const [commitRailWidth, setCommitRailWidth] = useState(315);
  const [toast, setToast] = useState<string>();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [processesOpen, setProcessesOpen] = useState(false);
  const [activeToolWindow, setActiveToolWindow] = useState<
    "project" | "bookmarks" | "bottom" | null
  >(null);
  const [maximizedToolWindow, setMaximizedToolWindow] = useState<
    "project" | "bookmarks" | "bottom" | null
  >(null);
  useSyncExternalStore(
    terminalService.subscribe,
    terminalService.snapshot,
    terminalService.snapshot,
  );
  const terminalTabCount = terminalService.sessions(repository.snapshot.id).length;
  const [shareProjectProvider, setShareProjectProvider] = useState<"gitHub" | "gitLab">();
  const [shareExistingRemotes, setShareExistingRemotes] = useState<ShareExistingRemotes>();
  const [notifications, setNotifications] = useState<readonly ProductNotification[]>([]);
  const [balloonId, setBalloonId] = useState<string>();
  const [uiStateRestored, setUiStateRestored] = useState(!isElectronRuntime());
  const dialog = useAppDialog();
  const [editorStatus, setEditorStatus] = useState<EditorStatus>();
  const lastToolWindow = useRef<"project" | "bookmarks" | "bottom">("project");
  const lastAutoShownActivity = useRef<string | undefined>(undefined);
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
  }, []);
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
  }, [bookmarksOpen, bottomCollapsed, maximizedToolWindow, projectOpen]);
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
  }, [bottomPanelTab]);
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
  ]);
  useEffect(() => {
    const activity = session.activity;
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
  }, [productSettings.processWindowAutoShow, session.activity]);
  useEffect(() => {
    const update = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      setEditorStatus(isEditorStatus(event.detail) ? event.detail : undefined);
    };
    window.addEventListener("git-client:editor-status", update);
    return () => window.removeEventListener("git-client:editor-status", update);
  }, []);
  const openLineBookmark = useCallback(
    (bookmark: LineBookmark): void => {
      if (bookmark.path.startsWith("Scratches/")) {
        const name = bookmark.path.slice("Scratches/".length);
        const scratch = scratchFiles.find((file) => file.name === name);
        if (scratch) {
          openInspector({
            revision: `scratch:${scratch.id}`,
            source: {
              kind: "revision",
              revision: `scratch:${scratch.id}`,
            },
            path: scratch.name,
            tab: "file",
            line: bookmark.line,
            column: bookmark.column,
            scratchId: scratch.id,
          });
          return;
        }
      }
      setRepositoryViewMode("history");
      openInspector({
        revision: repository.snapshot.headOid ?? "HEAD",
        source: { kind: "workingTree" },
        path: bookmark.path,
        tab: "file",
        line: bookmark.line,
        column: bookmark.column,
      });
    },
    [openInspector, repository.snapshot.headOid, scratchFiles],
  );
  const openScratchFile = useCallback(
    (scratch: ScratchFile, line?: number, column?: number): void => {
      setRepositoryViewMode("history");
      openInspector({
        revision: `scratch:${scratch.id}`,
        source: {
          kind: "revision",
          revision: `scratch:${scratch.id}`,
        },
        path: scratch.name,
        tab: "file",
        line,
        column,
        scratchId: scratch.id,
      });
    },
    [openInspector],
  );
  const createScratchFile = useCallback(
    (language: ScratchLanguage): void => {
      const scratch: ScratchFile = {
        id: crypto.randomUUID(),
        name: nextScratchName(scratchFiles, language),
        languageId: language.id,
        content: "",
        updatedAtMs: Date.now(),
      };
      setScratchFiles((current) => [...current, scratch]);
      setScratchFileChooserOpen(false);
      openScratchFile(scratch);
    },
    [openScratchFile, scratchFiles],
  );
  const exportToHtml = useCallback(
    async (
      scope: HtmlExportScope,
      includeLineNumbers: boolean,
      openInBrowser: boolean,
    ): Promise<boolean> => {
      const files: { readonly path: string; readonly content: string }[] = [];
      if (scope === "selection") {
        if (!editorStatus?.selectedText || !inspector?.path) {
          throw new Error("Select text in an editor before exporting.");
        }
        files.push({
          path: inspector.path,
          content: editorStatus.selectedText,
        });
      } else if (scope === "file") {
        if (!inspector?.path) throw new Error("Open a file before exporting.");
        const scratch = inspector.scratchId
          ? scratchFiles.find((file) => file.id === inspector.scratchId)
          : undefined;
        if (scratch) {
          files.push({
            path: scratch.name,
            content: scratch.content,
          });
        } else {
          const content = await session.readFile(inspector.source, inspector.path);
          if (content.kind !== "text") {
            throw new Error("Only text files can be exported to HTML.");
          }
          files.push({
            path: inspector.path,
            content: content.content,
          });
        }
      } else {
        for (const path of projectFiles.slice(0, 1_000)) {
          const content = await session.readFile({ kind: "workingTree" }, path);
          if (content.kind === "text") {
            files.push({ path, content: content.content });
          }
        }
      }
      if (files.length === 0) {
        throw new Error("No text files are available to export.");
      }
      return exportHtmlFiles({
        files,
        includeLineNumbers,
        openInBrowser,
      });
    },
    [editorStatus?.selectedText, inspector, projectFiles, scratchFiles, session.readFile],
  );
  const replaceInProjectFiles = useCallback(
    async (
      paths: readonly string[],
      query: string,
      replacement: string,
      options: ProjectSearchOptions,
    ): Promise<number> => {
      const pending: {
        readonly path: string;
        readonly before: string;
        readonly after: string;
        readonly replacementCount: number;
      }[] = [];
      for (const path of new Set(paths)) {
        const content = await session.readFile({ kind: "workingTree" }, path);
        if (content.kind !== "text") continue;
        const expression = replacementExpression(query, options);
        const replacementCount = content.content.match(expression)?.length ?? 0;
        if (replacementCount === 0) continue;
        const after = replaceProjectText(content.content, query, replacement, options);
        if (after !== content.content) {
          pending.push({
            path,
            before: content.content,
            after,
            replacementCount,
          });
        }
      }
      if (pending.length === 0) return 0;
      const written: (typeof pending)[number][] = [];
      try {
        for (const change of pending) {
          await session.writeWorkingTreeFile(change.path, change.after, "Replace in Files");
          written.push(change);
        }
      } catch (reason) {
        const rollbackFailures: string[] = [];
        for (const change of [...written].reverse()) {
          try {
            await session.writeWorkingTreeFile(
              change.path,
              change.before,
              "Rollback Replace in Files",
            );
          } catch {
            rollbackFailures.push(change.path);
          }
        }
        const message = reason instanceof Error ? reason.message : String(reason);
        throw new Error(
          rollbackFailures.length === 0
            ? `${message} All completed replacements were rolled back.`
            : `${message} Rollback failed for: ${rollbackFailures.join(", ")}`,
        );
      }
      return pending.reduce((total, change) => total + change.replacementCount, 0);
    },
    [session.readFile, session.writeWorkingTreeFile],
  );
  const codeAnalysisPaths = useCallback(
    (scope: CodeAnalysisScope): readonly string[] => {
      if (scope === "file") {
        return inspector?.path && inspector.scratchId === undefined ? [inspector.path] : [];
      }
      return projectFiles.slice(0, 1_000);
    },
    [inspector?.path, inspector?.scratchId, projectFiles],
  );
  const runCodeInspection = useCallback(
    async (scope: CodeAnalysisScope, inspectionId?: CodeInspectionId): Promise<void> => {
      const enabled = inspectionId ? new Set<CodeInspectionId>([inspectionId]) : undefined;
      const issues: CodeIssue[] = [];
      if (scope === "file" && inspector?.scratchId) {
        const scratch = scratchFiles.find((file) => file.id === inspector.scratchId);
        if (scratch) {
          issues.push(...inspectText(`Scratches/${scratch.name}`, scratch.content, enabled));
        }
      } else {
        for (const path of codeAnalysisPaths(scope)) {
          const content = await session.readFile({ kind: "workingTree" }, path);
          if (content.kind === "text") {
            issues.push(...inspectText(path, content.content, enabled));
          }
        }
      }
      setInspectionResults({
        title: "Inspection Results",
        issues,
      });
    },
    [codeAnalysisPaths, inspector?.scratchId, scratchFiles, session.readFile],
  );
  const runCodeCleanup = useCallback(
    async (scope: CodeAnalysisScope): Promise<void> => {
      const saveTasks: Promise<void>[] = [];
      window.dispatchEvent(
        new CustomEvent("git-client:save-all", {
          detail: { tasks: saveTasks },
        }),
      );
      await Promise.all(saveTasks);
      if (scope === "file" && inspector?.scratchId) {
        setScratchFiles((current) =>
          current.map((file) =>
            file.id === inspector.scratchId
              ? { ...file, content: cleanupText(file.content) }
              : file,
          ),
        );
        setToast("Code cleanup completed");
        return;
      }
      const pending: {
        readonly path: string;
        readonly before: string;
        readonly after: string;
      }[] = [];
      for (const path of codeAnalysisPaths(scope)) {
        const content = await session.readFile({ kind: "workingTree" }, path);
        if (content.kind !== "text") continue;
        const after = cleanupText(content.content);
        if (after !== content.content) {
          pending.push({ path, before: content.content, after });
        }
      }
      if (pending.length === 0) {
        setToast("No cleanup changes were required");
        return;
      }
      const written: (typeof pending)[number][] = [];
      try {
        for (const change of pending) {
          await session.writeWorkingTreeFile(change.path, change.after, "Code Cleanup");
          written.push(change);
        }
      } catch (reason) {
        const rollbackFailures: string[] = [];
        for (const change of [...written].reverse()) {
          try {
            await session.writeWorkingTreeFile(change.path, change.before, "Rollback Code Cleanup");
          } catch {
            rollbackFailures.push(change.path);
          }
        }
        const message = reason instanceof Error ? reason.message : String(reason);
        throw new Error(
          rollbackFailures.length === 0
            ? `${message} Completed cleanup writes were rolled back.`
            : `${message} Rollback failed for: ${rollbackFailures.join(", ")}`,
        );
      }
      window.dispatchEvent(new CustomEvent("git-client:reload-editors"));
      await session.reload();
      setToast(`Cleaned ${pending.length.toLocaleString()} files`);
    },
    [
      codeAnalysisPaths,
      inspector?.scratchId,
      session.readFile,
      session.reload,
      session.writeWorkingTreeFile,
    ],
  );
  const openCodeIssue = useCallback(
    (issue: CodeIssue): void => {
      const scratchName = issue.path.startsWith("Scratches/")
        ? issue.path.slice("Scratches/".length)
        : null;
      if (scratchName) {
        const scratch = scratchFiles.find((file) => file.name === scratchName);
        if (scratch) openScratchFile(scratch, issue.line, issue.column);
        return;
      }
      const path = projectFiles.find(
        (candidate) => issue.path === candidate || issue.path.endsWith(`/${candidate}`),
      );
      if (!path) return;
      setRepositoryViewMode("history");
      openInspector({
        revision: repository.snapshot.headOid ?? "HEAD",
        source: { kind: "workingTree" },
        path,
        tab: "file",
        line: issue.line,
        column: issue.column,
      });
      setInspectionResults(undefined);
    },
    [openInspector, openScratchFile, projectFiles, repository.snapshot.headOid, scratchFiles],
  );
  const openStackFrame = useCallback(
    (frame: StackTraceFrame): void => {
      if (!frame.path || !frame.line) return;
      const path = projectFiles.find(
        (candidate) => frame.path === candidate || frame.path?.endsWith(`/${candidate}`),
      );
      if (!path) return;
      setStackTraceOpen(false);
      setRepositoryViewMode("history");
      openInspector({
        revision: repository.snapshot.headOid ?? "HEAD",
        source: { kind: "workingTree" },
        path,
        tab: "file",
        line: frame.line,
        column: 1,
      });
    },
    [openInspector, projectFiles, repository.snapshot.headOid],
  );
  const requestToggleBookmark = useCallback(
    (location: BookmarkLocation): void => {
      const existing = bookmarkAt(bookmarks, location);
      if (existing) {
        setBookmarks((current) => removeBookmark(current, existing.id));
        return;
      }
      const bookmarkId = crypto.randomUUID();
      if (bookmarks.groups.length > 1 && !bookmarks.groups.some((group) => group.isDefault)) {
        setBookmarkGroupTarget({
          bookmarkId,
          location,
          mnemonic: null,
          description: "",
        });
        return;
      }
      setBookmarks((current) => toggleLineBookmark(current, location, bookmarkId));
    },
    [bookmarks],
  );
  const toggleCurrentBookmark = useCallback((): void => {
    if (!editorStatus) return;
    requestToggleBookmark({
      path: editorStatus.path,
      line: editorStatus.line,
      column: editorStatus.column,
    });
  }, [editorStatus, requestToggleBookmark]);
  const beginMnemonicBookmark = useCallback((): void => {
    if (!editorStatus) return;
    const location = {
      path: editorStatus.path,
      line: editorStatus.line,
      column: editorStatus.column,
    };
    const existing = bookmarkAt(bookmarks, location);
    setBookmarkMnemonicTarget({
      bookmarkId: existing?.id ?? crypto.randomUUID(),
      location,
      current: existing?.mnemonic ?? null,
      description: existing?.description ?? "",
      creating: existing === null,
    });
  }, [bookmarks, editorStatus]);
  const chooseBookmarkMnemonic = useCallback(
    async (
      target: BookmarkMnemonicTarget,
      mnemonic: BookmarkMnemonic,
      description: string,
    ): Promise<void> => {
      const conflict = allLineBookmarks(bookmarks).find(
        (bookmark) => bookmark.id !== target.bookmarkId && bookmark.mnemonic === mnemonic,
      );
      if (conflict) {
        const accepted = await dialog.confirm({
          title: "Rewrite Mnemonic",
          description: `‘${mnemonic}’ mnemonic is already taken by ‘${conflict.path}:${conflict.line}’. Do you want to rewrite it?`,
          impact: "The existing bookmark will remain, but its mnemonic will be removed.",
          confirmLabel: "Rewrite",
          dangerous: true,
        });
        if (!accepted) return;
      }
      if (
        bookmarkAt(bookmarks, target.location) === null &&
        bookmarks.groups.length > 1 &&
        !bookmarks.groups.some((group) => group.isDefault)
      ) {
        setBookmarkMnemonicTarget(undefined);
        setBookmarkGroupTarget({
          bookmarkId: target.bookmarkId,
          location: target.location,
          mnemonic,
          description,
        });
        return;
      }
      setBookmarks((current) => {
        const atLocation = bookmarkAt(current, target.location);
        const withBookmark = atLocation
          ? current
          : toggleLineBookmark(current, target.location, target.bookmarkId, mnemonic);
        const bookmarkId = bookmarkAt(withBookmark, target.location)?.id ?? target.bookmarkId;
        return describeBookmark(
          assignBookmarkMnemonic(withBookmark, bookmarkId, mnemonic),
          bookmarkId,
          description,
        );
      });
      setBookmarkMnemonicTarget(undefined);
    },
    [bookmarks, dialog.confirm],
  );
  const setInspectorDirty = useCallback((key: string, dirty: boolean): void => {
    if (dirty) {
      setPreviewInspectorKey((current) => (current === key ? undefined : current));
    }
    setDirtyInspectorKeys((current) => {
      if (current.has(key) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const requestCloseInspectors = useCallback(
    async (keys: readonly string[]): Promise<void> => {
      const uniqueKeys = [...new Set(keys)];
      const dirtyCount = uniqueKeys.filter((key) => dirtyInspectorKeys.has(key)).length;
      if (dirtyCount > 0) {
        const accepted = await dialog.confirm({
          title:
            dirtyCount === 1
              ? "Discard unsaved editor changes?"
              : `Discard changes in ${dirtyCount} editor tabs?`,
          description: `${dirtyCount} file${dirtyCount === 1 ? " has" : "s have"} changes that have not been written to the working tree.`,
          impact: "Unsaved editor content will be lost.",
          confirmLabel: uniqueKeys.length === 1 ? "Discard and close" : "Discard and close tabs",
          dangerous: true,
        });
        if (!accepted) return;
      }
      closeInspectors(uniqueKeys);
    },
    [closeInspectors, dialog.confirm, dirtyInspectorKeys],
  );
  const requestCloseInspector = useCallback(
    (key: string): Promise<void> => requestCloseInspectors([key]),
    [requestCloseInspectors],
  );
  const openNewLogTab = useCallback((): void => {
    const tabId = `log-${nextLogTabNumber.current}`;
    nextLogTabNumber.current += 1;
    setLogTabIds((current) => [...current, tabId]);
    setActiveLogTabId(tabId);
    setActiveInspectorKey(undefined);
    setRepositoryViewMode("history");
    setLogOpen(true);
  }, []);
  const openGitLogTab = useCallback((): void => {
    if (logOpen) {
      openNewLogTab();
      return;
    }
    if (logTabIds.length === 0) setLogTabIds(["log-1"]);
    setActiveLogTabId(logTabIds[0] ?? "log-1");
    setActiveInspectorKey(undefined);
    setRepositoryViewMode("history");
    setLogOpen(true);
  }, [logOpen, logTabIds, openNewLogTab]);
  const closeLogTab = useCallback(
    (tabId: string): void => {
      const index = logTabIds.indexOf(tabId);
      const next = logTabIds.filter((candidate) => candidate !== tabId);
      if (next.length === 0) {
        setLogTabIds(["log-1"]);
        setActiveLogTabId("log-1");
        setLogOpen(false);
        return;
      }
      setLogTabIds(next);
      if (activeLogTabId === tabId) {
        setActiveLogTabId(next[Math.min(Math.max(index, 0), next.length - 1)] ?? next[0]!);
      }
    },
    [activeLogTabId, logTabIds],
  );
  const requestOpenRepositoryTool = useCallback(
    async (kind: RepositoryToolKind): Promise<void> => {
      if (dirtyInspectorKeys.size > 0) {
        const accepted = await dialog.confirm({
          title: "Leave editors with unsaved changes?",
          description: `${dirtyInspectorKeys.size} editor tab(s) contain unsaved changes.`,
          impact: "Unsaved editor content will be lost.",
          confirmLabel: "Discard and continue",
          dangerous: true,
        });
        if (!accepted) return;
      }
      onOpenRepositoryTool(kind);
    },
    [dialog.confirm, dirtyInspectorKeys.size, onOpenRepositoryTool],
  );
  const workingEntries = useMemo(() => changeEntries(repository.status), [repository.status]);
  const vcsFilePath =
    (inspector && inspector.scratchId === undefined ? inspector.path : null) ??
    changeSelection?.path ??
    historySelectedPath ??
    null;
  const vcsFileChange = vcsFilePath
    ? (repository.status.changes.find((change) => change.path === vcsFilePath) ?? null)
    : null;
  const vcsFileEntry = vcsFilePath
    ? (workingEntries.find(
        (entry) => entry.selection.path === vcsFilePath && entry.selection.layer === "worktree",
      ) ??
      workingEntries.find((entry) => entry.selection.path === vcsFilePath) ??
      null)
    : null;
  const vcsFileVersioned = Boolean(vcsFilePath && vcsFileChange?.status !== "untracked");
  const untrackedPaths = useMemo(
    () =>
      repository.status.changes
        .filter((change) => change.status === "untracked")
        .map((change) => change.path),
    [repository.status.changes],
  );
  const hasTrackedWorkingChanges = repository.status.changes.some(
    (change) => change.status !== "untracked" && change.worktree,
  );
  const conflictedFile = repository.status.changes.find((change) => change.status === "conflicted");
  const openVcsFileTab = useCallback(
    (tab: "history" | "blame"): void => {
      if (!vcsFilePath) return;
      setRepositoryViewMode("history");
      openInspector({
        revision: repository.snapshot.headOid ?? "HEAD",
        source: { kind: "workingTree" },
        path: vcsFilePath,
        tab,
      });
    },
    [openInspector, repository.snapshot.headOid, vcsFilePath],
  );
  const rollbackVcsFile = useCallback(async (): Promise<void> => {
    if (!vcsFileChange || !vcsFileChange.worktree) return;
    const accepted = await dialog.confirm({
      title: `Rollback ${vcsFileChange.path}?`,
      description: "Restore the working-tree file to its indexed version.",
      impact: "Uncommitted working-tree edits in this file will be lost.",
      confirmLabel: "Rollback",
      dangerous: true,
    });
    if (!accepted) return;
    await session.executeOperation({
      kind: "discard",
      paths: [vcsFileChange.path],
    });
  }, [dialog.confirm, session.executeOperation, vcsFileChange]);
  const showVcsFileChanges = useCallback((): void => {
    if (!vcsFileEntry) return;
    setProjectOpen(false);
    setBookmarksOpen(false);
    setChangeSelection(vcsFileEntry.selection);
    setRepositoryViewMode("changes");
  }, [vcsFileEntry]);
  const compareVcsFile = useCallback(
    async (selection: "revision" | "ref"): Promise<void> => {
      if (!vcsFilePath || !repository.snapshot.headOid) return;
      const revision = await dialog.input({
        title: selection === "ref" ? "Compare with Branch or Tag" : "Compare with Revision",
        label: selection === "ref" ? "Branch or tag" : "Revision",
        initialValue: selection === "ref" ? (repository.snapshot.upstream ?? "main") : "HEAD~1",
        description: `Compare the selected repository version of ${vcsFilePath} with the working tree.`,
      });
      if (!revision) return;
      const file: FileChange = vcsFileChange ?? {
        path: vcsFilePath,
        status: "modified",
        staged: false,
        worktree: false,
      };
      setDiffState({ file, patch: "", loading: true, mode: "readOnly" });
      try {
        const patch = await session.loadRevisionDiff(
          revision,
          null,
          nativeDiffOptions(diffPreferences),
          [vcsFilePath],
        );
        setDiffState({ file, patch, loading: false, mode: "readOnly" });
      } catch (error) {
        setDiffState({
          file,
          patch: `Unable to compare repository versions: ${String(error)}`,
          loading: false,
          mode: "readOnly",
        });
      }
    },
    [
      dialog.input,
      diffPreferences,
      repository.snapshot.headOid,
      repository.snapshot.upstream,
      session.loadRevisionDiff,
      vcsFileChange,
      vcsFilePath,
    ],
  );
  const createPatchFromLocalChanges = useCallback(async (): Promise<void> => {
    const patch = await session.loadLocalChangesPatch();
    if (patch.trim() === "") {
      throw new Error("There are no tracked local changes to export.");
    }
    if (
      await exportPatchText({
        defaultName: `${repository.snapshot.name}.patch`,
        content: patch,
      })
    ) {
      setToast(`Exported local changes · ${patch.length.toLocaleString()} characters`);
    }
  }, [repository.snapshot.name, session.loadLocalChangesPatch]);
  const applyPatchFromFile = useCallback(async (): Promise<void> => {
    const selectedPath = await selectPatchImportPath();
    if (selectedPath === null) return;
    await session.importPatch(selectedPath);
    setToast("Patch applied to the index and working tree.");
  }, [session.importPatch]);
  const applyPatchFromClipboard = useCallback(async (): Promise<void> => {
    const patch = await readClipboardText();
    if (patch.trim() === "") {
      throw new Error("The clipboard does not contain a patch.");
    }
    const accepted = await dialog.confirm({
      title: "Apply Patch",
      description: "Apply the Git patch from the clipboard to the working tree?",
      impact: `${patch.length.toLocaleString()} characters`,
      confirmLabel: "Apply Patch",
    });
    if (!accepted) return;
    await session.executeOperation({
      kind: "applyPatch",
      patch,
      cached: false,
      reverse: false,
    });
    setToast("Clipboard patch applied to the working tree.");
  }, [dialog.confirm, session.executeOperation]);
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
    if (selectedOids.length === 0) return;
    const validOids = selectedOids.filter((oid) =>
      repository.commits.some((commit) => commit.oid === oid),
    );
    if (validOids.length !== selectedOids.length) setSelectedOids(validOids);
  }, [repository.commits, selectedOids]);

  useEffect(() => {
    setChangeSelection((current) => reconcileChangeSelection(current, workingEntries));
  }, [workingEntries]);

  useEffect(() => {
    setHistoryParentRevision(primaryCommit?.parents[0] ?? (primaryCommit ? EMPTY_TREE_OID : null));
  }, [primaryCommit?.oid]);

  useEffect(() => {
    if (!isElectronRuntime()) return;
    let active = true;
    const restore = async (): Promise<void> => {
      try {
        const stored = await readElectronSetting(`repositoryUiState:${repository.snapshot.id}`);
        if (!active) return;
        const migrated = migrateRepositoryUiState(stored);
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
          migrated.activeLogTabId && migrated.logTabIds.includes(migrated.activeLogTabId)
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
  }, [repository.snapshot.id]);

  useEffect(() => {
    if (!isElectronRuntime() || !uiStateRestored) return;
    const persist = async (): Promise<void> => {
      try {
        await writeElectronSettings({
          [`repositoryUiState:${repository.snapshot.id}`]: {
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
          },
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
    repository.snapshot.id,
    repositoryViewMode,
    selectedOids,
    selectedRef,
    uiStateRestored,
  ]);

  useEffect(() => {
    if (!isElectronRuntime()) {
      setBookmarks(parseProjectBookmarks(null, repository.snapshot.name));
      setBookmarksRestored(true);
      return;
    }
    let active = true;
    setBookmarksRestored(false);
    const restore = async (): Promise<void> => {
      try {
        const stored = await readElectronSetting(`repositoryBookmarks:${repository.snapshot.id}`);
        if (active) {
          setBookmarks(parseProjectBookmarks(stored, repository.snapshot.name));
        }
      } catch (error) {
        console.warn("Could not restore project bookmarks", error);
        if (active) {
          setBookmarks(parseProjectBookmarks(null, repository.snapshot.name));
        }
      } finally {
        if (active) setBookmarksRestored(true);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [repository.snapshot.id, repository.snapshot.name]);

  useEffect(() => {
    if (!isElectronRuntime() || !bookmarksRestored) return;
    void writeElectronSettings({
      [`repositoryBookmarks:${repository.snapshot.id}`]: bookmarks,
    }).catch((error: unknown) => {
      console.warn("Could not persist project bookmarks", error);
    });
  }, [bookmarks, bookmarksRestored, repository.snapshot.id]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(undefined), 2_800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!showNotifications || !showShortcutConflictWarning) return;
    const notification: ProductNotification = {
      id: "macos-shortcut-conflicts",
      title: "Shortcuts conflicts",
      message:
        "Find Action… and 16 more shortcut conflict with macOS shortcuts. Modify these shortcuts or change macOS system settings.",
      kind: "info",
      createdAt: Date.now(),
      actions: ["modifyShortcuts", "dismiss", "more"],
    };
    setNotifications((current) =>
      current.some((item) => item.id === notification.id) ? current : [...current, notification],
    );
    setBalloonId(notification.id);
  }, [showNotifications, showShortcutConflictWarning]);

  useEffect(() => {
    if (!balloonId) return;
    const timeout = window.setTimeout(() => {
      setBalloonId(undefined);
      if (balloonId === "macos-shortcut-conflicts") {
        setNotifications((current) => current.filter((item) => item.id !== balloonId));
      }
    }, 10_000);
    return () => window.clearTimeout(timeout);
  }, [balloonId]);

  useEffect(() => {
    const activity = session.activity;
    if (!showNotifications || !activity || activity.status === "running") return;
    const notification: ProductNotification = {
      id: `activity:${activity.id}:${activity.status}`,
      title: activity.label,
      message:
        activity.status === "failed"
          ? (activity.error ?? "Git operation failed.")
          : activity.status === "cancelled"
            ? "Cancelled"
            : "Completed",
      kind:
        activity.status === "failed"
          ? "error"
          : activity.status === "succeeded"
            ? "success"
            : "info",
      createdAt: Date.now(),
    };
    setNotifications((current) =>
      current.some((item) => item.id === notification.id)
        ? current
        : [...current, notification].slice(-100),
    );
    setBalloonId(notification.id);
  }, [session.activity, showNotifications]);

  useEffect(() => {
    if (!showNotifications || !session.error) return;
    const notification: ProductNotification = {
      id: `error:${session.error}`,
      title: "Git Error",
      message: session.error,
      kind: "error",
      createdAt: Date.now(),
    };
    setNotifications((current) =>
      current.some((item) => item.id === notification.id)
        ? current
        : [...current, notification].slice(-100),
    );
    setBalloonId(notification.id);
  }, [session.error, showNotifications]);

  useEffect(() => {
    if (showNotifications) return;
    setNotifications([]);
    setNotificationOpen(false);
    setBalloonId(undefined);
  }, [showNotifications]);

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
        const files = await session.loadCommitFiles(primaryCommitOid);
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
  }, [primaryCommitOid, repository.snapshot.id, session.loadCommitFiles]);

  useEffect(() => {
    setHistorySelectedPath((current) => {
      if (current && commitFiles.some((file) => file.path === current)) {
        return current;
      }
      return commitFiles[0]?.path ?? null;
    });
  }, [commitFiles]);

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
        const patch = await session.loadCommitDiff(
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
    diffPreferences.contextLines,
    diffPreferences.whitespace,
    historyParentRevision,
    historySelectedPath,
    primaryCommit,
    session.loadCommitDiff,
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
        const patch = await session.loadWorkingDiff(
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
  }, [
    changeSelection,
    diffPreferences.contextLines,
    diffPreferences.whitespace,
    session.loadWorkingDiff,
    workingEntries,
  ]);

  useEffect(() => {
    const file = commitFiles.find((candidate) => candidate.path === historySelectedPath);
    if (!primaryCommit || !file?.submodule || !historyParentRevision) {
      setHistorySubmodule({ value: null, loading: false });
      return;
    }
    let active = true;
    setHistorySubmodule((current) => ({ ...current, loading: true }));
    void session
      .loadSubmoduleDiff(
        { kind: "revision", revision: historyParentRevision },
        { kind: "revision", revision: primaryCommit.oid },
        file.path,
      )
      .then(
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
    session.loadSubmoduleDiff,
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
    void session.loadSubmoduleDiff(before, after, entry.file.path).then(
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
  }, [changeSelection, repository.snapshot.headOid, session.loadSubmoduleDiff, workingEntries]);

  useEffect(() => {
    if (!primaryCommitOid || !isElectronRuntime()) {
      setCommitSignature(undefined);
      return;
    }
    let active = true;
    void session.loadCommitSignature(primaryCommitOid).then(
      (signature) => active && setCommitSignature(signature),
      () => active && setCommitSignature(undefined),
    );
    return () => {
      active = false;
    };
  }, [primaryCommitOid, session.loadCommitSignature]);

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
    void session.loadRevisionDiff(from.oid, to.oid, nativeDiffOptions(diffPreferences)).then(
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
  }, [
    diffPreferences.contextLines,
    diffPreferences.whitespace,
    selectedCommits,
    session.loadRevisionDiff,
  ]);

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
            patch: await session.loadStashPatch(stash.selector),
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
    [session.loadStashPatch],
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
    [commitsByOid, primaryCommit, repository.commits],
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
        await session.executeOperation({
          kind: "cherryPick",
          revisions: selectedCommits.map((commit) => commit.oid),
          noCommit: false,
        });
      } else if (action === "revert") {
        await session.executeOperation({
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
          await session.executeOperation({
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
        if (accepted) await session.executeOperation({ kind: "undoCommit" });
      } else if (action === "reword") {
        const message = await dialog.input({
          title: "Reword commit",
          label: "New commit message",
          initialValue: primaryCommit.subject,
          description: "Interactive rebase rewrites this commit and all descendants.",
        });
        if (message)
          await session.executeOperation({
            kind: "rewordCommit",
            revision: primaryCommit.oid,
            message,
          });
      } else if (action === "fixup") {
        await session.executeOperation({
          kind: "createFixupCommit",
          revision: primaryCommit.oid,
        });
      } else if (action === "squashInto") {
        await session.executeOperation({
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
          await session.executeOperation({
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
          await session.executeOperation({
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
        const result = await session.exportPatch(
          selectedCommits.map((commit) => commit.oid),
          targetPath,
        );
        setToast(
          `Exported ${result.commitCount} commit(s) · ${result.sizeBytes.toLocaleString()} bytes`,
        );
      } else if (action === "copyPatch") {
        const patch = await session.createPatchText(selectedCommits.map((commit) => commit.oid));
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
          await session.executeOperation({
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
      dialog.confirm,
      dialog.input,
      openInspector,
      primaryCommit,
      repository.snapshot,
      selectRelative,
      selectedCommits,
      diffPreferences,
      onOpenPush,
      session,
    ],
  );

  useEffect(() => {
    const file = commitFiles.find((candidate) => candidate.path === historySelectedPath);
    if (!primaryCommit || !file) {
      setHistoryPreview(EMPTY_PREVIEW_PAIR);
      setHistoryContent(EMPTY_CONTENT_PAIR);
      return;
    }
    const generation = historyContentGeneration.current + 1;
    historyContentGeneration.current = generation;
    const beforeSource: FileSource = {
      kind: "revision",
      revision: historyParentRevision ?? EMPTY_TREE_OID,
    };
    const afterSource: FileSource = {
      kind: "revision",
      revision: primaryCommit.oid,
    };
    setHistoryPreview((current) => ({ ...current, loading: true }));
    setHistoryContent((current) => ({ ...current, loading: true }));
    void Promise.all([
      session.readFile(beforeSource, file.oldPath ?? file.path),
      session.readFile(afterSource, file.path),
      file.binary
        ? session.readFilePreview(beforeSource, file.oldPath ?? file.path)
        : Promise.resolve(null),
      file.binary ? session.readFilePreview(afterSource, file.path) : Promise.resolve(null),
    ]).then(
      ([beforeContent, afterContent, beforePreview, afterPreview]) => {
        if (historyContentGeneration.current !== generation) return;
        setHistoryContent({
          before: beforeContent,
          after: afterContent,
          loading: false,
        });
        setHistoryPreview({
          before: beforePreview,
          after: afterPreview,
          loading: false,
        });
      },
      () => {
        if (historyContentGeneration.current !== generation) return;
        setHistoryPreview(EMPTY_PREVIEW_PAIR);
        setHistoryContent(EMPTY_CONTENT_PAIR);
      },
    );
    return () => {
      if (historyContentGeneration.current === generation) historyContentGeneration.current += 1;
    };
  }, [
    commitFiles,
    historyParentRevision,
    historySelectedPath,
    primaryCommit,
    session.readFile,
    session.readFilePreview,
  ]);

  useEffect(() => {
    const entry = workingEntries.find(
      (candidate) =>
        changeSelection?.path === candidate.selection.path &&
        changeSelection.layer === candidate.selection.layer,
    );
    if (!entry) {
      setChangePreview(EMPTY_PREVIEW_PAIR);
      setChangeContent(EMPTY_CONTENT_PAIR);
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
    const generation = changeContentGeneration.current + 1;
    changeContentGeneration.current = generation;
    setChangePreview((current) => ({ ...current, loading: true }));
    setChangeContent((current) => ({ ...current, loading: true }));
    void Promise.all([
      session.readFile(before, entry.file.oldPath ?? entry.file.path),
      session.readFile(after, entry.file.path),
      entry.file.binary
        ? session.readFilePreview(before, entry.file.oldPath ?? entry.file.path)
        : Promise.resolve(null),
      entry.file.binary ? session.readFilePreview(after, entry.file.path) : Promise.resolve(null),
    ]).then(
      ([beforeContent, afterContent, beforePreview, afterPreview]) => {
        if (changeContentGeneration.current !== generation) return;
        setChangeContent({
          before: beforeContent,
          after: afterContent,
          loading: false,
        });
        setChangePreview({
          before: beforePreview,
          after: afterPreview,
          loading: false,
        });
      },
      () => {
        if (changeContentGeneration.current !== generation) return;
        setChangePreview(EMPTY_PREVIEW_PAIR);
        setChangeContent(EMPTY_CONTENT_PAIR);
      },
    );
    return () => {
      if (changeContentGeneration.current === generation) changeContentGeneration.current += 1;
    };
  }, [
    changeSelection,
    repository.snapshot.headOid,
    session.readFile,
    session.readFilePreview,
    workingEntries,
  ]);

  const selectRef = (ref: Ref): void => {
    setSelectedRef(ref.name);
    if (commitsByOid.has(ref.oid)) setSelectedOids([ref.oid]);
  };

  const openConflict = useCallback(
    (file: FileChange): void => {
      const load = async (): Promise<void> => {
        try {
          setConflictContent(await session.readConflict(file.path));
        } catch (error) {
          setToast(`Unable to read conflict: ${String(error)}`);
        }
      };
      void load();
    },
    [session.readConflict],
  );

  const repositoryBusy = session.loading || session.activity?.status === "running";
  const repositoryAvailability = (): ReturnType<CommandDefinition["availability"]> =>
    repositoryBusy
      ? commandDisabled(session.activity?.label ?? "Repository data is loading.")
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
    [activeInspectorIndex, inspectorTabKeys],
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
  const requestShareProject = useCallback(
    async (provider: "gitHub" | "gitLab"): Promise<void> => {
      const accounts = await loadHostingAccounts().catch(() => []);
      const knownHosts = new Set([
        provider === "gitHub" ? "github.com" : "gitlab.com",
        ...accounts
          .filter((account) => account.provider === provider)
          .map((account) => new URL(account.baseUrl).hostname.toLowerCase()),
      ]);
      const matchingRemotes = [
        ...new Set(
          session.remotes
            .flatMap((remote) => [remote.fetchUrl, remote.pushUrl])
            .filter((remote) => {
              const hostname = remoteHostname(remote);
              return hostname !== null && knownHosts.has(hostname);
            }),
        ),
      ];
      if (matchingRemotes.length > 0) {
        setShareExistingRemotes({ provider, remotes: matchingRemotes });
        return;
      }
      setShareProjectProvider(provider);
    },
    [session.remotes],
  );
  const repositoryCommands = useMemo<readonly CommandDefinition[]>(
    () => [
      commandDefinition("workspace.newScratch", () => setScratchFileChooserOpen(true)),
      commandDefinition(
        "workspace.exportHtml",
        () => setExportToHtmlOpen(true),
        () =>
          inspector?.path || projectFiles.length > 0
            ? COMMAND_ENABLED
            : commandDisabled("Select a file or directory to export."),
      ),
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
      commandDefinition("view.search", focusCurrentSearch),
      commandDefinition(
        "edit.replace",
        () => {
          dispatchEditorSearch("replace");
        },
        () => {
          const activeEditor =
            document.activeElement instanceof HTMLElement
              ? document.activeElement.closest<HTMLElement>(".cm-editor")
              : null;
          const editable =
            activeEditor?.querySelector<HTMLElement>(".cm-content")?.contentEditable === "true";
          return editable
            ? COMMAND_ENABLED
            : commandDisabled("Place the caret in an editable file editor to replace text.");
        },
      ),
      commandDefinition(
        "edit.undo",
        () => {
          if (!dispatchEditorAction("undo")) document.execCommand("undo");
        },
        () =>
          document.activeElement instanceof HTMLElement &&
          (document.activeElement.closest(".cm-editor") !== null ||
            document.activeElement.matches("input, textarea, [contenteditable=true]"))
            ? COMMAND_ENABLED
            : commandDisabled("Focus an editable control first."),
      ),
      commandDefinition(
        "edit.redo",
        () => {
          if (!dispatchEditorAction("redo")) document.execCommand("redo");
        },
        () =>
          document.activeElement instanceof HTMLElement &&
          (document.activeElement.closest(".cm-editor") !== null ||
            document.activeElement.matches("input, textarea, [contenteditable=true]"))
            ? COMMAND_ENABLED
            : commandDisabled("Focus an editable control first."),
      ),
      commandDefinition(
        "edit.copyPlainText",
        async () => {
          const selection = window.getSelection()?.toString() || editorStatus?.selectedText || "";
          if (selection) await writeClipboardText(selection);
        },
        () =>
          window.getSelection()?.toString() || editorStatus?.selectedText
            ? COMMAND_ENABLED
            : commandDisabled("Select text in a file editor first."),
      ),
      commandDefinition(
        "view.searchInSelection",
        () => {
          dispatchEditorSearch("selectionScope");
        },
        () =>
          window.getSelection()?.toString() || editorStatus?.selectedText
            ? COMMAND_ENABLED
            : commandDisabled("Select text in a file editor first."),
      ),
      commandDefinition(
        "view.findWordAtCaret",
        () => {
          dispatchEditorSearch("nextWord");
        },
        () => editorActionAvailability(false),
      ),
      commandDefinition(
        "view.findPrevWordAtCaret",
        () => {
          dispatchEditorSearch("previousWord");
        },
        () => editorActionAvailability(false),
      ),
      ...(
        [
          ["edit.selectAllOccurrences", "selectAllOccurrences", false],
          ["edit.selectNextOccurrence", "selectNextOccurrence", false],
          ["edit.unselectOccurrence", "unselectOccurrence", false],
          ["edit.addCaretsToLineEnds", "addCaretsToLineEnds", false],
          ["edit.extendSelection", "extendSelection", false],
          ["edit.shrinkSelection", "shrinkSelection", false],
          ["edit.toggleCase", "toggleCase", true],
          ["edit.joinLines", "joinLines", true],
          ["edit.duplicate", "duplicate", true],
          ["edit.fillParagraph", "fillParagraph", true],
          ["edit.sortLines", "sortLines", true],
          ["edit.reverseLines", "reverseLines", true],
          ["edit.transpose", "transpose", true],
          ["edit.indentSelection", "indent", true],
          ["edit.unindentSelection", "unindent", true],
          ["edit.convertIndentsToSpaces", "convertIndentsToSpaces", true],
          ["edit.convertIndentsToTabs", "convertIndentsToTabs", true],
          ["code.expandFold", "expandFold", false],
          ["code.expandFoldRecursively", "expandFold", false],
          ["code.expandAllFolds", "expandAllFolds", false],
          ["code.collapseFold", "collapseFold", false],
          ["code.collapseFoldRecursively", "collapseFold", false],
          ["code.collapseAllFolds", "collapseAllFolds", false],
          ["code.toggleFold", "toggleFold", false],
          ["code.foldSelection", "collapseFold", false],
          ["code.foldBlock", "collapseFold", false],
          ["code.lineComment", "lineComment", true],
          ["code.blockComment", "blockComment", true],
          ["code.moveStatementDown", "moveStatementDown", true],
          ["code.moveStatementUp", "moveStatementUp", true],
          ["code.moveLineDown", "moveLineDown", true],
          ["code.moveLineUp", "moveLineUp", true],
          ["navigate.nextMethod", "nextMethod", false],
          ["navigate.previousMethod", "previousMethod", false],
          ["navigate.matchingBrace", "matchingBrace", false],
        ] as const
      ).map(([id, action, requiresEditable]) =>
        commandDefinition(
          id,
          () => {
            dispatchEditorAction(action);
          },
          () => editorActionAvailability(requiresEditable),
        ),
      ),
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
      commandDefinition("view.findNext", () => {
        if (dispatchEditorSearch("next")) return;
        window.dispatchEvent(
          new CustomEvent("git-client:find", {
            detail: { direction: 1 },
          }),
        );
      }),
      commandDefinition("view.findPrevious", () => {
        if (dispatchEditorSearch("previous")) return;
        window.dispatchEvent(
          new CustomEvent("git-client:find", {
            detail: { direction: -1 },
          }),
        );
      }),
      commandDefinition("view.toggleBottom", () => setBottomCollapsed((current) => !current)),
      {
        ...commandDefinition("view.notifications", () =>
          setNotificationOpen((current) => !current),
        ),
        checked: () => notificationOpen,
      },
      commandDefinition("view.gitConsole", () => {
        setBottomCollapsed(false);
        window.requestAnimationFrame(() =>
          window.dispatchEvent(new CustomEvent("git-client:open-git-console")),
        );
      }),
      commandDefinition("view.recentLocations", () => openPaletteFor("recentLocations")),
      commandDefinition("view.recentFiles", () => openPaletteFor("recentFiles")),
      commandDefinition("view.recentlyChangedFiles", () => openPaletteFor("recentlyChangedFiles")),
      commandDefinition("navigate.file", () => openPaletteFor("files")),
      commandDefinition("navigate.class", () => {
        setProjectSearchInitialQuery("");
        setProjectSearchSurface("class");
      }),
      commandDefinition("navigate.symbol", () => {
        setProjectSearchInitialQuery("");
        setProjectSearchSurface("symbol");
      }),
      commandDefinition("navigate.text", () => {
        setProjectSearchInitialQuery("");
        setProjectSearchSurface("text");
      }),
      commandDefinition(
        "navigate.back",
        () => navigateInspectorHistory(-1),
        () =>
          navigationIndex > 0 ? COMMAND_ENABLED : commandDisabled("There is no previous location."),
      ),
      commandDefinition(
        "navigate.forward",
        () => navigateInspectorHistory(1),
        () =>
          navigationIndex + 1 < navigationHistory.current.length
            ? COMMAND_ENABLED
            : commandDisabled("There is no next location."),
      ),
      ...(
        [
          ["navigate.declaration", "definition"],
          ["navigate.implementation", "implementation"],
          ["navigate.relatedSymbol", "related"],
          ["navigate.fileStructure", "structure"],
          ["navigate.typeHierarchy", "typeHierarchy"],
          ["navigate.callHierarchy", "callHierarchy"],
        ] as const
      ).map(([id, surface]) =>
        commandDefinition(
          id,
          () => {
            setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
            setProjectSearchSurface(surface);
          },
          () => editorActionAvailability(false),
        ),
      ),
      commandDefinition("view.findInFiles", () => {
        setProjectSearchInitialQuery("");
        setProjectSearchSurface("find");
      }),
      commandDefinition("view.replaceInFiles", () => setReplaceInFilesOpen(true)),
      commandDefinition("edit.recentFindUsages", () => setRecentFindUsagesOpen(true)),
      commandDefinition(
        "edit.findUsages",
        () => {
          setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
          setProjectSearchSurface("usages");
        },
        () => editorActionAvailability(false),
      ),
      commandDefinition("edit.findUsagesSettings", onOpenSettings, () =>
        editorActionAvailability(false),
      ),
      commandDefinition(
        "edit.showUsages",
        () => {
          setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
          setProjectSearchSurface("usages");
        },
        () => editorActionAvailability(false),
      ),
      commandDefinition(
        "edit.findUsagesFile",
        () => {
          setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
          setProjectSearchSurface("usagesFile");
        },
        () => editorActionAvailability(false),
      ),
      commandDefinition(
        "edit.highlightUsages",
        () => {
          dispatchEditorSearch("nextWord");
        },
        () => editorActionAvailability(false),
      ),
      commandDefinition(
        "edit.nextHighlightedUsage",
        () => {
          dispatchEditorSearch("next");
        },
        () => editorActionAvailability(false),
      ),
      commandDefinition(
        "edit.previousHighlightedUsage",
        () => {
          dispatchEditorSearch("previous");
        },
        () => editorActionAvailability(false),
      ),
      commandDefinition("code.inspect", () => setCodeAnalysisRequest({ mode: "inspect" })),
      commandDefinition("code.cleanup", () => setCodeAnalysisRequest({ mode: "cleanup" })),
      commandDefinition("code.silentCleanup", () =>
        runCodeCleanup(inspector?.path ? "file" : "project"),
      ),
      commandDefinition("code.runInspection", () => setRunInspectionOpen(true)),
      commandDefinition("code.viewOfflineInspection", async () => {
        const files = await selectOfflineInspectionFiles();
        if (files === null) return;
        const issues = files.flatMap((file) => parseOfflineInspectionXml(file.name, file.content));
        setInspectionResults({
          title: "Offline View",
          issues,
        });
      }),
      commandDefinition("code.analyzeStackTrace", () => setStackTraceOpen(true)),
      commandDefinition("view.findToolWindow", () => {
        setBottomPanelTab("find");
        setBottomCollapsed(false);
      }),
      commandDefinition("view.quickDefinition", () => {
        setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
        setProjectSearchSurface("definition");
      }),
      commandDefinition("view.quickTypeDefinition", () => {
        setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
        setProjectSearchSurface("typeDefinition");
      }),
      commandDefinition("bookmarks.toggle", toggleCurrentBookmark, () =>
        editorStatus
          ? COMMAND_ENABLED
          : commandDisabled("Place the caret in a file editor to toggle a bookmark."),
      ),
      commandDefinition("bookmarks.toggleMnemonic", beginMnemonicBookmark, () =>
        editorStatus
          ? COMMAND_ENABLED
          : commandDisabled("Place the caret in a file editor to assign a mnemonic."),
      ),
      commandDefinition(
        "bookmarks.previous",
        () => {
          const bookmark = relativeBookmark(bookmarks, editorStatus ?? null, -1);
          if (bookmark) openLineBookmark(bookmark);
        },
        () =>
          allLineBookmarks(bookmarks).length > 0
            ? COMMAND_ENABLED
            : commandDisabled("There are no line bookmarks."),
      ),
      commandDefinition(
        "bookmarks.next",
        () => {
          const bookmark = relativeBookmark(bookmarks, editorStatus ?? null, 1);
          if (bookmark) openLineBookmark(bookmark);
        },
        () =>
          allLineBookmarks(bookmarks).length > 0
            ? COMMAND_ENABLED
            : commandDisabled("There are no line bookmarks."),
      ),
      commandDefinition("bookmarks.show", () => setBookmarksPopupMode("lines")),
      commandDefinition(
        "bookmarks.showMnemonics",
        () => setBookmarksPopupMode("mnemonics"),
        () =>
          allLineBookmarks(bookmarks).some((bookmark) => bookmark.mnemonic !== null)
            ? COMMAND_ENABLED
            : commandDisabled("No bookmark mnemonic has been assigned."),
      ),
      commandDefinition(
        "navigate.jumpNavigationBar",
        () => {
          document.querySelector<HTMLElement>('[aria-label="Navigation Bar"] button')?.focus();
        },
        () =>
          productSettings.navigationBar === "top" ||
          (productSettings.navigationBar === "status" && productSettings.statusBarVisible)
            ? COMMAND_ENABLED
            : commandDisabled("The Navigation Bar is hidden."),
      ),
      commandDefinition("workspace.saveAll", () => {
        window.dispatchEvent(new CustomEvent("git-client:save-all"));
      }),
      commandDefinition(
        "view.closeEditor",
        () => (inspector ? requestCloseInspector(inspectorKey(inspector)) : undefined),
        editorTabAvailability,
      ),
      commandDefinition(
        "view.nextEditorTab",
        () => {
          if (activeToolWindow === "bottom" && bottomPanelTab === "terminal") {
            window.dispatchEvent(
              new CustomEvent("git-client:terminal-tab-navigate", { detail: { offset: 1 } }),
            );
            return;
          }
          activateRelativeInspector(1);
        },
        () =>
          (activeToolWindow === "bottom" &&
            bottomPanelTab === "terminal" &&
            terminalTabCount > 1) ||
          (inspector && inspectorTabKeys.length > 1)
            ? COMMAND_ENABLED
            : commandDisabled("At least two tabs are required."),
      ),
      commandDefinition(
        "view.previousEditorTab",
        () => {
          if (activeToolWindow === "bottom" && bottomPanelTab === "terminal") {
            window.dispatchEvent(
              new CustomEvent("git-client:terminal-tab-navigate", { detail: { offset: -1 } }),
            );
            return;
          }
          activateRelativeInspector(-1);
        },
        () =>
          (activeToolWindow === "bottom" &&
            bottomPanelTab === "terminal" &&
            terminalTabCount > 1) ||
          (inspector && inspectorTabKeys.length > 1)
            ? COMMAND_ENABLED
            : commandDisabled("At least two tabs are required."),
      ),
      commandDefinition(
        "view.keepEditorTabOpen",
        () => setPreviewInspectorKey(undefined),
        () =>
          inspector && previewInspectorKey === activeInspectorKey
            ? COMMAND_ENABLED
            : commandDisabled("The active tab is already kept open."),
      ),
      commandDefinition(
        "view.closeOtherEditors",
        () => requestCloseInspectors(inspectorTabKeys.filter((key) => key !== activeInspectorKey)),
        () =>
          inspector && inspectorTabKeys.length > 1
            ? COMMAND_ENABLED
            : commandDisabled("There are no other editor tabs."),
      ),
      commandDefinition(
        "view.closeAllEditors",
        () => requestCloseInspectors(inspectorTabKeys),
        editorTabAvailability,
      ),
      commandDefinition(
        "view.closeUnmodifiedEditors",
        () =>
          requestCloseInspectors(inspectorTabKeys.filter((key) => !dirtyInspectorKeys.has(key))),
        () =>
          inspector && inspectorTabKeys.some((key) => !dirtyInspectorKeys.has(key))
            ? COMMAND_ENABLED
            : commandDisabled("There are no unmodified editor tabs."),
      ),
      commandDefinition(
        "view.closeUnpinnedEditors",
        () =>
          requestCloseInspectors(inspectorTabKeys.filter((key) => !pinnedInspectorKeys.has(key))),
        () =>
          inspector && inspectorTabKeys.some((key) => !pinnedInspectorKeys.has(key))
            ? COMMAND_ENABLED
            : commandDisabled("There are no unpinned editor tabs."),
      ),
      commandDefinition(
        "view.closeEditorsToLeft",
        () => requestCloseInspectors(inspectorTabKeys.slice(0, activeInspectorIndex)),
        () =>
          inspector && activeInspectorIndex > 0
            ? COMMAND_ENABLED
            : commandDisabled("There are no editor tabs to the left."),
      ),
      commandDefinition(
        "view.closeEditorsToRight",
        () => requestCloseInspectors(inspectorTabKeys.slice(activeInspectorIndex + 1)),
        () =>
          inspector &&
          activeInspectorIndex >= 0 &&
          activeInspectorIndex < inspectorTabKeys.length - 1
            ? COMMAND_ENABLED
            : commandDisabled("There are no editor tabs to the right."),
      ),
      commandDefinition(
        "view.closeReadOnlyEditors",
        () => requestCloseInspectors(readOnlyInspectorKeys),
        () =>
          inspector && readOnlyInspectorKeys.length > 0
            ? COMMAND_ENABLED
            : commandDisabled("There are no read-only editor tabs."),
      ),
      commandDefinition(
        "workspace.reloadAll",
        async () => {
          if (dirtyInspectorKeys.size > 0) {
            const accepted = await dialog.confirm({
              title: "Reload all files from disk?",
              description: `${dirtyInspectorKeys.size} editor tab(s) contain unsaved changes.`,
              impact: "Unsaved editor content will be lost.",
              confirmLabel: "Discard and reload",
              dangerous: true,
            });
            if (!accepted) return;
          }
          window.dispatchEvent(new CustomEvent("git-client:reload-editors"));
          await session.reload();
        },
        repositoryAvailability,
      ),
      commandDefinition("view.terminal", () => {
        setBottomCollapsed(false);
        window.requestAnimationFrame(() =>
          window.dispatchEvent(new CustomEvent("git-client:open-terminal")),
        );
      }),
      commandDefinition("window.jumpLastToolWindow", jumpToLastToolWindow, repositoryAvailability),
      {
        ...commandDefinition(
          "window.showProcesses",
          () => setProcessesOpen((open) => !open),
          repositoryAvailability,
        ),
        checked: () => processesOpen,
      },
      commandDefinition(
        "localHistory.show",
        () => {
          const path = inspector?.path ?? changeSelection?.path ?? historySelectedPath ?? undefined;
          const url = new URL(window.location.href);
          url.pathname = "/local-history";
          url.search = "";
          url.searchParams.set("repositoryId", repository.snapshot.id);
          url.searchParams.set("repositoryName", repository.snapshot.name);
          if (path) url.searchParams.set("path", path);
          window.open(url, "_blank", "popup=yes");
        },
        () =>
          inspector?.path || changeSelection?.path || historySelectedPath
            ? COMMAND_ENABLED
            : commandDisabled("Select a file to show its Local History."),
      ),
      commandDefinition("localHistory.showProject", () => {
        const url = new URL(window.location.href);
        url.pathname = "/local-history";
        url.search = "";
        url.searchParams.set("repositoryId", repository.snapshot.id);
        url.searchParams.set("repositoryName", repository.snapshot.name);
        window.open(url, "_blank", "popup=yes");
      }),
      commandDefinition("localHistory.recent", () => {
        window.dispatchEvent(new CustomEvent("git-client:open-local-history"));
      }),
      commandDefinition("localHistory.putLabel", async () => {
        const label = await dialog.input({
          title: "Put Label",
          label: "Label name:",
          confirmLabel: "OK",
        });
        if (label !== null && label.trim().length > 0) {
          await session.putLocalHistoryLabel(label.trim());
        }
      }),
      commandDefinition("repository.refresh", session.reload, repositoryAvailability),
      commandDefinition(
        "repository.fetch",
        () =>
          session.executeOperation({
            kind: "fetch",
            remote: null,
            prune: false,
          }),
        repositoryAvailability,
      ),
      commandDefinition(
        "repository.pull",
        () => session.executeOperation({ kind: "pull", rebase: false }),
        repositoryAvailability,
      ),
      commandDefinition("repository.push", () => onOpenPush(), repositoryAvailability),
      commandDefinition(
        "repository.update",
        () => session.executeOperation({ kind: "pull", rebase: false }),
        repositoryAvailability,
      ),
      commandDefinition("repository.merge", () => requestOpenRepositoryTool("refs")),
      commandDefinition("repository.rebase", () => requestOpenRepositoryTool("refs")),
      commandDefinition("repository.branches", () => requestOpenRepositoryTool("refs")),
      commandDefinition(
        "repository.newTag",
        async () => {
          const name = await dialog.input({
            title: "Create tag",
            label: "Tag name",
            initialValue: "v0.1.0",
            description: `Creates a lightweight tag at ${primaryCommit?.oid.slice(0, 12) ?? "HEAD"}.`,
          });
          if (!name) return;
          await session.executeOperation({
            kind: "createTag",
            name,
            revision: primaryCommit?.oid ?? "HEAD",
            message: null,
          });
        },
        () =>
          repository.snapshot.hasCommits
            ? repositoryAvailability()
            : commandDisabled("The repository has no commits."),
      ),
      commandDefinition(
        "repository.resetHead",
        async () => {
          const revision = await dialog.input({
            title: "Reset HEAD",
            label: "Commit or revision",
            initialValue: primaryCommit?.oid ?? "HEAD",
          });
          if (!revision) return;
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
          const accepted = await dialog.confirm({
            title: `Reset ${repository.snapshot.currentBranch ?? "HEAD"}?`,
            description: `Moves the current branch to ${revision}.`,
            impact:
              mode === "hard"
                ? "Hard reset discards index and working-tree changes."
                : `Reset mode: ${mode}`,
            confirmLabel: "Reset branch",
            dangerous: true,
          });
          if (!accepted) return;
          await session.executeOperation({
            kind: "reset",
            revision,
            mode: mode as "soft" | "mixed" | "hard" | "keep",
          });
        },
        () =>
          repository.snapshot.hasCommits
            ? repositoryAvailability()
            : commandDisabled("The repository has no commits."),
      ),
      commandDefinition("repository.newWorktree", () => requestOpenRepositoryTool("worktrees")),
      commandDefinition("repository.worktrees", () => requestOpenRepositoryTool("worktrees")),
      commandDefinition(
        "repository.shelveChanges",
        () => {
          setBottomCollapsed(false);
          window.dispatchEvent(new CustomEvent("git-client:shelve-changes"));
        },
        () =>
          workingEntries.length > 0
            ? repositoryAvailability()
            : commandDisabled("There are no changes to shelve."),
      ),
      commandDefinition("repository.showShelf", () => {
        setBottomCollapsed(false);
        window.dispatchEvent(
          new CustomEvent("git-client:open-bottom-panel", {
            detail: { tab: "shelf" },
          }),
        );
      }),
      commandDefinition(
        "repository.stashChanges",
        () => {
          setBottomCollapsed(false);
          window.dispatchEvent(new CustomEvent("git-client:stash-changes"));
        },
        () =>
          workingEntries.length > 0
            ? repositoryAvailability()
            : commandDisabled("There are no changes to stash."),
      ),
      commandDefinition(
        "repository.showStash",
        () => {
          setBottomCollapsed(false);
          window.dispatchEvent(
            new CustomEvent("git-client:open-bottom-panel", {
              detail: { tab: "stash" },
            }),
          );
        },
        () =>
          session.stashes.length > 0
            ? repositoryAvailability()
            : commandDisabled("There are no stash entries."),
      ),
      commandDefinition("repository.manageRemotes", () => requestOpenRepositoryTool("remotes")),
      commandDefinition("repository.manageAccounts", () => requestOpenRepositoryTool("hosting")),
      commandDefinition(
        "repository.shareGitHub",
        () => requestShareProject("gitHub"),
        () =>
          isElectronRuntime()
            ? repositoryAvailability()
            : commandDisabled("Project sharing requires the Electron application."),
      ),
      commandDefinition(
        "repository.shareGitLab",
        () => requestShareProject("gitLab"),
        () =>
          isElectronRuntime()
            ? repositoryAvailability()
            : commandDisabled("Project sharing requires the Electron application."),
      ),
      commandDefinition("repository.createPatchFromChanges", createPatchFromLocalChanges, () =>
        workingEntries.length > 0
          ? repositoryAvailability()
          : commandDisabled("There are no local changes."),
      ),
      commandDefinition("repository.applyPatch", applyPatchFromFile, repositoryAvailability),
      commandDefinition(
        "repository.applyPatchFromClipboard",
        applyPatchFromClipboard,
        repositoryAvailability,
      ),
      commandDefinition(
        "repository.operationsPopup",
        () => setVcsOperationsOpen(true),
        repositoryAvailability,
      ),
      commandDefinition(
        "repository.stageUnversioned",
        () =>
          session.executeOperation({
            kind: "stage",
            paths: untrackedPaths,
          }),
        () =>
          untrackedPaths.length > 0
            ? repositoryAvailability()
            : commandDisabled("There are no unversioned files to add."),
      ),
      commandDefinition(
        "repository.stageTracked",
        () => session.executeOperation({ kind: "stageTracked" }),
        () =>
          hasTrackedWorkingChanges
            ? repositoryAvailability()
            : commandDisabled("There are no tracked changes to stage."),
      ),
      commandDefinition("repository.rollback", rollbackVcsFile, () =>
        vcsFileChange?.status !== "untracked" && vcsFileChange?.worktree
          ? repositoryAvailability()
          : commandDisabled("Select a tracked file with working-tree changes."),
      ),
      commandDefinition("repository.commitCurrentFile", showVcsFileChanges, () =>
        vcsFileEntry
          ? repositoryAvailability()
          : commandDisabled("Select a file with changes to commit."),
      ),
      commandDefinition(
        "repository.addCurrentFile",
        () =>
          vcsFilePath
            ? session.executeOperation({
                kind: "stage",
                paths: [vcsFilePath],
              })
            : undefined,
        () =>
          vcsFilePath && vcsFileChange?.status === "untracked"
            ? repositoryAvailability()
            : commandDisabled("Select an unversioned file to add."),
      ),
      commandDefinition("repository.showCurrentFileDiff", showVcsFileChanges, () =>
        vcsFileEntry
          ? repositoryAvailability()
          : commandDisabled("Select a changed file to show its diff."),
      ),
      commandDefinition(
        "repository.compareCurrentFileRevision",
        () => compareVcsFile("revision"),
        () =>
          vcsFileVersioned && repository.snapshot.hasCommits
            ? repositoryAvailability()
            : commandDisabled("Select a versioned file to compare."),
      ),
      commandDefinition(
        "repository.compareCurrentFileRef",
        () => compareVcsFile("ref"),
        () =>
          vcsFileVersioned && repository.snapshot.hasCommits
            ? repositoryAvailability()
            : commandDisabled("Select a versioned file to compare."),
      ),
      commandDefinition(
        "repository.showFileHistory",
        () => openVcsFileTab("history"),
        () =>
          vcsFileVersioned && repository.snapshot.hasCommits
            ? repositoryAvailability()
            : commandDisabled("Select a versioned file to show its history."),
      ),
      commandDefinition(
        "repository.annotate",
        () => openVcsFileTab("blame"),
        () =>
          vcsFileVersioned && repository.snapshot.hasCommits
            ? repositoryAvailability()
            : commandDisabled("Select a versioned file to annotate."),
      ),
      commandDefinition("repository.compareCurrentFile", showVcsFileChanges, () =>
        vcsFileEntry
          ? repositoryAvailability()
          : commandDisabled("Select a changed file to compare."),
      ),
      commandDefinition(
        "repository.copyBranchName",
        async () => {
          const branch = repository.snapshot.currentBranch;
          if (!branch) return;
          await writeClipboardText(branch);
          setToast(`Copied ${branch}`);
        },
        () =>
          repository.snapshot.currentBranch
            ? COMMAND_ENABLED
            : commandDisabled("HEAD is detached."),
      ),
      commandDefinition(
        "repository.resolveConflicts",
        () => conflictedFile && openConflict(conflictedFile),
        () =>
          conflictedFile
            ? repositoryAvailability()
            : commandDisabled("There are no unresolved conflicts."),
      ),
      commandDefinition(
        "repository.unshallow",
        () => session.executeOperation({ kind: "unshallow" }),
        () =>
          repository.snapshot.isShallow
            ? repositoryAvailability()
            : commandDisabled("The repository is not shallow."),
      ),
      commandDefinition(
        "history.newBranch",
        () => runAction("newBranch"),
        () =>
          availability.newBranch
            ? repositoryAvailability()
            : commandDisabled("Select a commit to create a branch."),
      ),
      commandDefinition(
        "history.copyRevision",
        () => runAction("copyRevision"),
        () =>
          availability.copyRevision
            ? COMMAND_ENABLED
            : commandDisabled("Select one commit to copy its revision."),
      ),
    ],
    [
      availability.copyRevision,
      activeToolWindow,
      balloonId,
      availability.newBranch,
      applyPatchFromClipboard,
      applyPatchFromFile,
      beginMnemonicBookmark,
      bookmarks,
      bookmarksOpen,
      bottomPanelTab,
      activeInspectorIndex,
      activeInspectorKey,
      changeSelection?.path,
      createPatchFromLocalChanges,
      compareVcsFile,
      conflictedFile,
      dialog.confirm,
      dialog.input,
      dispatchEditorSearch,
      dispatchEditorAction,
      editorActionAvailability,
      focusCurrentSearch,
      editorStatus,
      historySelectedPath,
      hasTrackedWorkingChanges,
      inspector,
      activateRelativeInspector,
      inspectorTabKeys,
      jumpToLastToolWindow,
      logTabIds,
      dirtyInspectorKeys,
      notificationOpen,
      notifications,
      maximizedToolWindow,
      navigateInspectorHistory,
      navigationIndex,
      openLineBookmark,
      openConflict,
      openPaletteFor,
      openGitLogTab,
      openVcsFileTab,
      pinnedInspectorKeys,
      primaryCommit?.oid,
      previewInspectorKey,
      projectFiles,
      projectOpen,
      runCodeCleanup,
      productSettings.navigationBar,
      productSettings.statusBarVisible,
      readOnlyInspectorKeys,
      requestCloseInspector,
      requestCloseInspectors,
      requestShareProject,
      repository.snapshot.currentBranch,
      repository.snapshot.hasCommits,
      repository.snapshot.isShallow,
      repositoryBusy,
      repositoryViewMode,
      runAction,
      rollbackVcsFile,
      showVcsFileChanges,
      toggleCurrentBookmark,
      terminalTabCount,
      session.activity?.label,
      session.executeOperation,
      requestOpenRepositoryTool,
      workingEntries.length,
      session.reload,
      session.stashes.length,
      untrackedPaths,
      vcsFileChange,
      vcsFileEntry,
      vcsFilePath,
      vcsFileVersioned,
      onOpenSettings,
      onOpenPush,
    ],
  );
  useCommandDefinitions(repositoryCommands);

  const vcsOperationGroups = useMemo<readonly VcsOperationGroup[]>(
    () => [
      {
        label: "Git",
        items: [
          {
            commandId: "view.changes",
            icon: "commit",
            label: "Commit…",
          },
          {
            commandId: "repository.stageTracked",
            disabledReason: hasTrackedWorkingChanges
              ? undefined
              : "There are no tracked changes to stage.",
            icon: "plus",
            label: "Stage All Tracked",
          },
          {
            commandId: "view.changes",
            icon: "changes",
            label: "Toggle Commit UI…",
          },
          {
            commandId: "repository.commitCurrentFile",
            disabledReason: vcsFileEntry ? undefined : "Select a changed file to commit.",
            icon: "commit",
            label: "Commit File",
          },
          {
            commandId: "repository.rollback",
            disabledReason:
              vcsFileChange?.status !== "untracked" && vcsFileChange?.worktree
                ? undefined
                : "Select a tracked file with working-tree changes.",
            icon: "undo",
            label: "Rollback…",
          },
          {
            commandId: "repository.showFileHistory",
            disabledReason:
              vcsFileVersioned && repository.snapshot.hasCommits
                ? undefined
                : "Select a versioned file to show its history.",
            icon: "history",
            label: "Show History",
          },
          {
            commandId: "repository.annotate",
            disabledReason:
              vcsFileVersioned && repository.snapshot.hasCommits
                ? undefined
                : "Select a versioned file to annotate.",
            icon: "file",
            label: "Annotate",
          },
          {
            commandId: "repository.compareCurrentFile",
            disabledReason: vcsFileEntry ? undefined : "Select a changed file to compare.",
            icon: "compare",
            label: "Compare with Same Repository Version",
          },
        ],
      },
      {
        items: [
          {
            commandId: "repository.branches",
            icon: "branch",
            label: "Branches…",
          },
          {
            commandId: "repository.push",
            icon: "push",
            label: "Push…",
          },
          {
            commandId: "repository.stashChanges",
            disabledReason:
              workingEntries.length > 0 ? undefined : "There are no changes to stash.",
            icon: "stash",
            label: "Stash Changes…",
          },
          {
            commandId: "repository.showStash",
            disabledReason: session.stashes.length > 0 ? undefined : "There are no stash entries.",
            icon: "stash",
            label: "Unstash Changes…",
          },
        ],
      },
      {
        items: [
          {
            commandId: "repository.worktrees",
            icon: "worktree",
            label: "Worktrees…",
          },
          {
            commandId: "repository.stageUnversioned",
            disabledReason:
              untrackedPaths.length > 0 ? undefined : "There are no unversioned files to add.",
            icon: "plus",
            label: "Add to VCS",
          },
          {
            commandId: "repository.copyBranchName",
            disabledReason: repository.snapshot.currentBranch ? undefined : "HEAD is detached.",
            icon: "copy",
            label: "Copy Branch Name",
          },
          {
            commandId: "repository.resolveConflicts",
            disabledReason: conflictedFile ? undefined : "There are no unresolved conflicts.",
            icon: "warning",
            label: "Resolve Conflicts…",
          },
          {
            commandId: "repository.unshallow",
            disabledReason: repository.snapshot.isShallow
              ? undefined
              : "The repository is not shallow.",
            icon: "fetch",
            label: "Unshallow repository",
          },
          {
            commandId: "localHistory.show",
            disabledReason: vcsFilePath ? undefined : "Select a file to show its Local History.",
            icon: "history",
            label: "Show History…",
          },
        ],
      },
    ],
    [
      conflictedFile,
      hasTrackedWorkingChanges,
      repository.snapshot.currentBranch,
      repository.snapshot.hasCommits,
      repository.snapshot.isShallow,
      session.stashes.length,
      untrackedPaths.length,
      vcsFileChange,
      vcsFileEntry,
      vcsFilePath,
      vcsFileVersioned,
      workingEntries.length,
    ],
  );

  const recentFilePaths = useMemo(
    () => new Set(recentInspectors.flatMap((entry) => (entry.path ? [entry.path] : []))),
    [recentInspectors],
  );

  const loadedPaletteItems = useMemo<readonly PaletteItem[]>(
    () => [
      ...projectFiles.map((path) => {
        const parts = path.split("/");
        const label = parts.at(-1) ?? path;
        const recent = recentFilePaths.has(path);
        return {
          id: `file:${path}`,
          kind: "file" as const,
          label,
          detail: parts.length > 1 ? parts.slice(0, -1).join("/") : repository.snapshot.name,
          category: recent ? "Recent Files" : "Files",
          keywords: [path],
          scopes: recent
            ? (["files", "recentFiles", "recentLocations"] as const)
            : (["files"] as const),
          availability: COMMAND_ENABLED,
          execute: (): void => {
            setRepositoryViewMode("history");
            openInspector({
              revision: repository.snapshot.headOid ?? "HEAD",
              source: { kind: "workingTree" },
              path,
              tab: "file",
            });
          },
        };
      }),
      ...scratchFiles.map((scratch) => ({
        id: `scratch:${scratch.id}`,
        kind: "file" as const,
        label: scratch.name,
        detail: "Scratches and Consoles",
        category: "Scratch Files",
        keywords: [scratch.languageId, `Scratches/${scratch.name}`],
        scopes: ["files", "recentFiles"] as const,
        availability: COMMAND_ENABLED,
        execute: (): void => openScratchFile(scratch),
      })),
      {
        id: "action:interactive-rebase",
        kind: "command" as const,
        label: "Interactive Rebase from Here…",
        detail: primaryCommit
          ? `Rewrite ${primaryCommit.oid.slice(0, 10)} through HEAD`
          : "Select one commit in the current branch",
        category: "History",
        keywords: ["rewrite", "squash", "fixup", "reword", "drop"],
        availability: availability.interactiveRebase
          ? COMMAND_ENABLED
          : commandDisabled(
              "Select one commit in the current branch and finish active operations.",
            ),
        execute: (): void => {
          if (primaryCommit && availability.interactiveRebase) {
            setHistoryRewrite({
              fromRevision: primaryCommit.oid,
              squashOids: [],
            });
          }
        },
      },
      ...repository.refs.map((ref) => ({
        id: `ref:${ref.name}`,
        kind: "ref" as const,
        label: ref.shortName,
        detail: `${ref.kind} · ${ref.oid.slice(0, 10)}`,
        category: "Refs",
        keywords: [ref.name, ref.oid],
        availability: COMMAND_ENABLED,
        execute: (): void => {
          setRepositoryViewMode("history");
          selectRef(ref);
        },
      })),
      ...repository.commits.map((commit) => ({
        id: `commit:${commit.oid}`,
        kind: "commit" as const,
        label: commit.subject,
        detail: `${commit.oid.slice(0, 10)} · ${commit.author}`,
        category: "Commits",
        keywords: [commit.oid, commit.author, ...commit.refs],
        availability: COMMAND_ENABLED,
        execute: (): void => {
          setRepositoryViewMode("history");
          setSelectedOids([commit.oid]);
        },
      })),
      ...workingEntries.map((entry) => ({
        id: `change:${entry.selection.layer}:${entry.file.path}`,
        kind: "change" as const,
        label: entry.file.path,
        detail: `${entry.selection.layer === "index" ? "Staged" : "Working Tree"} · ${entry.file.status}`,
        category: "Changed Files",
        keywords: [entry.file.oldPath ?? "", entry.file.status],
        scopes: ["recentlyChangedFiles"] as const,
        availability: COMMAND_ENABLED,
        execute: (): void => {
          setRepositoryViewMode("changes");
          setChangeSelection(entry.selection);
        },
      })),
    ],
    [
      availability.interactiveRebase,
      primaryCommit,
      projectFiles,
      recentFilePaths,
      repository.commits,
      repository.refs,
      repository.snapshot.headOid,
      repository.snapshot.name,
      openInspector,
      openScratchFile,
      scratchFiles,
      workingEntries,
    ],
  );
  usePaletteItems(loadedPaletteItems);

  useDismissLayer(
    useMemo(
      () => ({
        id: "commit-context-menu",
        priority: 110,
        active: contextPosition !== undefined,
        dismiss: () => setContextPosition(undefined),
      }),
      [contextPosition],
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
      [diffState],
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
      [primaryCommitOid, selectedOids.length],
    ),
  );

  const commitToolWindow = (
    <ChangesWorkspace
      toolWindow
      afterContent={changeContent.after}
      afterPreview={changePreview.after}
      beforeContent={changeContent.before}
      beforePreview={changePreview.before}
      submoduleDiff={changeSubmodule.value}
      commitRailWidth={commitRailWidth}
      navigatorWidth={changesNavigatorWidth}
      changelists={session.changelists}
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
        await session.commitChangelist(changelistId, message, amend, signOff, gpgSign);
      }}
      onDeleteChangelist={session.deleteChangelist}
      onDraftChange={setCommitDraft}
      onInspectFile={(file, layer, tab) =>
        openInspector({
          revision: repository.snapshot.headOid ?? "HEAD",
          source: layer === "index" ? { kind: "index" } : { kind: "workingTree" },
          path: file.path,
          tab,
        })
      }
      onOpenConflict={openConflict}
      onOpenPush={() => onOpenPush()}
      onCommitRailWidthChange={(width) =>
        setCommitRailWidth(Math.min(480, Math.max(280, Math.round(width))))
      }
      onNavigatorWidthChange={(width) =>
        setChangesNavigatorWidth(Math.min(420, Math.max(190, Math.round(width))))
      }
      onOpenExternally={(file) => session.openWorkingTreeFile(file.path)}
      onCommitOperation={(operation) => session.executeOperation(operation, true)}
      onOperation={session.executeOperation}
      onPreCommitCheck={session.preCommitCheck}
      onPreferencesChange={setDiffPreferences}
      onSaveChangelist={session.saveChangelist}
      onSelectionChange={setChangeSelection}
      patch={changeDiff.patch}
      preferences={diffPreferences}
      selection={changeSelection}
      status={repository.status}
    />
  );
  const leftToolWindowOpen = repositoryViewMode === "changes" || projectOpen || bookmarksOpen;
  const hasEditorTabs = logOpen || inspectorTabs.length > 0;
  const terminalFocused = !hasEditorTabs && !bottomCollapsed && bottomPanelTab === "terminal";
  const baseNavigationStatus =
    session.loading || terminalFocused
      ? `Project(name=${repository.snapshot.name}, containerState=COMPONENT_CREATED, componentStore=${repository.snapshot.path})`
      : `PsiDirectory:${repository.snapshot.path}`;
  const navigationStatus =
    productSettings.navigationBarShowMembers && editorStatus
      ? `${baseNavigationStatus} › ${editorStatus.path} › ${editorStatus.line}:${editorStatus.column}`
      : baseNavigationStatus;
  useEffect(() => {
    onChromeModeChange(terminalFocused ? "terminal" : "editor");
  }, [onChromeModeChange, terminalFocused]);
  useEffect(() => () => onChromeModeChange("editor"), [onChromeModeChange]);

  return (
    <>
      {scratchFileChooserOpen && (
        <ScratchFileChooserDialog
          languages={SCRATCH_LANGUAGES}
          onChoose={createScratchFile}
          onClose={() => setScratchFileChooserOpen(false)}
        />
      )}
      {exportToHtmlOpen && (
        <ExportToHtmlDialog
          directoryName={repository.snapshot.path}
          fileName={inspector?.path}
          onClose={() => setExportToHtmlOpen(false)}
          onExport={exportToHtml}
          selectionAvailable={Boolean(editorStatus?.selectedText)}
        />
      )}
      {replaceInFilesOpen && (
        <ReplaceInFilesDialog
          onClose={() => setReplaceInFilesOpen(false)}
          onOpenResult={(result: ProjectTextMatch) => {
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
          onReplace={replaceInProjectFiles}
          search={session.searchProjectText}
        />
      )}
      {bookmarksPopupMode && (
        <BookmarksPopup
          mode={bookmarksPopupMode}
          onClose={() => setBookmarksPopupMode(undefined)}
          onOpenBookmark={openLineBookmark}
          state={bookmarks}
        />
      )}
      {bookmarkMnemonicTarget && (
        <BookmarkMnemonicDialog
          assigned={
            new Set(
              allLineBookmarks(bookmarks).flatMap((bookmark) =>
                bookmark.mnemonic ? [bookmark.mnemonic] : [],
              ),
            )
          }
          creating={bookmarkMnemonicTarget.creating}
          current={bookmarkMnemonicTarget.current}
          description={bookmarkMnemonicTarget.description}
          onChoose={(mnemonic, description) =>
            void chooseBookmarkMnemonic(bookmarkMnemonicTarget, mnemonic, description)
          }
          onClose={() => setBookmarkMnemonicTarget(undefined)}
        />
      )}
      {bookmarkGroupTarget && (
        <BookmarkGroupSelectDialog
          groups={bookmarks.groups}
          onClose={() => setBookmarkGroupTarget(undefined)}
          onSelect={(groupId, useAsDefault) => {
            setBookmarks((current) => {
              let next = addLineBookmarkToGroup(
                current,
                bookmarkGroupTarget.location,
                bookmarkGroupTarget.bookmarkId,
                groupId,
                bookmarkGroupTarget.mnemonic,
              );
              if (bookmarkGroupTarget.mnemonic !== null) {
                next = assignBookmarkMnemonic(
                  next,
                  bookmarkGroupTarget.bookmarkId,
                  bookmarkGroupTarget.mnemonic,
                );
              }
              if (bookmarkGroupTarget.description !== "") {
                next = describeBookmark(
                  next,
                  bookmarkGroupTarget.bookmarkId,
                  bookmarkGroupTarget.description,
                );
              }
              return useAsDefault ? setDefaultBookmarkGroup(next, groupId) : next;
            });
            setBookmarkGroupTarget(undefined);
          }}
        />
      )}
      {projectSearchSurface && (
        <ProjectSearchDialog
          initialQuery={projectSearchInitialQuery}
          onClose={() => setProjectSearchSurface(undefined)}
          onOpenInFindWindow={(query, options, results) => {
            const next = { query, options, results };
            setFindResults(next);
            setRecentFindUsages((current) =>
              [next, ...current.filter((session) => session.query !== query)].slice(0, 30),
            );
            setBottomPanelTab("find");
            setBottomCollapsed(false);
          }}
          onOpenResult={(result: ProjectSearchResult) => {
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
          search={session.searchProjectText}
          scrollToResults={productSettings.scrollToSearchResults}
          surface={projectSearchSurface}
          pathScope={
            projectSearchSurface === "usagesFile" || projectSearchSurface === "structure"
              ? inspector?.path
              : undefined
          }
        />
      )}
      {recentFindUsagesOpen && (
        <RecentFindUsagesDialog
          history={recentFindUsages}
          onChoose={(selected) => {
            setFindResults(selected);
            setBottomPanelTab("find");
            setBottomCollapsed(false);
            setRecentFindUsagesOpen(false);
          }}
          onClose={() => setRecentFindUsagesOpen(false)}
        />
      )}
      {runInspectionOpen && (
        <RunInspectionDialog
          onChoose={(inspectionId) => {
            setRunInspectionOpen(false);
            setCodeAnalysisRequest({
              mode: "inspect",
              inspectionId,
            });
          }}
          onClose={() => setRunInspectionOpen(false)}
        />
      )}
      {codeAnalysisRequest && (
        <CodeAnalysisScopeDialog
          currentFile={inspector?.path ?? null}
          inspectionId={codeAnalysisRequest.inspectionId}
          mode={codeAnalysisRequest.mode}
          onClose={() => setCodeAnalysisRequest(undefined)}
          onRun={(scope) =>
            codeAnalysisRequest.mode === "cleanup"
              ? runCodeCleanup(scope)
              : runCodeInspection(scope, codeAnalysisRequest.inspectionId)
          }
        />
      )}
      {inspectionResults && (
        <InspectionResultsDialog
          issues={inspectionResults.issues}
          onClose={() => setInspectionResults(undefined)}
          onOpenIssue={openCodeIssue}
          title={inspectionResults.title}
        />
      )}
      {stackTraceOpen && (
        <StackTraceDialog onClose={() => setStackTraceOpen(false)} onOpenFrame={openStackFrame} />
      )}
      {vcsOperationsOpen && (
        <VcsOperationsPopup
          groups={vcsOperationGroups}
          onClose={() => setVcsOperationsOpen(false)}
          onExecute={executeCommand}
        />
      )}
      {processesOpen && (
        <ProcessesDialog
          activity={session.activity}
          onCancelActivity={session.cancelActivity}
          onClose={() => setProcessesOpen(false)}
        />
      )}
      {productSettings.navigationBar === "top" && !productSettings.presentationMode && (
        <nav aria-label="Navigation Bar" className={tw.topNavigationBar}>
          <button aria-label={navigationStatus} title={navigationStatus}>
            <Icon name="folder" size={12} />
            <span>{navigationStatus}</span>
          </button>
        </nav>
      )}
      {hasEditorTabs && (
        <div
          className={tw.commandbar}
          style={
            {
              "--editor-left": leftToolWindowOpen && !session.loading ? "422px" : "30px",
            } as CSSProperties
          }
        >
          <nav
            aria-label={!inspector ? "Log" : "Editor tabs"}
            className={tw.editorTabs}
            onKeyDown={(event) => {
              if (
                event.key !== "ArrowLeft" &&
                event.key !== "ArrowRight" &&
                event.key !== "Home" &&
                event.key !== "End"
              ) {
                return;
              }
              const tabs = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
              ];
              const current = tabs.indexOf(event.target as HTMLButtonElement);
              if (current < 0 || tabs.length === 0) return;
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
              tabs[next]?.focus();
              tabs[next]?.click();
              event.preventDefault();
            }}
            role="tablist"
          >
            {logOpen &&
              logTabIds.map((tabId, index) => (
                <span className={tw.workspaceTab} key={tabId} role="presentation">
                  <button
                    aria-label={index === 0 ? "Log" : `Log ${index + 1}`}
                    aria-selected={!inspector && activeLogTabId === tabId}
                    className={!inspector && activeLogTabId === tabId ? tw.activeButton : undefined}
                    onClick={() => {
                      setActiveLogTabId(tabId);
                      setActiveInspectorKey(undefined);
                      setRepositoryViewMode("history");
                    }}
                    title={index === 0 ? "Log" : `Log ${index + 1}`}
                    role="tab"
                    tabIndex={!inspector && activeLogTabId === tabId ? 0 : -1}
                  >
                    <Icon name="branch" size={14} />
                    {index === 0 ? "Log" : `Log ${index + 1}`}
                  </button>
                  <button
                    aria-label={`Close ${index === 0 ? "Log" : `Log ${index + 1}`}`}
                    onClick={() => closeLogTab(tabId)}
                    title={`Close ${index === 0 ? "Log" : `Log ${index + 1}`}`}
                  >
                    <Icon name="close" size={10} />
                  </button>
                </span>
              ))}
            {inspectorTabs.map((tab) => {
              const key = inspectorKey(tab);
              const label = tab.path?.split("/").at(-1) ?? "Repository";
              return (
                <span
                  className={tw.workspaceTab}
                  data-pinned={pinnedInspectorKeys.has(key)}
                  data-preview={previewInspectorKey === key}
                  key={key}
                  role="presentation"
                >
                  <button
                    aria-label={`Editor ${tab.path ?? "Repository"}`}
                    aria-selected={key === activeInspectorKey}
                    onClick={() => setActiveInspectorKey(key)}
                    role="tab"
                    tabIndex={key === activeInspectorKey ? 0 : -1}
                    title={tab.path ?? "Repository"}
                  >
                    <Icon name={tab.tab === "tree" ? "folder" : "file"} size={14} />
                    {label}
                    {dirtyInspectorKeys.has(key) && <span aria-label="Modified">*</span>}
                  </button>
                  <button
                    aria-label={`Close editor ${tab.path ?? "Repository"}`}
                    onClick={() => void requestCloseInspector(key)}
                    title={`Close ${label}`}
                  >
                    <Icon name="close" size={10} />
                  </button>
                </span>
              );
            })}
          </nav>
          <span className={tw.editorToolbarSpacer} />
          {session.stale && <span className={tw.statePill}>Changed</span>}
          {repository.snapshot.isShallow && <span className={tw.statePill}>Shallow</span>}
          {repository.snapshot.isBare && <span className={tw.statePill}>Bare</span>}
          {repository.snapshot.operation && (
            <span className={tw.operationPill}>
              <Icon name="warning" size={13} />
              {repository.snapshot.operation} in progress
            </span>
          )}
          {repository.snapshot.operation && repository.snapshot.operation !== "bisect" && (
            <>
              <button
                onClick={() =>
                  void session.executeOperation({
                    kind: "continue",
                    operation: repository.snapshot.operation as
                      | "merge"
                      | "rebase"
                      | "cherryPick"
                      | "revert",
                  })
                }
              >
                Continue
              </button>
              {(repository.snapshot.operation === "rebase" ||
                repository.snapshot.operation === "cherryPick") && (
                <button
                  onClick={() =>
                    void session.executeOperation({
                      kind: "skip",
                      operation: repository.snapshot.operation as "rebase" | "cherryPick",
                    })
                  }
                >
                  Skip
                </button>
              )}
              <button
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
                    void session.executeOperation({
                      kind: "abort",
                      operation: repository.snapshot.operation,
                    });
                  }
                })}
              >
                Abort
              </button>
            </>
          )}
          <button
            aria-label="View Options"
            className={tw.editorToolbarIcon}
            onClick={() => void session.reload()}
            title="View Options"
          >
            <Icon name="more" size={16} />
          </button>
        </div>
      )}
      <main className={tw.workspace} aria-busy={session.loading}>
        {session.loading ? (
          <RepositoryLoadingSkeleton />
        ) : (
          <div className={tw.workbench}>
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
              terminalFocused={terminalFocused}
            />
            <div
              className={`${tw.workbenchSurface} ${maximizedToolWindow === "bottom" ? tw.maximizedBottomTool : ""}`}
            >
              <div
                className={`${tw.workbenchContent} ${leftToolWindowOpen ? tw.projectToolOpen : ""} ${maximizedToolWindow === "project" || maximizedToolWindow === "bookmarks" ? tw.maximizedSideTool : ""}`}
                style={
                  {
                    "--side-tool-window-width": `${sideToolWindowWidth}px`,
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
                      setBookmarks((current) => describeBookmark(current, bookmarkId, description))
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
                    loadTree={session.loadTree}
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
                        await session.writeWorkingTreeFile(path, "");
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
                  className={`${tw.activeWorkspace} ${!hasEditorTabs ? tw.activeWorkspaceNoTabs : ""}`}
                  data-workspace-main
                >
                  {logOpen && (
                    <div className={tw.editorSurface} hidden={Boolean(inspector)}>
                      <div
                        className={tw.mainPanes}
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
                          hasMore={session.hasMoreCommits}
                          loading={session.logLoading}
                          error={session.logError}
                          refs={repository.refs}
                          onLoad={session.loadLog}
                          onOpenNewTab={openNewLogTab}
                          indexing={logIndexing}
                          indexingEnabled={logIndexingEnabled}
                          powerSaveMode={productSettings.powerSaveMode}
                          onEnableIndexing={async (filters, order) => {
                            setLogIndexing(true);
                            try {
                              await session.indexLog(filters, order);
                              setLogIndexingEnabled(true);
                            } finally {
                              setLogIndexing(false);
                            }
                          }}
                          onCherryPick={() => void runAction("cherryPick")}
                          onImportPatch={toVoidHandler(async () => {
                            const selectedPath = await selectPatchImportPath();
                            if (selectedPath === null) return;
                            await session.importPatch(selectedPath);
                            setToast("Patch applied to the index and working tree.");
                          })}
                          onRefresh={() => void session.reload()}
                          onContextMenu={(event, commit) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!selectedOids.includes(commit.oid)) setSelectedOids([commit.oid]);
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
                              setHistoryReviewWidth(Math.min(480, Math.max(180, Math.round(width))))
                            }
                            patch={revisionComparison.patch}
                            preferences={diffPreferences}
                            reviewWidth={historyReviewWidth}
                            readFile={session.readFile}
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
                              session.loadCommitDiff(
                                commit,
                                file.path,
                                nativeDiffOptions(diffPreferences),
                                historyParentRevision ?? undefined,
                              )
                            }
                            onReadFile={session.readFile}
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
                              await session.executeOperation({
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
                              setHistoryReviewWidth(Math.min(480, Math.max(180, Math.round(width))))
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
                    </div>
                  )}
                  {!inspector && !logOpen && (
                    <div className={tw.editorEmptyWorkspace}>
                      <button onClick={openGitLogTab}>
                        Open Git Log <kbd>⌥G</kbd>
                      </button>
                      <button onClick={() => setRepositoryViewMode("changes")}>
                        Commit <kbd>⌘0</kbd>
                      </button>
                    </div>
                  )}
                  {inspectorTabs.map((tab) => {
                    const key = inspectorKey(tab);
                    const scratch = tab.scratchId
                      ? scratchFiles.find((candidate) => candidate.id === tab.scratchId)
                      : undefined;
                    return (
                      <div
                        className={tw.editorSurface}
                        hidden={key !== activeInspectorKey}
                        key={key}
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
                            loadBlame={session.loadBlame}
                            loadFileHistory={session.loadFileHistory}
                            loadTree={session.loadTree}
                            onClose={() => void requestCloseInspector(key)}
                            onDirtyChange={(dirty) => setInspectorDirty(key, dirty)}
                            onToggleBookmark={(path, line, column) =>
                              requestToggleBookmark({
                                path,
                                line,
                                column,
                              })
                            }
                            openWorkingTreeFile={session.openWorkingTreeFile}
                            readFile={session.readFile}
                            readFilePreview={session.readFilePreview}
                            writeWorkingTreeFile={session.writeWorkingTreeFile}
                            revision={tab.revision}
                            source={tab.source}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <BottomPanel
                collapsed={bottomCollapsed}
                height={bottomPanelHeight}
                active={bottomPanelTab}
                fixture={session.fixture}
                onApplyShelf={(shelfId, drop) => void session.applyShelf(shelfId, drop)}
                onCreateShelf={(message, paths) => void session.createShelf(message, paths)}
                onDeleteShelf={(shelfId) => void session.deleteShelf(shelfId)}
                onLoadStashFiles={(stash) => session.loadStashFiles(stash.selector)}
                onOpenStashDiff={openStashDiff}
                onOperation={session.executeOperation}
                onRestoreRecovery={session.restoreRecoveryEntry}
                onToggle={() => setBottomCollapsed((value) => !value)}
                onHeightChange={setBottomPanelHeight}
                onActiveChange={setBottomPanelTab}
                recoveryEntries={session.recoveryEntries}
                gitConsoleEntries={session.gitConsoleEntries}
                onClearGitConsole={session.clearGitConsole}
                onLoadLocalHistoryActivities={session.listLocalHistoryActivities}
                onLoadLocalHistoryActivity={session.readLocalHistoryActivity}
                onLoadLocalHistoryDiff={session.loadLocalHistoryDiff}
                onCreateLocalHistoryPatch={session.createLocalHistoryPatch}
                onPutLocalHistoryLabel={session.putLocalHistoryLabel}
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
                onRevertLocalHistory={session.revertLocalHistory}
                repositoryId={repository.snapshot.id}
                repositoryName={repository.snapshot.name}
                shelves={session.shelves}
                stashes={session.stashes}
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
      {productSettings.statusBarVisible && !productSettings.presentationMode && (
        <footer aria-label="Status Bar" className={tw.statusbar}>
          {productSettings.navigationBar === "status" && (
            <nav aria-label="Navigation Bar">
              <button aria-label={navigationStatus} title={navigationStatus}>
                <Icon name="folder" size={12} />
                <span>{navigationStatus}</span>
              </button>
            </nav>
          )}
          {productSettings.navigationBar !== "status" && <span className={tw.statusbarSpacer} />}
          <span className={tw.activitySlot}>
            {session.activity &&
              (productSettings.statusBarWidgets.statusText ||
                productSettings.statusBarWidgets.fileSystemSync) && (
                <span
                  className={`${tw.activityPill} ${ACTIVITY_STATUS_CLASS[session.activity.status]}`}
                  role="status"
                  title={session.activity.error ?? undefined}
                >
                  {session.activity.status === "running" ? (
                    <span className={tw.activitySpinner} />
                  ) : session.activity.status === "succeeded" ? (
                    <Icon name="check" size={11} />
                  ) : (
                    <Icon name="warning" size={11} />
                  )}
                  {productSettings.statusBarWidgets.statusText && (
                    <span>{session.activity.label}</span>
                  )}
                  {session.activity.status === "running" &&
                    session.activity.requestIds.length > 0 && (
                      <button onClick={() => void session.cancelActivity()}>Cancel</button>
                    )}
                  {session.activity.status === "failed" && session.activity.canRetry && (
                    <button onClick={() => void session.retryActivity()}>Retry</button>
                  )}
                </span>
              )}
          </span>
          <span className={tw.statusbarWidgets}>
            {productSettings.statusBarWidgets.fileSystemSync && (
              <button onClick={() => void session.reload()}>
                <Icon name="refresh" size={11} />
              </button>
            )}
            {productSettings.statusBarWidgets.aggregator && (
              <button onClick={() => setNotificationOpen(true)}>
                <Icon name="warning" size={11} />
              </button>
            )}
            {productSettings.statusBarWidgets.lineColumn && (
              <button
                aria-label="Go to Line"
                onClick={toVoidHandler(async () => {
                  const value = await dialog.input({
                    title: "Go to Line",
                    label: "Line and column",
                    initialValue: editorStatus
                      ? `${editorStatus.line}:${editorStatus.column}`
                      : "1:1",
                    placeholder: "42:1",
                    confirmLabel: "Go",
                    validate: (candidate) =>
                      /^[1-9]\d*(?::[1-9]\d*)?$/u.test(candidate)
                        ? null
                        : "Enter a line or line:column value.",
                  });
                  if (value === null) return;
                  const [line, column = "1"] = value.split(":");
                  window.dispatchEvent(
                    new CustomEvent("git-client:go-to-line", {
                      detail: {
                        line: Number(line),
                        column: Number(column),
                      },
                    }),
                  );
                })}
                title="Go to Line"
              >
                {editorStatus ? `${editorStatus.line}:${editorStatus.column}` : ""}
              </button>
            )}
            {productSettings.statusBarWidgets.languageServices && (
              <button
                aria-label="Language Services Button"
                onClick={() =>
                  setToast(
                    editorStatus
                      ? `${editorStatus.language} language services are active.`
                      : "No language service is active for the Git Log.",
                  )
                }
                title="Language Services"
              >
                {editorStatus?.language ?? ""}
              </button>
            )}
            {productSettings.statusBarWidgets.gridPosition && (
              <button>{editorStatus ? "1 × 1" : ""}</button>
            )}
            {productSettings.statusBarWidgets.lineSeparator && (
              <button>{editorStatus?.lineSeparator ?? ""}</button>
            )}
            {productSettings.statusBarWidgets.fileEncoding && (
              <button>{editorStatus ? "UTF-8" : ""}</button>
            )}
            {productSettings.statusBarWidgets.editorSelectionMode && (
              <button
                aria-label="Column selection mode"
                aria-pressed={editorStatus?.columnSelection ?? false}
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("git-client:toggle-column-selection"))
                }
                title="Column selection mode"
              >
                {editorStatus?.columnSelection ? "Column" : ""}
              </button>
            )}
            {productSettings.statusBarWidgets.powerSaveMode && (
              <button
                aria-label="Power Save Mode"
                title={
                  productSettings.powerSaveMode ? "Power Save Mode is enabled" : "Power Save Mode"
                }
              >
                {productSettings.powerSaveMode ? "Power Save Mode" : ""}
              </button>
            )}
            {productSettings.statusBarWidgets.indentation && (
              <button>{editorStatus?.indentation ?? ""}</button>
            )}
            {productSettings.statusBarWidgets.readOnlyAttribute && (
              <button
                aria-label={
                  terminalFocused || editorStatus?.readOnly === false
                    ? "Make file read-only"
                    : "Make file writable"
                }
                onClick={() =>
                  setToast(
                    editorStatus?.readOnly
                      ? "Revision content is read-only. Open its working-tree file to edit it."
                      : "The current surface is already writable.",
                  )
                }
                title={
                  terminalFocused || editorStatus?.readOnly === false
                    ? "Make file read-only"
                    : "Make file writable"
                }
              >
                {editorStatus?.readOnly ? "RO" : ""}
              </button>
            )}
            {productSettings.statusBarWidgets.memoryIndicator && (
              <button aria-label="Memory Indicator" title="Memory Indicator">
                Memory
              </button>
            )}
            <button
              aria-label="IDE error occurred"
              onClick={() => setNotificationOpen(true)}
              title="See details"
            >
              <Icon name="warning" size={11} />
            </button>
          </span>
        </footer>
      )}
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
        <section className={tw.standaloneDiff} aria-label="Standalone diff review">
          <header>
            <strong>Comparison</strong>
            <span />
            <button onClick={() => setDiffState(undefined)}>Back to workspace</button>
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
            const operation = repository.snapshot.operation;
            if (!operation || operation === "bisect") return;
            await session.executeOperation({
              kind: "abort",
              operation,
            });
            setConflictContent(undefined);
          }}
          onClose={() => setConflictContent(undefined)}
          onContinue={async () => {
            const operation = repository.snapshot.operation;
            if (!operation || operation === "bisect") return;
            await session.executeOperation({
              kind: "continue",
              operation,
            });
            setConflictContent(undefined);
          }}
          onResolveBinary={async (side) => {
            await session.resolveBinaryConflict(conflictContent.path, side);
            setConflictContent(undefined);
          }}
          onSave={async (result) => {
            await session.saveConflictResult(conflictContent.path, result, true);
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
          onExecute={(operation) => session.executeOperation(operation, true)}
          onLoadPreview={session.loadHistoryRewritePreview}
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
            const existingRemote = session.remotes.find(
              (remote) => remote.name === binding.remoteName,
            );
            if (!existingRemote) {
              await session.executeOperation(
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
                await session.executeOperation(
                  {
                    kind: "removeCached",
                    paths: excludedStagedPaths,
                  },
                  true,
                );
              }
              await session.executeOperation(
                {
                  kind: "stage",
                  paths: [...binding.initialCommit.paths],
                },
                true,
              );
              await session.executeOperation(
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
              await session.executeOperation(
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
          remoteNames={session.remotes.map((remote) => remote.name)}
        />
      )}
      {dialog.node}
      {toast && (
        <div className={tw.toast}>
          <Icon name="check" size={15} />
          {toast}
        </div>
      )}
    </>
  );
}

function AppContent() {
  const session = useGitSession();
  const commands = useCommands();
  const {
    preference: appearancePreference,
    setPreference: setAppearancePreference,
    systemTheme,
  } = useAppearance();
  const [showRepositoryDialog, setShowRepositoryDialog] = useState(false);
  const [repositoryDialogMode, setRepositoryDialogMode] = useState<RepositoryDialogMode>("open");
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [repositoryTool, setRepositoryTool] = useState<RepositoryToolKind | null>(null);
  const [pushRequest, setPushRequest] = useState<{
    readonly localRevision: string;
    readonly knownRewrite: boolean;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [activityMonitorOpen, setActivityMonitorOpen] = useState(false);
  const [specialFilesOpen, setSpecialFilesOpen] = useState(false);
  const [leftoverDirectoriesOpen, setLeftoverDirectoriesOpen] = useState(false);
  const [commandLineLauncherOpen, setCommandLineLauncherOpen] = useState(false);
  const [diagnosticConfiguration, setDiagnosticConfiguration] = useState<{
    readonly kind: DiagnosticConfigurationKind;
    readonly title: string;
    readonly description: string;
  } | null>(null);
  const [newProjectSettingsOpen, setNewProjectSettingsOpen] = useState(false);
  const [quickSwitchSchemeOpen, setQuickSwitchSchemeOpen] = useState(false);
  const [repairIdeOpen, setRepairIdeOpen] = useState(false);
  const [invalidateCachesOpen, setInvalidateCachesOpen] = useState(false);
  const [runConfigurationTemplatesOpen, setRunConfigurationTemplatesOpen] = useState(false);
  const [savedMacrosOpen, setSavedMacrosOpen] = useState(false);
  const [savedMacros, setSavedMacros] = useState<readonly SavedMacro[]>([]);
  const [savedMacrosLoaded, setSavedMacrosLoaded] = useState(false);
  const [macroRecording, setMacroRecording] = useState(false);
  const [recordedCommandIds, setRecordedCommandIds] = useState<readonly string[]>([]);
  const [lastMacro, setLastMacro] = useState<SavedMacro | null>(null);
  const [productSettings, setProductSettings] = useState(DEFAULT_PRODUCT_SETTINGS);
  const [toolWindowLayouts, setToolWindowLayouts] = useState<readonly NamedToolWindowLayout[]>([
    DEFAULT_NAMED_TOOL_WINDOW_LAYOUT,
  ]);
  const [toolWindowLayoutsLoaded, setToolWindowLayoutsLoaded] = useState(false);
  const [layoutChooserMode, setLayoutChooserMode] = useState<"restore" | "save" | "rename">();
  const [newProjectSettings, setNewProjectSettings] = useState(DEFAULT_PRODUCT_SETTINGS);
  const [newProjectAppearancePreference, setNewProjectAppearancePreference] =
    useState<AppearancePreference>(DEFAULT_APPEARANCE_PREFERENCE);
  const [runConfigurationTemplates, setRunConfigurationTemplates] = useState<
    readonly RunConfigurationTemplate[]
  >(DEFAULT_RUN_CONFIGURATION_TEMPLATES);
  const [productSettingsLoaded, setProductSettingsLoaded] = useState(false);
  const [projectDefaultsLoaded, setProjectDefaultsLoaded] = useState(false);
  const [dirtyEditorCount, setDirtyEditorCount] = useState(0);
  const [repositoryChromeMode, setRepositoryChromeMode] = useState<"editor" | "terminal">("editor");
  const presentationPreviousFullScreen = useRef(false);
  const zenPreviousFullScreen = useRef(false);
  const handleProductSettingsChange = useCallback(
    (settings: ProductSettings): void => setProductSettings(settings),
    [],
  );
  const showNotifications = productSettings.showNotifications;
  const dialog = useAppDialog();

  const confirmDiscardEditors = useCallback(async (): Promise<boolean> => {
    if (dirtyEditorCount === 0) return true;
    return dialog.confirm({
      title: "Leave editors with unsaved changes?",
      description: `${dirtyEditorCount} editor tab(s) contain unsaved changes.`,
      impact: "Unsaved editor content will be lost.",
      confirmLabel: "Discard and continue",
      dangerous: true,
    });
  }, [dialog.confirm, dirtyEditorCount]);
  const openRepositoryToolSafely = useCallback(
    async (kind: RepositoryToolKind): Promise<void> => {
      if (!(await confirmDiscardEditors())) return;
      setRepositoryTool(kind);
    },
    [confirmDiscardEditors],
  );
  const activateProjectSafely = useCallback(
    async (repositoryId: string): Promise<void> => {
      if (
        session.activeTab.kind === "repository" &&
        session.activeTab.repositoryId === repositoryId
      ) {
        return;
      }
      if (!(await confirmDiscardEditors())) return;
      await session.activateTab({ kind: "repository", repositoryId });
    },
    [confirmDiscardEditors, session.activateTab, session.activeTab],
  );
  const openRecentProjectSafely = useCallback(
    async (path: string): Promise<void> => {
      if (!(await confirmDiscardEditors())) return;
      await session.openRepository(path);
    },
    [confirmDiscardEditors, session.openRepository],
  );
  const importSettingsArchive = useCallback(async (): Promise<void> => {
    if (!(await importElectronSettings())) return;
    setProductSettings(parseProductSettings(await readElectronSetting(PRODUCT_SETTINGS_KEY)));
  }, []);

  const captureToolWindowLayout = useCallback((): ToolWindowLayout | null => {
    let captured: ToolWindowLayout | null = null;
    window.dispatchEvent(
      new CustomEvent("git-client:capture-tool-window-layout", {
        detail: {
          accept: (layout: ToolWindowLayout) => {
            captured = parseToolWindowLayout(layout);
          },
        } satisfies ToolWindowLayoutCaptureDetail,
      }),
    );
    return captured;
  }, []);
  const applyToolWindowLayout = useCallback((layout: ToolWindowLayout): void => {
    window.dispatchEvent(
      new CustomEvent("git-client:apply-tool-window-layout", {
        detail: { layout: parseToolWindowLayout(layout) },
      }),
    );
  }, []);
  const renameToolWindowLayout = useCallback(
    async (layout: NamedToolWindowLayout): Promise<void> => {
      const name = await dialog.input({
        title: "Rename Layout",
        label: "Layout name",
        initialValue: layout.name,
        confirmLabel: "Rename",
        validate: (candidate) => {
          const normalized = candidate.trim();
          if (!normalized) return "Enter a layout name.";
          if (normalized.length > 64) return "Layout names must be 64 characters or fewer.";
          return toolWindowLayouts.some(
            (other) =>
              other.id !== layout.id &&
              other.name.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
          )
            ? "A layout with this name already exists."
            : null;
        },
      });
      if (name === null) return;
      setToolWindowLayouts((current) =>
        current.map((candidate) =>
          candidate.id === layout.id ? { ...candidate, name: name.trim() } : candidate,
        ),
      );
    },
    [dialog.input, toolWindowLayouts],
  );
  const saveToolWindowLayout = useCallback(
    (layout: NamedToolWindowLayout): void => {
      const state = captureToolWindowLayout();
      if (state === null) return;
      setToolWindowLayouts((current) =>
        current.map((candidate) =>
          candidate.id === layout.id ? { ...candidate, state } : candidate,
        ),
      );
    },
    [captureToolWindowLayout],
  );

  useEffect(() => {
    let active = true;
    void readElectronSetting(PRODUCT_SETTINGS_KEY)
      .then((value) => {
        if (active) setProductSettings(parseProductSettings(value));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setProductSettingsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void readElectronSetting(TOOL_WINDOW_LAYOUT_KEY)
      .then((value) => {
        if (active) {
          setToolWindowLayouts(parseNamedToolWindowLayouts(value));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setToolWindowLayoutsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toolWindowLayoutsLoaded) return;
    void writeElectronSettings({
      [TOOL_WINDOW_LAYOUT_KEY]: toolWindowLayouts,
    });
  }, [toolWindowLayouts, toolWindowLayoutsLoaded]);

  useEffect(() => {
    let active = true;
    void readElectronSetting(SAVED_MACROS_KEY)
      .then((value) => {
        if (active) setSavedMacros(parseSavedMacros(value));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setSavedMacrosLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!savedMacrosLoaded) return;
    void writeElectronSettings({ [SAVED_MACROS_KEY]: savedMacros });
  }, [savedMacros, savedMacrosLoaded]);

  useEffect(() => {
    if (!macroRecording) return;
    const recordCommand = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      const commandId = event.detail?.id;
      if (
        typeof commandId !== "string" ||
        commandId === "edit.startMacroRecording" ||
        commandId === "edit.playbackLastMacro" ||
        commandId === "edit.playSavedMacros"
      )
        return;
      setRecordedCommandIds((current) =>
        current.length >= 1_000 ? current : [...current, commandId],
      );
    };
    window.addEventListener("git-client:command-executed", recordCommand);
    return () => window.removeEventListener("git-client:command-executed", recordCommand);
  }, [macroRecording]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      readElectronSetting(NEW_PROJECT_SETTINGS_KEY),
      readElectronSetting(NEW_PROJECT_APPEARANCE_KEY),
      readElectronSetting(RUN_CONFIGURATION_TEMPLATES_KEY),
    ])
      .then(
        ([settings, appearance, templates]) => {
          if (!active) return;
          setNewProjectSettings(parseProductSettings(settings));
          setNewProjectAppearancePreference(storedAppearancePreference(appearance));
          setRunConfigurationTemplates(parseRunConfigurationTemplates(templates));
        },
        () => undefined,
      )
      .finally(() => {
        if (active) setProjectDefaultsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !newProjectAppearancePreference.syncWithOs ||
      newProjectAppearancePreference.theme === systemTheme
    )
      return;
    setNewProjectAppearancePreference((current) =>
      synchronizeAppearancePreference(current, systemTheme),
    );
  }, [
    newProjectAppearancePreference.syncWithOs,
    newProjectAppearancePreference.theme,
    systemTheme,
  ]);

  useEffect(() => {
    if (!projectDefaultsLoaded) return;
    void writeElectronSettings({
      [NEW_PROJECT_SETTINGS_KEY]: newProjectSettings,
      [NEW_PROJECT_APPEARANCE_KEY]: newProjectAppearancePreference,
      [RUN_CONFIGURATION_TEMPLATES_KEY]: runConfigurationTemplates,
    });
  }, [
    newProjectAppearancePreference,
    newProjectSettings,
    projectDefaultsLoaded,
    runConfigurationTemplates,
  ]);

  useEffect(() => {
    if (!productSettingsLoaded) return;
    const root = document.documentElement;
    root.dataset.compact = productSettings.compactMode ? "true" : "false";
    root.dataset.presentationMode = String(productSettings.presentationMode);
    root.dataset.distractionFreeMode = String(
      productSettings.distractionFreeMode || productSettings.zenMode,
    );
    root.dataset.zenMode = String(productSettings.zenMode);
    root.dataset.toolbarVisible = String(productSettings.toolbarVisible);
    root.dataset.navigationBar = productSettings.navigationBar;
    root.dataset.toolWindowBarsVisible = String(productSettings.toolWindowBarsVisible);
    root.dataset.statusBarVisible = String(productSettings.statusBarVisible);
    root.dataset.adjustRedGreenVision = String(productSettings.adjustRedGreenVision);
    root.dataset.powerSaveMode = String(productSettings.powerSaveMode);
    root.dataset.bidiTextDirection = productSettings.bidiTextDirection;
    root.style.setProperty(
      "--product-zoom",
      String(
        (productSettings.zoom / 100) *
          (productSettings.presentationMode ? 24 / productSettings.ideFontSize : 1),
      ),
    );
    root.style.setProperty("--font-size-base", `${productSettings.ideFontSize}px`);
    root.style.setProperty("--editor-font-size", `${productSettings.editorFontSize}px`);
    window.dispatchEvent(
      new CustomEvent("git-client:keymap-changed", {
        detail: productSettings.keymapOverrides,
      }),
    );
    window.dispatchEvent(
      new CustomEvent("git-client:product-settings-changed", {
        detail: productSettings,
      }),
    );
    void writeElectronSettings({
      [PRODUCT_SETTINGS_KEY]: productSettings,
    });
  }, [productSettings, productSettingsLoaded]);

  useEffect(() => {
    const handleRequest = (event: Event): void => {
      if (event instanceof CustomEvent && event.detail?.kind === "toggleCompact") {
        setProductSettings((current) => ({
          ...current,
          compactMode: !current.compactMode,
        }));
      }
    };
    window.addEventListener("git-client:product-settings-request", handleRequest);
    return () => window.removeEventListener("git-client:product-settings-request", handleRequest);
  }, []);

  const welcomeVisible =
    !session.restoring &&
    session.activeTab.kind === "welcome" &&
    session.openRepositories.length === 0;
  useEffect(() => {
    document.title = welcomeVisible
      ? "Welcome to Git Client"
      : (session.repository?.snapshot.name ?? "Git Client");
  }, [session.repository?.snapshot.name, welcomeVisible]);
  useEffect(() => {
    if (session.restoring) return;
    const api = electronApi();
    if (api === null) return;
    void api.window.setPresentationMode(welcomeVisible ? "welcome" : "workspace");
  }, [session.restoring, welcomeVisible]);

  const activeError = useMemo<WorkspaceRepositorySession | null>(() => {
    if (session.activeTab.kind !== "error") return null;
    const sessionId = session.activeTab.sessionId;
    return session.sessions.find((item) => item.kind === "error" && item.id === sessionId) ?? null;
  }, [session.activeTab, session.sessions]);
  const openRepositories = useMemo(
    () =>
      session.sessions.flatMap((item) =>
        item.kind === "repository" ? [item.repository.snapshot] : [],
      ),
    [session.sessions],
  );
  const activeProjectName = useMemo(() => {
    if (session.activeTab.kind !== "repository") return "Git Client";
    const repositoryId = session.activeTab.repositoryId;
    const active = session.sessions.find(
      (item) => item.kind === "repository" && item.repository.snapshot.id === repositoryId,
    );
    return active?.kind === "repository" ? active.repository.snapshot.name : "Git Client";
  }, [session.activeTab, session.sessions]);

  const workspaceCommands = useMemo<readonly CommandDefinition[]>(
    () => [
      commandDefinition("workspace.new", () => {
        setRepositoryDialogMode("init");
        setShowRepositoryDialog(true);
      }),
      commandDefinition("workspace.open", () => {
        setRepositoryDialogMode("open");
        setShowRepositoryDialog(true);
      }),
      commandDefinition("workspace.manageProjects", () => {
        if (session.repository) setProjectSwitcherOpen(true);
        else {
          setRepositoryDialogMode("open");
          setShowRepositoryDialog(true);
        }
      }),
      commandDefinition("workspace.clone", () => {
        setRepositoryDialogMode("clone");
        setShowRepositoryDialog(true);
      }),
      commandDefinition("workspace.settings", () => setSettingsOpen(true)),
      commandDefinition("workspace.exportSettings", async () => {
        await exportElectronSettings();
      }),
      commandDefinition("workspace.importSettings", async () => {
        await importSettingsArchive();
      }),
      commandDefinition("workspace.restoreDefaultSettings", async () => {
        const accepted = await dialog.confirm({
          title: "Restore default settings?",
          description:
            "Resets appearance, layout, status widgets, notifications, and keymap settings.",
          impact: "Open repositories, hosting accounts, and repository files are not changed.",
          confirmLabel: "Restore defaults",
          dangerous: true,
        });
        if (!accepted) return;
        setProductSettings(DEFAULT_PRODUCT_SETTINGS);
        setToolWindowLayouts([DEFAULT_NAMED_TOOL_WINDOW_LAYOUT]);
        setAppearancePreference({ theme: "dark", syncWithOs: false });
        setSettingsOpen(false);
      }),
      commandDefinition(
        "workspace.repairIde",
        () => setRepairIdeOpen(true),
        () =>
          session.activeTab.kind === "repository"
            ? COMMAND_ENABLED
            : commandDisabled("Open a project to repair its indexes."),
      ),
      commandDefinition("workspace.invalidateCaches", () => setInvalidateCachesOpen(true)),
      commandDefinition("workspace.settingsNewProjects", () => setNewProjectSettingsOpen(true)),
      commandDefinition("workspace.runConfigurationTemplates", () =>
        setRunConfigurationTemplatesOpen(true),
      ),
      commandDefinition(
        "window.layoutDefault",
        () => applyToolWindowLayout(DEFAULT_TOOL_WINDOW_LAYOUT),
        () =>
          session.activeTab.kind === "repository"
            ? COMMAND_ENABLED
            : commandDisabled("Open a project to restore its layout."),
      ),
      {
        ...commandDefinition(
          "window.activateCurrentProject",
          () => window.focus(),
          () =>
            session.activeTab.kind === "repository"
              ? COMMAND_ENABLED
              : commandDisabled("Open a project window."),
        ),
        label: activeProjectName,
      },
      commandDefinition(
        "window.layoutRestoreCustom",
        () => {
          const layout = toolWindowLayouts[0];
          if (!layout) return;
          if (toolWindowLayouts.length === 1) {
            applyToolWindowLayout(layout.state);
          } else {
            setLayoutChooserMode("restore");
          }
        },
        () =>
          session.activeTab.kind === "repository"
            ? COMMAND_ENABLED
            : commandDisabled("Open a project to restore a layout."),
      ),
      commandDefinition(
        "window.layoutSaveCustom",
        () => {
          const layout = toolWindowLayouts[0];
          if (!layout) return;
          if (toolWindowLayouts.length === 1) {
            saveToolWindowLayout(layout);
          } else {
            setLayoutChooserMode("save");
          }
        },
        () =>
          session.activeTab.kind === "repository"
            ? COMMAND_ENABLED
            : commandDisabled("Open a project to save its layout."),
      ),
      commandDefinition(
        "window.layoutRenameCustom",
        async () => {
          const layout = toolWindowLayouts[0];
          if (!layout) return;
          if (toolWindowLayouts.length === 1) {
            await renameToolWindowLayout(layout);
          } else {
            setLayoutChooserMode("rename");
          }
        },
        () =>
          toolWindowLayouts.length > 0
            ? COMMAND_ENABLED
            : commandDisabled("There are no saved layouts."),
      ),
      commandDefinition(
        "window.layoutSaveNew",
        async () => {
          const state = captureToolWindowLayout();
          if (state === null) return;
          const name = await dialog.input({
            title: "Save Current Layout as New",
            label: "Layout name",
            initialValue: "Custom",
            confirmLabel: "Save",
            validate: (candidate) => {
              const normalized = candidate.trim();
              if (!normalized) return "Enter a layout name.";
              if (normalized.length > 64) return "Layout names must be 64 characters or fewer.";
              return toolWindowLayouts.some(
                (layout) => layout.name.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
              )
                ? "A layout with this name already exists."
                : null;
            },
          });
          if (name === null) return;
          setToolWindowLayouts((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              name: name.trim(),
              state,
            },
          ]);
        },
        () =>
          session.activeTab.kind === "repository"
            ? COMMAND_ENABLED
            : commandDisabled("Open a project to save its layout."),
      ),
      {
        ...commandDefinition("window.autoShowProcesses", () =>
          setProductSettings((current) => ({
            ...current,
            processWindowAutoShow: !current.processWindowAutoShow,
          })),
        ),
        checked: () => productSettings.processWindowAutoShow,
      },
      commandDefinition("help.open", () => setHelpOpen(true)),
      commandDefinition("help.whatsNew", () => setWhatsNewOpen(true)),
      commandDefinition("help.keyboardShortcutsPdf", openKeyboardShortcutsPdf, () =>
        isElectronRuntime()
          ? COMMAND_ENABLED
          : commandDisabled("Keyboard Shortcuts PDF requires the Electron application."),
      ),
      commandDefinition(
        "help.showLog",
        () => revealDiagnosticPath("logs"),
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Application logs require the Electron application."),
      ),
      commandDefinition(
        "help.collectLogs",
        async () => {
          await collectDiagnosticLogs();
        },
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Diagnostic export requires the Electron application."),
      ),
      commandDefinition(
        "help.activityMonitor",
        () => setActivityMonitorOpen(true),
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Activity Monitor requires the Electron application."),
      ),
      commandDefinition(
        "help.dumpThreads",
        async () => {
          await dumpDiagnosticThreads();
        },
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Thread dumps require the Electron application."),
      ),
      commandDefinition(
        "help.debugLogSettings",
        () =>
          setDiagnosticConfiguration({
            kind: "debugLog",
            title: "Debug Log Settings",
            description:
              "Enter logger categories, one per line. Append :TRACE or :ALL to increase detail.",
          }),
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Debug logging requires the Electron application."),
      ),
      commandDefinition(
        "help.specialFiles",
        () => setSpecialFilesOpen(true),
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Special files require the Electron application."),
      ),
      commandDefinition(
        "help.changeMemorySettings",
        async () => {
          const value = await dialog.input({
            title: "Change Memory Settings",
            label: "Maximum heap size (MiB)",
            description: "The new renderer heap limit is applied after restart.",
            initialValue: "2048",
            confirmLabel: "Save",
            validate: (candidate) => {
              const memory = Number(candidate);
              return Number.isInteger(memory) && memory >= 256 && memory <= 32_768
                ? null
                : "Enter an integer from 256 to 32768.";
            },
          });
          if (value === null) return;
          await writeDiagnosticConfiguration(
            "vmOptions",
            `# Applied after the next restart.\n--max-old-space-size=${value}\n`,
          );
        },
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Memory settings require the Electron application."),
      ),
      commandDefinition(
        "help.customProperties",
        () =>
          setDiagnosticConfiguration({
            kind: "customProperties",
            title: "Edit Custom Properties",
            description: "Enter Git Client property overrides as key=value lines.",
          }),
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Custom properties require the Electron application."),
      ),
      commandDefinition(
        "help.customVmOptions",
        () =>
          setDiagnosticConfiguration({
            kind: "vmOptions",
            title: "Edit Custom VM Options",
            description: "For safety, Git Client accepts only --max-old-space-size=256..32768.",
          }),
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Custom VM options require the Electron application."),
      ),
      commandDefinition(
        "help.deleteLeftovers",
        () => setLeftoverDirectoriesOpen(true),
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Leftover profile cleanup requires the Electron application."),
      ),
      commandDefinition(
        "tools.commandLineLauncher",
        () => setCommandLineLauncherOpen(true),
        () =>
          isElectronRuntime()
            ? COMMAND_ENABLED
            : commandDisabled("Command-line launcher information requires Electron."),
      ),
      {
        ...commandDefinition("edit.startMacroRecording", async () => {
          if (!macroRecording) {
            setRecordedCommandIds([]);
            setMacroRecording(true);
            return;
          }
          setMacroRecording(false);
          const macro: SavedMacro = {
            id: crypto.randomUUID(),
            name: "Last Macro",
            commandIds: recordedCommandIds,
          };
          const name = await dialog.input({
            title: "Enter Macro Name",
            label: "Macro name",
            description: "Enter a name for the macro. Leave blank if the macro is temporary.",
            allowEmpty: true,
            confirmLabel: "OK",
            validate: (candidate) =>
              candidate.length > 128
                ? "Macro names must be 128 characters or fewer."
                : savedMacros.some((saved) => saved.name === candidate)
                  ? "A macro with this name already exists."
                  : null,
          });
          if (name === null) return;
          setLastMacro(macro);
          if (name === "") return;
          setSavedMacros((current) => [...current, { ...macro, name }]);
        }),
        label: macroRecording ? "Stop Macro Recording" : "Start Macro Recording",
      },
      commandDefinition(
        "edit.playbackLastMacro",
        async () => {
          if (lastMacro === null) return;
          for (const commandId of lastMacro.commandIds) {
            await commands.execute(commandId as CommandId);
          }
        },
        () =>
          lastMacro !== null && !macroRecording
            ? COMMAND_ENABLED
            : commandDisabled(
                macroRecording
                  ? "Stop macro recording before playback."
                  : "No macro has been recorded in this session.",
              ),
      ),
      commandDefinition("edit.playSavedMacros", () => setSavedMacrosOpen(true)),
      {
        ...commandDefinition("view.scrollSearchResults", () =>
          setProductSettings((current) => ({
            ...current,
            scrollToSearchResults: !current.scrollToSearchResults,
          })),
        ),
        checked: () => productSettings.scrollToSearchResults,
      },
      {
        ...commandDefinition("view.compactMode", () => {
          window.dispatchEvent(
            new CustomEvent("git-client:product-settings-request", {
              detail: { kind: "toggleCompact" },
            }),
          );
        }),
        checked: () => productSettings.compactMode,
      },
      {
        ...commandDefinition("view.presentationMode", async () => {
          const entering = !productSettings.presentationMode;
          if (entering) {
            presentationPreviousFullScreen.current = await getElectronFullScreen();
          }
          await setElectronFullScreen(entering ? true : presentationPreviousFullScreen.current);
          setProductSettings((current) => ({
            ...current,
            presentationMode: entering,
          }));
        }),
        label: productSettings.presentationMode
          ? "Exit Presentation Mode"
          : "Enter Presentation Mode",
        checked: () => productSettings.presentationMode,
      },
      {
        ...commandDefinition("view.distractionFreeMode", () =>
          setProductSettings((current) => ({
            ...current,
            distractionFreeMode: !current.distractionFreeMode,
            zenMode: current.distractionFreeMode ? false : current.zenMode,
          })),
        ),
        label: productSettings.distractionFreeMode
          ? "Exit Distraction Free Mode"
          : "Enter Distraction Free Mode",
        checked: () => productSettings.distractionFreeMode,
      },
      {
        ...commandDefinition("view.zenMode", async () => {
          const entering = !productSettings.zenMode;
          if (entering) {
            zenPreviousFullScreen.current = await getElectronFullScreen();
          }
          await setElectronFullScreen(entering ? true : zenPreviousFullScreen.current);
          setProductSettings((current) => ({
            ...current,
            distractionFreeMode: entering,
            zenMode: entering,
          }));
        }),
        label: productSettings.zenMode ? "Exit Zen Mode" : "Enter Zen Mode",
        checked: () => productSettings.zenMode,
      },
      {
        ...commandDefinition("view.zoomIde", async () => {
          const value = await dialog.input({
            title: "Zoom IDE",
            label: "Zoom percentage",
            description: "Available values: 100, 125, or 150.",
            initialValue: String(productSettings.zoom),
            confirmLabel: "Apply",
            validate: (candidate) =>
              candidate === "100" || candidate === "125" || candidate === "150"
                ? null
                : "Choose 100, 125, or 150.",
          });
          if (value === null) return;
          setProductSettings((current) => ({
            ...current,
            zoom: Number(value) as 100 | 125 | 150,
          }));
        }),
        label: `Zoom IDE (Current: ${productSettings.zoom}%)…`,
      },
      commandDefinition("view.quickSwitchScheme", () => setQuickSwitchSchemeOpen(true)),
      commandDefinition(
        "view.resetEditorFontSize",
        () =>
          setProductSettings((current) => ({
            ...current,
            editorFontSize: DEFAULT_PRODUCT_SETTINGS.editorFontSize,
          })),
        () =>
          session.activeTab.kind === "repository"
            ? COMMAND_ENABLED
            : commandDisabled("Open a project to reset editor fonts."),
      ),
      {
        ...commandDefinition(
          "view.bidiContent",
          () =>
            setProductSettings((current) => ({
              ...current,
              bidiTextDirection: "content",
            })),
          () =>
            session.activeTab.kind === "repository"
              ? COMMAND_ENABLED
              : commandDisabled("Open a project to set text direction."),
        ),
        checked: () => productSettings.bidiTextDirection === "content",
      },
      {
        ...commandDefinition(
          "view.bidiLtr",
          () =>
            setProductSettings((current) => ({
              ...current,
              bidiTextDirection: "ltr",
            })),
          () =>
            session.activeTab.kind === "repository"
              ? COMMAND_ENABLED
              : commandDisabled("Open a project to set text direction."),
        ),
        checked: () => productSettings.bidiTextDirection === "ltr",
      },
      {
        ...commandDefinition(
          "view.bidiRtl",
          () =>
            setProductSettings((current) => ({
              ...current,
              bidiTextDirection: "rtl",
            })),
          () =>
            session.activeTab.kind === "repository"
              ? COMMAND_ENABLED
              : commandDisabled("Open a project to set text direction."),
        ),
        checked: () => productSettings.bidiTextDirection === "rtl",
      },
      {
        ...commandDefinition("view.presentationAssistant", () =>
          setProductSettings((current) => ({
            ...current,
            presentationAssistant: !current.presentationAssistant,
          })),
        ),
        checked: () => productSettings.presentationAssistant,
      },
      {
        ...commandDefinition("view.powerSaveMode", () =>
          setProductSettings((current) => ({
            ...current,
            powerSaveMode: !current.powerSaveMode,
          })),
        ),
        checked: () => productSettings.powerSaveMode,
      },
      {
        ...commandDefinition("view.toolbar", () =>
          setProductSettings((current) => ({
            ...current,
            toolbarVisible: !current.toolbarVisible,
          })),
        ),
        checked: () => productSettings.toolbarVisible,
      },
      {
        ...commandDefinition("view.navigationBarTop", () =>
          setProductSettings((current) => ({
            ...current,
            navigationBar: "top",
          })),
        ),
        checked: () => productSettings.navigationBar === "top",
      },
      {
        ...commandDefinition("view.navigationBarStatus", () =>
          setProductSettings((current) => ({
            ...current,
            navigationBar: "status",
          })),
        ),
        checked: () => productSettings.navigationBar === "status",
      },
      {
        ...commandDefinition("view.navigationBarHidden", () =>
          setProductSettings((current) => ({
            ...current,
            navigationBar: "hidden",
          })),
        ),
        checked: () => productSettings.navigationBar === "hidden",
      },
      {
        ...commandDefinition("view.navigationBarMembers", () =>
          setProductSettings((current) => ({
            ...current,
            navigationBarShowMembers: !current.navigationBarShowMembers,
          })),
        ),
        checked: () => productSettings.navigationBarShowMembers,
      },
      {
        ...commandDefinition("view.toolWindowBars", () =>
          setProductSettings((current) => ({
            ...current,
            toolWindowBarsVisible: !current.toolWindowBarsVisible,
          })),
        ),
        checked: () => productSettings.toolWindowBarsVisible,
      },
      {
        ...commandDefinition("view.statusBar", () =>
          setProductSettings((current) => ({
            ...current,
            statusBarVisible: !current.statusBarVisible,
          })),
        ),
        checked: () => productSettings.statusBarVisible,
      },
      ...STATUS_BAR_WIDGET_COMMANDS.map(([id, widget]) => ({
        ...commandDefinition(id, () =>
          setProductSettings((current) => ({
            ...current,
            statusBarWidgets: {
              ...current.statusBarWidgets,
              [widget]: !current.statusBarWidgets[widget],
            },
          })),
        ),
        checked: () => productSettings.statusBarWidgets[widget],
      })),
      commandDefinition(
        "workspace.close",
        async () => {
          const repositorySessions = session.sessions.filter((item) => item.kind === "repository");
          if (repositorySessions.length === 0) return;
          const terminalCount = repositorySessions.reduce(
            (count, item) => count + terminalService.count(item.repository.snapshot.id),
            0,
          );
          if (terminalCount > 0 || dirtyEditorCount > 0) {
            const consequences = [
              dirtyEditorCount > 0 ? `${dirtyEditorCount} unsaved editor tab(s)` : null,
              terminalCount > 0 ? `${terminalCount} terminal session(s)` : null,
            ].filter((item): item is string => item !== null);
            const accepted = await dialog.confirm({
              title: "Close project?",
              description:
                "Closing this project discards unsaved editor state and terminates its running terminal sessions.",
              impact: consequences.join("\n"),
              confirmLabel: "Close project",
              dangerous: true,
            });
            if (!accepted) return;
          }
          await session.closeProject();
        },
        () =>
          session.openRepositories.length > 0
            ? COMMAND_ENABLED
            : commandDisabled("There is no project to close."),
      ),
    ],
    [
      dialog.confirm,
      dialog.input,
      applyToolWindowLayout,
      activeProjectName,
      captureToolWindowLayout,
      commands,
      dirtyEditorCount,
      importSettingsArchive,
      productSettings,
      renameToolWindowLayout,
      lastMacro,
      macroRecording,
      recordedCommandIds,
      savedMacros,
      saveToolWindowLayout,
      setAppearancePreference,
      session.activeTab,
      session.closeProject,
      session.openRepositories.length,
      session.repository,
      session.sessions,
      toolWindowLayouts,
    ],
  );
  useCommandDefinitions(workspaceCommands);

  const repositoryPaletteItems = useMemo<readonly PaletteItem[]>(
    () =>
      openRepositories.map((repository) => ({
        id: `repository:${repository.id}`,
        kind: "repository",
        label: repository.name,
        detail: repository.path,
        category: "Repositories",
        keywords: [repository.path, repository.currentBranch ?? ""],
        availability: COMMAND_ENABLED,
        execute: async () => {
          if (
            session.activeTab.kind === "repository" &&
            session.activeTab.repositoryId === repository.id
          )
            return;
          if (!(await confirmDiscardEditors())) return;
          await session.activateTab({
            kind: "repository",
            repositoryId: repository.id,
          });
        },
      })),
    [confirmDiscardEditors, openRepositories, session.activateTab, session.activeTab],
  );
  usePaletteItems(repositoryPaletteItems);

  return (
    <div className={tw.appShell} data-window-mode={welcomeVisible ? "welcome" : "workspace"}>
      {helpOpen && <ProductHelpDialog onClose={() => setHelpOpen(false)} />}
      {whatsNewOpen && <WhatsNewDialog onClose={() => setWhatsNewOpen(false)} />}
      {activityMonitorOpen && (
        <ActivityMonitorDialog
          loadSnapshot={loadDiagnosticSnapshot}
          onClose={() => setActivityMonitorOpen(false)}
        />
      )}
      {specialFilesOpen && (
        <SpecialFilesDialog
          onClose={() => setSpecialFilesOpen(false)}
          onReveal={revealDiagnosticPath}
        />
      )}
      {leftoverDirectoriesOpen && (
        <LeftoverDirectoriesDialog
          deleteDirectories={deleteLeftoverDirectories}
          loadDirectories={listLeftoverDirectories}
          onClose={() => setLeftoverDirectoriesOpen(false)}
        />
      )}
      {commandLineLauncherOpen && (
        <CommandLineLauncherDialog
          loadInfo={loadCommandLineLauncherInfo}
          onClose={() => setCommandLineLauncherOpen(false)}
        />
      )}
      {diagnosticConfiguration && (
        <ConfigurationFileDialog
          description={diagnosticConfiguration.description}
          load={() => readDiagnosticConfiguration(diagnosticConfiguration.kind)}
          onClose={() => setDiagnosticConfiguration(null)}
          save={(content) => writeDiagnosticConfiguration(diagnosticConfiguration.kind, content)}
          title={diagnosticConfiguration.title}
        />
      )}
      {quickSwitchSchemeOpen && (
        <QuickSwitchSchemeDialog
          appearancePreference={appearancePreference}
          onAppearancePreferenceChange={setAppearancePreference}
          onClose={() => setQuickSwitchSchemeOpen(false)}
          onSettingsChange={handleProductSettingsChange}
          settings={productSettings}
        />
      )}
      {repairIdeOpen && (
        <RepairIdeDialog
          onClose={() => setRepairIdeOpen(false)}
          onContinueToInvalidate={() => {
            setRepairIdeOpen(false);
            setInvalidateCachesOpen(true);
          }}
          onRepair={async () => {
            commitFilesCache.clear();
            window.dispatchEvent(new CustomEvent("git-client:repair-indexes"));
            await session.reload();
          }}
        />
      )}
      {invalidateCachesOpen && (
        <InvalidateCachesDialog
          onClose={() => setInvalidateCachesOpen(false)}
          onInvalidateAndRestart={() => relaunchElectronApp(true)}
          onRestart={() => relaunchElectronApp(false)}
        />
      )}
      {runConfigurationTemplatesOpen && (
        <RunConfigurationTemplatesDialog
          onChange={setRunConfigurationTemplates}
          onClose={() => setRunConfigurationTemplatesOpen(false)}
          templates={runConfigurationTemplates}
        />
      )}
      {savedMacrosOpen && (
        <SavedMacrosDialog
          macros={savedMacros}
          onClose={() => setSavedMacrosOpen(false)}
          onDelete={(macroId) =>
            setSavedMacros((current) => current.filter((macro) => macro.id !== macroId))
          }
          onPlay={async (macro) => {
            setSavedMacrosOpen(false);
            setMacroRecording(false);
            for (const commandId of macro.commandIds) {
              await commands.execute(commandId as CommandId);
            }
          }}
        />
      )}
      {layoutChooserMode && (
        <ToolWindowLayoutsDialog
          layouts={toolWindowLayouts}
          onChoose={(layout) => {
            const mode = layoutChooserMode;
            setLayoutChooserMode(undefined);
            if (mode === "restore") {
              applyToolWindowLayout(layout.state);
            } else if (mode === "save") {
              saveToolWindowLayout(layout);
            } else {
              void renameToolWindowLayout(layout);
            }
          }}
          onClose={() => setLayoutChooserMode(undefined)}
          title={
            layoutChooserMode === "restore"
              ? "Restore Layout"
              : layoutChooserMode === "save"
                ? "Save Changes in Layout"
                : "Rename Layout"
          }
        />
      )}
      {welcomeVisible ? (
        <WelcomeTitlebar />
      ) : (
        <WorkspaceTitlebar
          onActivateProject={activateProjectSafely}
          onCloneProject={() => {
            setRepositoryDialogMode("clone");
            setShowRepositoryDialog(true);
          }}
          onOpenProject={() => {
            setRepositoryDialogMode("open");
            setShowRepositoryDialog(true);
          }}
          onOpenRecentProject={openRecentProjectSafely}
          onOpenPush={() =>
            setPushRequest({
              localRevision: "HEAD",
              knownRewrite: false,
            })
          }
          onOpenRepositoryTool={(kind) => void openRepositoryToolSafely(kind)}
          onOpenSettings={() => setSettingsOpen(true)}
          onProjectSwitcherOpenChange={setProjectSwitcherOpen}
          onRemoveRecentProject={session.removeRecentProject}
          projectSwitcherOpen={projectSwitcherOpen}
          session={session}
          showRepositoryActions={
            session.activeTab.kind === "repository" && repositoryChromeMode === "editor"
          }
        />
      )}
      {session.error && (
        <div className={tw.errorBanner} role="alert">
          <Icon name="warning" size={14} />
          <span>{session.error}</span>
          {session.activity?.status === "failed" && session.activity.canRetry && (
            <button onClick={() => void session.retryActivity()}>Retry</button>
          )}
          <button
            onClick={() => {
              session.dismissError();
              if (session.activity?.status === "failed")
                session.dismissActivity(session.activity.id);
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {session.notice && (
        <div className={tw.errorBanner} role="status">
          <Icon name="history" size={14} />
          <span>{session.notice}</span>
          <button onClick={session.dismissNotice}>Dismiss</button>
        </div>
      )}
      {activeError?.kind === "error" ? (
        <main className={tw.repositoryErrorView}>
          <Icon name="warning" size={28} />
          <h1>Repository unavailable</h1>
          <code>{activeError.path}</code>
          <p>{activeError.message}</p>
          <button onClick={() => void session.activateTab({ kind: "welcome" })}>
            Back to Welcome
          </button>
        </main>
      ) : session.activeTab.kind === "welcome" || !session.repository ? (
        <StartupWorkspace
          appearancePreference={appearancePreference}
          onAppearancePreferenceChange={setAppearancePreference}
          onCloneRepository={() => {
            setRepositoryDialogMode("clone");
            setShowRepositoryDialog(true);
          }}
          onNewProject={() => {
            setRepositoryDialogMode("init");
            setShowRepositoryDialog(true);
          }}
          onOpenRepository={() => {
            setRepositoryDialogMode("open");
            setShowRepositoryDialog(true);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          session={session}
        />
      ) : (
        <RepositoryWorkspace
          key={session.repository.snapshot.id}
          onAddRepository={() => {
            setRepositoryDialogMode("open");
            setShowRepositoryDialog(true);
          }}
          onDirtyEditorCountChange={setDirtyEditorCount}
          onChromeModeChange={setRepositoryChromeMode}
          onDismissShortcutConflictWarning={() =>
            setProductSettings((current) => ({
              ...current,
              showShortcutConflictWarning: false,
            }))
          }
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenPush={(localRevision = "HEAD", knownRewrite = false) =>
            setPushRequest({ localRevision, knownRewrite })
          }
          onOpenRepositoryTool={(kind) => setRepositoryTool(kind)}
          repository={session.repository}
          session={session}
          productSettings={productSettings}
          showNotifications={showNotifications}
          showShortcutConflictWarning={productSettings.showShortcutConflictWarning}
        />
      )}
      {showRepositoryDialog && (
        <RepositoryDialog
          initialMode={repositoryDialogMode}
          onCancelCreation={session.cancelRepositoryCreation}
          onClone={async (url, path, options, onEvent) => {
            const cloned = await session.cloneRepository(url, path, options, onEvent);
            setProductSettings(newProjectSettings);
            setAppearancePreference(newProjectAppearancePreference);
            return cloned;
          }}
          onClose={() => setShowRepositoryDialog(false)}
          onInit={async (path, bare, onEvent) => {
            const initialized = await session.initializeRepository(path, bare, onEvent);
            setProductSettings(newProjectSettings);
            setAppearancePreference(newProjectAppearancePreference);
            return initialized;
          }}
          onOpen={session.openRepository}
        />
      )}
      {repositoryTool && session.repository && (
        <RepositoryToolDialog
          kind={repositoryTool}
          onClose={() => setRepositoryTool(null)}
          onCompareBranches={session.compareBranches}
          onLoadConfig={session.loadGitConfig}
          onLoadMergedBranches={session.loadMergedBranches}
          onLoadSubmodules={session.loadSubmodules}
          onOpenPush={() =>
            setPushRequest({
              localRevision: "HEAD",
              knownRewrite: false,
            })
          }
          onOpenWorktree={session.openRepository}
          onOperation={session.executeOperation}
          onReadIgnoreRules={session.readIgnoreRules}
          onWriteIgnoreRules={session.writeIgnoreRules}
          refs={session.repository.refs}
          remotes={session.remotes}
          repository={session.repository.snapshot}
          worktrees={session.worktrees}
        />
      )}
      {pushRequest && session.repository && (
        <PushDialog
          knownRewrite={pushRequest.knownRewrite}
          localRevision={pushRequest.localRevision}
          onClose={() => setPushRequest(null)}
          onLoadPreview={session.loadPushPreview}
          onPush={(operation) => session.executeOperation(operation, true)}
          remotes={session.remotes}
        />
      )}
      <SettingsDialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={handleProductSettingsChange}
        settings={productSettings}
        onOpenRepositorySettings={() => {
          setSettingsOpen(false);
          void openRepositoryToolSafely("settings");
        }}
      />
      <SettingsDialog
        appearancePreference={newProjectAppearancePreference}
        isOpen={newProjectSettingsOpen}
        onAppearancePreferenceChange={setNewProjectAppearancePreference}
        onClose={() => setNewProjectSettingsOpen(false)}
        onSettingsChange={setNewProjectSettings}
        settings={newProjectSettings}
        showRepositorySettings={false}
        title="Settings for New Projects"
      />
      {dialog.node}
    </div>
  );
}

export default function App() {
  return (
    <AppearanceProvider>
      <GitClientTheme>
        <CommandProvider>
          <AppContent />
        </CommandProvider>
      </GitClientTheme>
    </AppearanceProvider>
  );
}
