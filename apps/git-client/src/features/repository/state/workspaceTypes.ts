import type { BookmarksPopupMode } from "../../../components/BookmarksPopup";
import type { FindResultsSession } from "../../../components/FindResultsPanel";
import type { InspectorTab } from "../../../components/RepositoryInspectorDialog";
import type {
  BookmarkLocation,
  BookmarkMnemonic,
} from "../../../domain/bookmarks";
import type { FileChange } from "../../../domain/types";
export type { EditorStatus } from "../../../domain/editorContracts";
import type {
  FileContent,
  FilePreview,
  FileSource,
  SubmoduleDiff,
} from "../../../shared/contracts/model/index";

export interface ContextPosition {
  readonly x: number;
  readonly y: number;
}

export interface ShareExistingRemotes {
  readonly provider: "gitHub" | "gitLab";
  readonly remotes: readonly string[];
}

export interface DiffState {
  readonly file: FileChange;
  readonly patch: string;
  readonly loading: boolean;
  readonly mode: "readOnly" | "stage" | "unstage";
}

export interface PersistentDiffState {
  readonly patch: string;
  readonly loading: boolean;
}

export interface RevisionComparisonState {
  readonly from: string;
  readonly to: string;
  readonly patch: string;
  readonly loading: boolean;
}

export interface DiffPreviewPair {
  readonly before: FilePreview | null;
  readonly after: FilePreview | null;
  readonly loading: boolean;
}

export interface DiffContentPair {
  readonly before: FileContent | null;
  readonly after: FileContent | null;
  readonly loading: boolean;
}

export interface SubmoduleDiffState {
  readonly value: SubmoduleDiff | null;
  readonly loading: boolean;
}

export interface HistoryRewriteRequest {
  readonly fromRevision: string;
  readonly squashOids: readonly string[];
}

export interface InspectorState {
  readonly revision: string;
  readonly source: FileSource;
  readonly path?: string;
  readonly tab: InspectorTab;
  readonly line?: number;
  readonly column?: number;
  readonly scratchId?: string;
}

export function inspectorKey(inspector: InspectorState): string {
  const source =
    inspector.source.kind === "revision"
      ? `revision:${inspector.source.revision}`
      : inspector.source.kind;
  return `${source}:${inspector.path ?? ""}`;
}

export interface BookmarkMnemonicTarget {
  readonly bookmarkId: string;
  readonly location: BookmarkLocation;
  readonly current: BookmarkMnemonic | null;
  readonly description: string;
  readonly creating: boolean;
}

export interface BookmarkGroupTarget {
  readonly bookmarkId: string;
  readonly location: BookmarkLocation;
  readonly mnemonic: BookmarkMnemonic | null;
  readonly description: string;
}

export type RepositoryToolWindow = "project" | "bookmarks" | "bottom";
export type ShareProjectProvider = "gitHub" | "gitLab";

export type RepositoryWorkspaceOverlay =
  | BookmarksPopupMode
  | FindResultsSession
  | BookmarkMnemonicTarget
  | BookmarkGroupTarget;
