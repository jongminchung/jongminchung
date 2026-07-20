import {
  EMPTY_COMMIT_DRAFT,
  parseChangeSelection,
  parseCommitDraft,
  parseDiffPreferences,
  parseRepositoryViewMode,
  type ChangeSelection,
  type CommitDraft,
  type DiffPreferences,
  type RepositoryViewMode,
} from "./changeReview";

export const WORKSPACE_SCHEMA_VERSION = 10;
export const DEFAULT_BOTTOM_PANEL_HEIGHT = 248;
export const MIN_BOTTOM_PANEL_HEIGHT = 160;
export const MAX_BOTTOM_PANEL_HEIGHT = 420;
export const DEFAULT_SIDE_TOOL_WINDOW_WIDTH = 386;
export const MIN_SIDE_TOOL_WINDOW_WIDTH = 260;
export const MAX_SIDE_TOOL_WINDOW_WIDTH = 520;

export type WorkspaceBottomPanelTab =
  | "shelf"
  | "stash"
  | "recovery"
  | "find"
  | "localHistory"
  | "gitConsole"
  | "terminal";

export interface RepositoryUiState {
  readonly selectedOids: readonly string[];
  readonly selectedRef: string | null;
  readonly bottomCollapsed: boolean;
  readonly bottomPanelHeight: number;
  readonly bottomPanelTab: WorkspaceBottomPanelTab;
  readonly activeView: RepositoryViewMode;
  readonly selectedChange: ChangeSelection | null;
  readonly historySelectedPath: string | null;
  readonly diffPreferences: DiffPreferences;
  readonly commitDraft: CommitDraft;
  readonly changesNavigatorWidth: number;
  readonly historyReviewWidth: number;
  readonly commitRailWidth: number;
  readonly sideToolWindowWidth: number;
  readonly projectOpen: boolean;
  readonly bookmarksOpen: boolean;
  readonly logOpen: boolean;
  readonly logTabIds: readonly string[];
  readonly activeLogTabId: string | null;
}

export type PersistedWorkspaceTab =
  | { readonly kind: "welcome" }
  | { readonly kind: "repository"; readonly repositoryId: string }
  | { readonly kind: "error"; readonly sessionId: string };

export type PersistableWorkspaceSession =
  | {
      readonly kind: "repository";
      readonly repository: {
        readonly snapshot: { readonly id: string; readonly path: string };
      };
    }
  | { readonly kind: "error"; readonly id: string; readonly path: string };

export interface HostingAccountMetadata {
  readonly id: string;
  readonly provider: "gitHub" | "gitLab";
  readonly baseUrl: string;
  readonly login: string;
}

export interface WorkspacePreferences {
  readonly schemaVersion: number;
  readonly autoFetchMinutes: number | null;
  readonly fetchTagMode: "auto" | "sync" | "always" | "never";
  readonly recurseSubmodules: boolean;
  readonly hostingAccounts: readonly HostingAccountMetadata[];
}

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  autoFetchMinutes: null,
  fetchTagMode: "auto",
  recurseSubmodules: true,
  hostingAccounts: [],
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFetchTagMode(value: unknown): value is WorkspacePreferences["fetchTagMode"] {
  return value === "auto" || value === "sync" || value === "always" || value === "never";
}

function clampBottomPanelHeight(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_BOTTOM_PANEL_HEIGHT;
  }
  return Math.min(MAX_BOTTOM_PANEL_HEIGHT, Math.max(MIN_BOTTOM_PANEL_HEIGHT, Math.round(value)));
}

function clampPaneWidth(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function parseBottomPanelTab(value: unknown): WorkspaceBottomPanelTab {
  if (
    value === "shelf" ||
    value === "stash" ||
    value === "recovery" ||
    value === "find" ||
    value === "localHistory" ||
    value === "gitConsole" ||
    value === "terminal"
  ) {
    return value;
  }
  return "shelf";
}

export function migrateRepositoryUiState(value: unknown): RepositoryUiState {
  if (!isRecord(value)) {
    return {
      selectedOids: [],
      selectedRef: null,
      bottomCollapsed: true,
      bottomPanelHeight: DEFAULT_BOTTOM_PANEL_HEIGHT,
      bottomPanelTab: "shelf",
      activeView: "history",
      selectedChange: null,
      historySelectedPath: null,
      diffPreferences: parseDiffPreferences(null),
      commitDraft: EMPTY_COMMIT_DRAFT,
      changesNavigatorWidth: 250,
      historyReviewWidth: 210,
      commitRailWidth: 315,
      sideToolWindowWidth: DEFAULT_SIDE_TOOL_WINDOW_WIDTH,
      projectOpen: true,
      bookmarksOpen: false,
      logOpen: true,
      logTabIds: ["log-1"],
      activeLogTabId: "log-1",
    };
  }
  return {
    selectedOids: Array.isArray(value.selectedOids)
      ? value.selectedOids.filter((oid): oid is string => typeof oid === "string")
      : [],
    selectedRef: typeof value.selectedRef === "string" ? value.selectedRef : null,
    bottomCollapsed: typeof value.bottomCollapsed === "boolean" ? value.bottomCollapsed : true,
    bottomPanelHeight: clampBottomPanelHeight(value.bottomPanelHeight),
    bottomPanelTab: parseBottomPanelTab(value.bottomPanelTab),
    activeView: parseRepositoryViewMode(value.activeView),
    selectedChange: parseChangeSelection(value.selectedChange),
    historySelectedPath:
      typeof value.historySelectedPath === "string" ? value.historySelectedPath : null,
    diffPreferences: parseDiffPreferences(value.diffPreferences),
    commitDraft: parseCommitDraft(value.commitDraft),
    changesNavigatorWidth: clampPaneWidth(value.changesNavigatorWidth, 250, 190, 420),
    historyReviewWidth:
      typeof value.historyReviewWidth === "number" && value.historyReviewWidth >= 640
        ? 210
        : clampPaneWidth(value.historyReviewWidth, 210, 180, 480),
    commitRailWidth: clampPaneWidth(value.commitRailWidth, 315, 280, 480),
    sideToolWindowWidth: clampPaneWidth(
      value.sideToolWindowWidth,
      DEFAULT_SIDE_TOOL_WINDOW_WIDTH,
      MIN_SIDE_TOOL_WINDOW_WIDTH,
      MAX_SIDE_TOOL_WINDOW_WIDTH,
    ),
    projectOpen: typeof value.projectOpen === "boolean" ? value.projectOpen : true,
    bookmarksOpen: typeof value.bookmarksOpen === "boolean" ? value.bookmarksOpen : false,
    logOpen: typeof value.logOpen === "boolean" ? value.logOpen : true,
    logTabIds:
      Array.isArray(value.logTabIds) && value.logTabIds.some((tabId) => typeof tabId === "string")
        ? [
            ...new Set(
              value.logTabIds.filter((tabId): tabId is string => typeof tabId === "string"),
            ),
          ]
        : ["log-1"],
    activeLogTabId: typeof value.activeLogTabId === "string" ? value.activeLogTabId : "log-1",
  };
}

function isHostingAccountMetadata(value: unknown): value is HostingAccountMetadata {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    (value.provider === "gitHub" || value.provider === "gitLab") &&
    typeof value.baseUrl === "string" &&
    typeof value.login === "string"
  );
}

export function migrateWorkspacePreferences(value: unknown): WorkspacePreferences {
  if (!isRecord(value)) return DEFAULT_WORKSPACE_PREFERENCES;
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    autoFetchMinutes:
      typeof value.autoFetchMinutes === "number" && value.autoFetchMinutes > 0
        ? value.autoFetchMinutes
        : null,
    fetchTagMode: isFetchTagMode(value.fetchTagMode) ? value.fetchTagMode : "auto",
    recurseSubmodules:
      typeof value.recurseSubmodules === "boolean" ? value.recurseSubmodules : true,
    hostingAccounts: Array.isArray(value.hostingAccounts)
      ? value.hostingAccounts.filter(isHostingAccountMetadata)
      : [],
  };
}

export function workspacePaths(
  sessions: readonly PersistableWorkspaceSession[],
): readonly string[] {
  return sessions.map((session) =>
    session.kind === "repository" ? session.repository.snapshot.path : session.path,
  );
}

export function restoredWorkspaceTab(
  sessions: readonly PersistableWorkspaceSession[],
  activePath: unknown,
): PersistedWorkspaceTab {
  if (typeof activePath !== "string") {
    const firstRepository = sessions.find((session) => session.kind === "repository");
    return firstRepository?.kind === "repository"
      ? {
          kind: "repository",
          repositoryId: firstRepository.repository.snapshot.id,
        }
      : { kind: "welcome" };
  }
  const selected = sessions.find((session) =>
    session.kind === "repository"
      ? session.repository.snapshot.path === activePath
      : session.path === activePath,
  );
  if (selected?.kind === "repository") {
    return {
      kind: "repository",
      repositoryId: selected.repository.snapshot.id,
    };
  }
  if (selected?.kind === "error") return { kind: "error", sessionId: selected.id };
  const firstRepository = sessions.find((session) => session.kind === "repository");
  return firstRepository?.kind === "repository"
    ? {
        kind: "repository",
        repositoryId: firstRepository.repository.snapshot.id,
      }
    : { kind: "welcome" };
}

export function workspaceTabAfterClose(
  sessions: readonly PersistableWorkspaceSession[],
  activeTab: PersistedWorkspaceTab,
  closingSessionId: string,
): PersistedWorkspaceTab {
  const closingIndex = sessions.findIndex((session) =>
    session.kind === "repository"
      ? session.repository.snapshot.id === closingSessionId
      : session.id === closingSessionId,
  );
  if (closingIndex < 0) return activeTab;

  const closingIsActive =
    (activeTab.kind === "repository" && activeTab.repositoryId === closingSessionId) ||
    (activeTab.kind === "error" && activeTab.sessionId === closingSessionId);
  if (!closingIsActive) return activeTab;

  const remaining = sessions.filter((_, index) => index !== closingIndex);
  const replacement = remaining[Math.min(closingIndex, remaining.length - 1)];
  if (replacement?.kind === "repository") {
    return {
      kind: "repository",
      repositoryId: replacement.repository.snapshot.id,
    };
  }
  if (replacement?.kind === "error") return { kind: "error", sessionId: replacement.id };
  return { kind: "welcome" };
}
