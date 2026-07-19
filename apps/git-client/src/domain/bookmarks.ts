export type BookmarkMnemonic =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"
  | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T"
  | "U" | "V" | "W" | "X" | "Y" | "Z";

export interface LineBookmark {
  readonly id: string;
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly description: string;
  readonly mnemonic: BookmarkMnemonic | null;
}

export interface BookmarkGroup {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly bookmarks: readonly LineBookmark[];
}

export interface ProjectBookmarks {
  readonly schemaVersion: 1;
  readonly view: BookmarkViewOptions;
  readonly groups: readonly BookmarkGroup[];
}

export interface BookmarkViewOptions {
  readonly groupLineBookmarks: boolean;
  readonly openInPreviewTab: boolean;
  readonly autoscrollToSource: boolean;
}

export const DEFAULT_BOOKMARK_VIEW_OPTIONS: BookmarkViewOptions = {
  groupLineBookmarks: false,
  openInPreviewTab: true,
  autoscrollToSource: false,
};

export interface BookmarkLocation {
  readonly path: string;
  readonly line: number;
  readonly column: number;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isBookmarkMnemonic(value: unknown): value is BookmarkMnemonic {
  return typeof value === "string" && /^[0-9A-Z]$/u.test(value);
}

function parseLineBookmark(value: unknown): LineBookmark | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.path !== "string" ||
    !Number.isInteger(value.line) ||
    Number(value.line) < 1 ||
    !Number.isInteger(value.column) ||
    Number(value.column) < 1 ||
    typeof value.description !== "string" ||
    (value.mnemonic !== null && !isBookmarkMnemonic(value.mnemonic))
  ) return null;
  return {
    id: value.id,
    path: value.path,
    line: Number(value.line),
    column: Number(value.column),
    description: value.description,
    mnemonic: value.mnemonic,
  };
}

function fallbackGroup(projectName: string): BookmarkGroup {
  return {
    id: `project:${projectName}`,
    name: projectName,
    isDefault: false,
    bookmarks: [],
  };
}

export function parseProjectBookmarks(
  value: unknown,
  projectName: string,
): ProjectBookmarks {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.groups)) {
    return {
      schemaVersion: 1,
      view: DEFAULT_BOOKMARK_VIEW_OPTIONS,
      groups: [fallbackGroup(projectName)],
    };
  }
  const names = new Set<string>();
  const bookmarkIds = new Set<string>();
  let hasDefault = false;
  const groups = value.groups.flatMap((candidate): readonly BookmarkGroup[] => {
    if (!isRecord(candidate)) return [];
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string" ||
      candidate.name.trim() === "" ||
      typeof candidate.isDefault !== "boolean" ||
      !Array.isArray(candidate.bookmarks) ||
      names.has(candidate.name)
    ) return [];
    names.add(candidate.name);
    const isDefault = candidate.isDefault && !hasDefault;
    if (isDefault) hasDefault = true;
    const bookmarks = candidate.bookmarks.flatMap((bookmark): readonly LineBookmark[] => {
      const parsed = parseLineBookmark(bookmark);
      if (!parsed || bookmarkIds.has(parsed.id)) return [];
      bookmarkIds.add(parsed.id);
      return [parsed];
    });
    return [{
      id: candidate.id,
      name: candidate.name,
      isDefault,
      bookmarks,
    }];
  });
  return {
    schemaVersion: 1,
    view: isRecord(value.view)
      ? {
          groupLineBookmarks: value.view.groupLineBookmarks === true,
          openInPreviewTab: value.view.openInPreviewTab !== false,
          autoscrollToSource: value.view.autoscrollToSource === true,
        }
      : DEFAULT_BOOKMARK_VIEW_OPTIONS,
    groups: groups.length > 0
      ? [
          ...groups.filter((group) => group.isDefault),
          ...groups.filter((group) => !group.isDefault),
        ]
      : [fallbackGroup(projectName)],
  };
}

export function allLineBookmarks(state: ProjectBookmarks): readonly LineBookmark[] {
  return state.groups.flatMap((group) => group.bookmarks);
}

export function bookmarkAt(
  state: ProjectBookmarks,
  location: Pick<BookmarkLocation, "path" | "line">,
): LineBookmark | null {
  return allLineBookmarks(state).find(
    (bookmark) => bookmark.path === location.path && bookmark.line === location.line,
  ) ?? null;
}

export function toggleLineBookmark(
  state: ProjectBookmarks,
  location: BookmarkLocation,
  id: string,
  mnemonic: BookmarkMnemonic | null = null,
): ProjectBookmarks {
  const existing = bookmarkAt(state, location);
  if (existing) return removeBookmark(state, existing.id);
  const group = state.groups.find((candidate) => candidate.isDefault) ?? state.groups[0];
  return group
    ? addLineBookmarkToGroup(state, location, id, group.id, mnemonic)
    : state;
}

export function addLineBookmarkToGroup(
  state: ProjectBookmarks,
  location: BookmarkLocation,
  id: string,
  groupId: string,
  mnemonic: BookmarkMnemonic | null = null,
): ProjectBookmarks {
  if (bookmarkAt(state, location)) return state;
  const next: LineBookmark = {
    id,
    path: location.path,
    line: location.line,
    column: location.column,
    description: "",
    mnemonic,
  };
  return {
    ...state,
    groups: state.groups.map((group) =>
      group.id === groupId
        ? { ...group, bookmarks: [...group.bookmarks, next] }
        : group,
    ),
  };
}

export function removeBookmark(
  state: ProjectBookmarks,
  bookmarkId: string,
): ProjectBookmarks {
  return {
    ...state,
    groups: state.groups.map((group) => ({
      ...group,
      bookmarks: group.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
    })),
  };
}

export function describeBookmark(
  state: ProjectBookmarks,
  bookmarkId: string,
  description: string,
): ProjectBookmarks {
  return updateBookmark(state, bookmarkId, (bookmark) => ({
    ...bookmark,
    description,
  }));
}

export function assignBookmarkMnemonic(
  state: ProjectBookmarks,
  bookmarkId: string,
  mnemonic: BookmarkMnemonic | null,
): ProjectBookmarks {
  return {
    ...state,
    groups: state.groups.map((group) => ({
      ...group,
      bookmarks: group.bookmarks.map((bookmark) => {
        if (bookmark.id === bookmarkId) return { ...bookmark, mnemonic };
        return mnemonic !== null && bookmark.mnemonic === mnemonic
          ? { ...bookmark, mnemonic: null }
          : bookmark;
      }),
    })),
  };
}

function updateBookmark(
  state: ProjectBookmarks,
  bookmarkId: string,
  update: (bookmark: LineBookmark) => LineBookmark,
): ProjectBookmarks {
  return {
    ...state,
    groups: state.groups.map((group) => ({
      ...group,
      bookmarks: group.bookmarks.map((bookmark) =>
        bookmark.id === bookmarkId ? update(bookmark) : bookmark,
      ),
    })),
  };
}

export function moveBookmark(
  state: ProjectBookmarks,
  bookmarkId: string,
  offset: -1 | 1,
): ProjectBookmarks {
  return {
    ...state,
    groups: state.groups.map((group) => {
      const index = group.bookmarks.findIndex((bookmark) => bookmark.id === bookmarkId);
      if (index < 0) return group;
      const target = index + offset;
      if (target < 0 || target >= group.bookmarks.length) return group;
      const bookmarks = [...group.bookmarks];
      const [bookmark] = bookmarks.splice(index, 1);
      if (!bookmark) return group;
      bookmarks.splice(target, 0, bookmark);
      return { ...group, bookmarks };
    }),
  };
}

export function createBookmarkGroup(
  state: ProjectBookmarks,
  id: string,
  name: string,
  isDefault: boolean,
): ProjectBookmarks {
  const normalized = name.trim();
  if (!normalized || state.groups.some((group) => group.name === normalized)) return state;
  const group: BookmarkGroup = {
    id,
    name: normalized,
    isDefault,
    bookmarks: [],
  };
  return {
    ...state,
    groups: isDefault
      ? [group, ...state.groups.map((candidate) => ({ ...candidate, isDefault: false }))]
      : [...state.groups, group],
  };
}

export function renameBookmarkGroup(
  state: ProjectBookmarks,
  groupId: string,
  name: string,
): ProjectBookmarks {
  const normalized = name.trim();
  if (
    !normalized ||
    state.groups.some((group) => group.id !== groupId && group.name === normalized)
  ) return state;
  return {
    ...state,
    groups: state.groups.map((group) =>
      group.id === groupId ? { ...group, name: normalized } : group,
    ),
  };
}

export function deleteBookmarkGroup(
  state: ProjectBookmarks,
  groupId: string,
): ProjectBookmarks {
  if (state.groups.length <= 1) return state;
  return {
    ...state,
    groups: state.groups.filter((group) => group.id !== groupId),
  };
}

export function setDefaultBookmarkGroup(
  state: ProjectBookmarks,
  groupId: string,
): ProjectBookmarks {
  const selected = state.groups.find((group) => group.id === groupId);
  if (!selected) return state;
  if (selected.isDefault) {
    return {
      ...state,
      groups: state.groups.map((group) => ({ ...group, isDefault: false })),
    };
  }
  return {
    ...state,
    groups: [
      { ...selected, isDefault: true },
      ...state.groups
        .filter((group) => group.id !== groupId)
        .map((group) => ({ ...group, isDefault: false })),
    ],
  };
}

export function relativeBookmark(
  state: ProjectBookmarks,
  current: Pick<BookmarkLocation, "path" | "line"> | null,
  offset: -1 | 1,
): LineBookmark | null {
  const bookmarks = allLineBookmarks(state);
  if (bookmarks.length === 0) return null;
  const currentIndex = current
    ? bookmarks.findIndex(
        (bookmark) => bookmark.path === current.path && bookmark.line === current.line,
      )
    : -1;
  const index = currentIndex < 0
    ? offset > 0 ? 0 : bookmarks.length - 1
    : (currentIndex + offset + bookmarks.length) % bookmarks.length;
  return bookmarks[index] ?? null;
}
