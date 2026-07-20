import {
  DEFAULT_BOTTOM_PANEL_HEIGHT,
  DEFAULT_SIDE_TOOL_WINDOW_WIDTH,
  MAX_SIDE_TOOL_WINDOW_WIDTH,
  MIN_SIDE_TOOL_WINDOW_WIDTH,
  type WorkspaceBottomPanelTab,
} from "./workspacePersistence";

export const TOOL_WINDOW_LAYOUT_KEY = "toolWindowLayouts";

export interface ToolWindowLayout {
  readonly bookmarksOpen: boolean;
  readonly bottomCollapsed: boolean;
  readonly bottomPanelHeight: number;
  readonly bottomPanelTab: WorkspaceBottomPanelTab;
  readonly changesNavigatorWidth: number;
  readonly commitRailWidth: number;
  readonly historyReviewWidth: number;
  readonly sideToolWindowWidth: number;
  readonly logOpen: boolean;
  readonly projectOpen: boolean;
}

export interface NamedToolWindowLayout {
  readonly id: string;
  readonly name: string;
  readonly state: ToolWindowLayout;
}

export const DEFAULT_TOOL_WINDOW_LAYOUT: ToolWindowLayout = {
  bookmarksOpen: false,
  bottomCollapsed: true,
  bottomPanelHeight: DEFAULT_BOTTOM_PANEL_HEIGHT,
  bottomPanelTab: "shelf",
  changesNavigatorWidth: 250,
  commitRailWidth: 315,
  historyReviewWidth: 210,
  sideToolWindowWidth: DEFAULT_SIDE_TOOL_WINDOW_WIDTH,
  logOpen: true,
  projectOpen: true,
};

export const DEFAULT_NAMED_TOOL_WINDOW_LAYOUT: NamedToolWindowLayout = {
  id: "custom",
  name: "Custom",
  state: DEFAULT_TOOL_WINDOW_LAYOUT,
};

const BOTTOM_PANEL_TABS: readonly WorkspaceBottomPanelTab[] = [
  "shelf",
  "stash",
  "recovery",
  "find",
  "localHistory",
  "gitConsole",
  "terminal",
];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}

export function parseToolWindowLayout(value: unknown): ToolWindowLayout {
  if (!isRecord(value)) return DEFAULT_TOOL_WINDOW_LAYOUT;
  const tab = BOTTOM_PANEL_TABS.find((candidate) => candidate === value.bottomPanelTab);
  return {
    bookmarksOpen: typeof value.bookmarksOpen === "boolean" ? value.bookmarksOpen : false,
    bottomCollapsed: typeof value.bottomCollapsed === "boolean" ? value.bottomCollapsed : true,
    bottomPanelHeight: boundedNumber(
      value.bottomPanelHeight,
      DEFAULT_BOTTOM_PANEL_HEIGHT,
      160,
      420,
    ),
    bottomPanelTab: tab ?? "shelf",
    changesNavigatorWidth: boundedNumber(value.changesNavigatorWidth, 250, 190, 420),
    commitRailWidth: boundedNumber(value.commitRailWidth, 315, 280, 480),
    historyReviewWidth:
      typeof value.historyReviewWidth === "number" && value.historyReviewWidth >= 640
        ? 210
        : boundedNumber(value.historyReviewWidth, 210, 180, 480),
    sideToolWindowWidth: boundedNumber(
      value.sideToolWindowWidth,
      DEFAULT_SIDE_TOOL_WINDOW_WIDTH,
      MIN_SIDE_TOOL_WINDOW_WIDTH,
      MAX_SIDE_TOOL_WINDOW_WIDTH,
    ),
    logOpen: typeof value.logOpen === "boolean" ? value.logOpen : true,
    projectOpen: typeof value.projectOpen === "boolean" ? value.projectOpen : true,
  };
}

export function parseNamedToolWindowLayout(value: unknown): NamedToolWindowLayout {
  if (!isRecord(value)) {
    return DEFAULT_NAMED_TOOL_WINDOW_LAYOUT;
  }
  return {
    id:
      typeof value.id === "string" && /^[A-Za-z0-9_-]{1,80}$/u.test(value.id) ? value.id : "custom",
    name:
      typeof value.name === "string" && value.name.trim() !== ""
        ? value.name.trim().slice(0, 64)
        : "Custom",
    state: parseToolWindowLayout(value.state),
  };
}

export function parseNamedToolWindowLayouts(value: unknown): readonly NamedToolWindowLayout[] {
  if (!Array.isArray(value)) return [DEFAULT_NAMED_TOOL_WINDOW_LAYOUT];
  const layouts = value
    .slice(0, 32)
    .map(parseNamedToolWindowLayout)
    .filter(
      (layout, index, all) => all.findIndex((candidate) => candidate.id === layout.id) === index,
    );
  return layouts.length > 0 ? layouts : [DEFAULT_NAMED_TOOL_WINDOW_LAYOUT];
}
