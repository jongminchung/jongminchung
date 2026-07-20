import { useMemo, useState, type KeyboardEvent } from "react";
import type {
  BookmarkGroup,
  BookmarkViewOptions,
  LineBookmark,
  ProjectBookmarks,
} from "../domain/bookmarks";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { BookmarkGroupCreateDialog } from "./BookmarkGroupCreateDialog";
import { Icon } from "./Icon";
import { CheckboxInput } from "./ui";
import { Popover } from "./ui";

export function BookmarksToolWindow({
  state,
  onClose,
  onOpenBookmark,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onSetDefaultGroup,
  onDescribeBookmark,
  onDeleteBookmark,
  onMoveBookmark,
  onViewOptionsChange,
}: {
  readonly state: ProjectBookmarks;
  readonly onClose: () => void;
  readonly onOpenBookmark: (bookmark: LineBookmark) => void;
  readonly onCreateGroup: (name: string, isDefault: boolean) => void;
  readonly onRenameGroup: (groupId: string, name: string) => void;
  readonly onDeleteGroup: (group: BookmarkGroup) => void;
  readonly onSetDefaultGroup: (groupId: string) => void;
  readonly onDescribeBookmark: (bookmarkId: string, description: string) => void;
  readonly onDeleteBookmark: (bookmarkId: string) => void;
  readonly onMoveBookmark: (bookmarkId: string, offset: -1 | 1) => void;
  readonly onViewOptionsChange: (options: BookmarkViewOptions) => void;
}) {
  const dialog = useAppDialog();
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string>();
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const bookmarks = useMemo(() => state.groups.flatMap((group) => group.bookmarks), [state.groups]);
  const selectedBookmark = bookmarks.find((bookmark) => bookmark.id === selectedBookmarkId);

  const renameGroup = async (group: BookmarkGroup): Promise<void> => {
    const name = await dialog.input({
      title: "Rename Bookmark List",
      label: "Bookmark list:",
      initialValue: group.name,
      confirmLabel: "Rename",
      validate: (value) => {
        const normalized = value.trim();
        if (!normalized) return "Enter a bookmark list name.";
        return state.groups.some(
          (candidate) => candidate.id !== group.id && candidate.name === normalized,
        )
          ? "A list with the specified name already exists"
          : null;
      },
    });
    if (name !== null) onRenameGroup(group.id, name);
  };

  const editBookmark = async (bookmark: LineBookmark): Promise<void> => {
    const description = await dialog.input({
      title: "Bookmark Description",
      label: "Enter a short bookmark description",
      initialValue: bookmark.description,
      confirmLabel: "OK",
    });
    if (description !== null) onDescribeBookmark(bookmark.id, description);
  };

  const onRowKeyDown = (event: KeyboardEvent<HTMLButtonElement>, bookmark: LineBookmark): void => {
    const index = bookmarks.findIndex((candidate) => candidate.id === bookmark.id);
    if (event.key === "Enter") onOpenBookmark(bookmark);
    else if (event.key === "Delete" || event.key === "Backspace") {
      onDeleteBookmark(bookmark.id);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const next = bookmarks[Math.min(bookmarks.length - 1, Math.max(0, index + offset))];
      if (next) {
        setSelectedBookmarkId(next.id);
        document.querySelector<HTMLElement>(`[data-bookmark-id="${CSS.escape(next.id)}"]`)?.focus();
      }
    } else return;
    event.preventDefault();
  };

  const renderBookmark = (bookmark: LineBookmark) => (
    <div className={tw.bookmarkRow} key={bookmark.id}>
      <button
        aria-selected={selectedBookmarkId === bookmark.id}
        data-bookmark-id={bookmark.id}
        onClick={() => {
          setSelectedBookmarkId(bookmark.id);
          if (state.view.autoscrollToSource || state.view.openInPreviewTab) {
            onOpenBookmark(bookmark);
          }
        }}
        onDoubleClick={() => onOpenBookmark(bookmark)}
        onKeyDown={(event) => onRowKeyDown(event, bookmark)}
        role="treeitem"
      >
        <span>{bookmark.mnemonic ?? <Icon name="bookmarkFilled" size={11} />}</span>
        <strong>{bookmark.description || bookmark.path.split("/").at(-1)}</strong>
        <small>
          {bookmark.path}, line {bookmark.line}
        </small>
      </button>
      <button aria-label="Move Up" onClick={() => onMoveBookmark(bookmark.id, -1)} title="Move Up">
        <Icon name="chevron" size={11} />
      </button>
      <button
        aria-label="Move Down"
        onClick={() => onMoveBookmark(bookmark.id, 1)}
        title="Move Down"
      >
        <Icon name="chevron" size={11} />
      </button>
      <button
        aria-label="Delete Bookmark"
        onClick={() => onDeleteBookmark(bookmark.id)}
        title="Delete"
      >
        <Icon name="close" size={11} />
      </button>
    </div>
  );

  const renderGroupBookmarks = (group: BookmarkGroup) => {
    if (!state.view.groupLineBookmarks) return group.bookmarks.map(renderBookmark);
    const byFile = new Map<string, LineBookmark[]>();
    for (const bookmark of group.bookmarks) {
      const current = byFile.get(bookmark.path) ?? [];
      byFile.set(bookmark.path, [...current, bookmark]);
    }
    return [...byFile].map(([path, entries]) => (
      <section className={tw.bookmarkFileGroup} key={path} role="group">
        <div>
          <Icon name="file" size={13} />
          <strong>{path}</strong>
          <small>{entries.length}</small>
        </div>
        {entries.map(renderBookmark)}
      </section>
    ));
  };

  return (
    <section aria-label="Bookmarks Tool Window" className={tw.bookmarksToolWindow}>
      <header className={tw.projectToolHeader}>
        <button aria-label="Bookmarks" title="Bookmarks">
          <strong>Bookmarks</strong>
        </button>
        <span />
        <button
          aria-label="Create Bookmark List"
          onClick={() => setCreatingGroup(true)}
          title="Create Bookmark List"
        >
          <Icon name="plus" size={14} />
        </button>
        <button
          aria-label="Edit"
          disabled={!selectedBookmark}
          onClick={() => selectedBookmark && void editBookmark(selectedBookmark)}
          title="Edit"
        >
          <Icon name="appearance" size={14} />
        </button>
        <button
          aria-label="Expand All"
          onClick={() => setCollapsedGroups(new Set())}
          title="Expand All"
        >
          <Icon name="chevron" size={14} />
        </button>
        <button
          aria-label="Collapse All"
          onClick={() => setCollapsedGroups(new Set(state.groups.map((group) => group.id)))}
          title="Collapse All"
        >
          <Icon name="minus" size={14} />
        </button>
        <Popover
          alignment="end"
          isOpen={optionsOpen}
          label="Bookmarks View Options"
          onOpenChange={setOptionsOpen}
          placement="below"
          width={260}
          content={
            <div className={tw.bookmarkOptions}>
              <CheckboxInput
                label="Group Line Bookmarks by File"
                onChange={(groupLineBookmarks) =>
                  onViewOptionsChange({ ...state.view, groupLineBookmarks })
                }
                size="sm"
                value={state.view.groupLineBookmarks}
              />
              <CheckboxInput
                label="Open Files in Preview Tab"
                onChange={(openInPreviewTab) =>
                  onViewOptionsChange({ ...state.view, openInPreviewTab })
                }
                size="sm"
                value={state.view.openInPreviewTab}
              />
              <CheckboxInput
                label="Autoscroll to Source"
                onChange={(autoscrollToSource) =>
                  onViewOptionsChange({ ...state.view, autoscrollToSource })
                }
                size="sm"
                value={state.view.autoscrollToSource}
              />
            </div>
          }
        >
          <button aria-label="Options" title="Options">
            <Icon name="more" size={14} />
          </button>
        </Popover>
        <button aria-label="Close Bookmarks" onClick={onClose} title="Close">
          <Icon name="close" size={13} />
        </button>
      </header>
      <div className={tw.bookmarksTree} role="tree">
        {state.groups.map((group) => {
          const collapsed = collapsedGroups.has(group.id);
          return (
            <section key={group.id} role="group">
              <div className={tw.bookmarkGroupRow}>
                <button
                  aria-expanded={!collapsed}
                  onClick={() =>
                    setCollapsedGroups((current) => {
                      const next = new Set(current);
                      if (next.has(group.id)) next.delete(group.id);
                      else next.add(group.id);
                      return next;
                    })
                  }
                >
                  <Icon name="chevron" size={12} />
                  <Icon name="bookmarksList" size={14} />
                  <strong>{group.name}</strong>
                  {group.isDefault && <small>Default</small>}
                </button>
                <button
                  aria-label={`Mark ${group.name} as Default`}
                  aria-pressed={group.isDefault}
                  onClick={() => onSetDefaultGroup(group.id)}
                  title={group.isDefault ? "Unmark List as Default" : "Mark List as Default"}
                >
                  <Icon name="check" size={12} />
                </button>
                <button
                  aria-label={`Rename ${group.name}`}
                  onClick={() => void renameGroup(group)}
                  title="Rename Bookmark List…"
                >
                  <Icon name="appearance" size={12} />
                </button>
                <button
                  aria-label={`Delete ${group.name}`}
                  disabled={state.groups.length <= 1}
                  onClick={() => onDeleteGroup(group)}
                  title="Delete Bookmark List"
                >
                  <Icon name="trash" size={12} />
                </button>
              </div>
              {!collapsed && renderGroupBookmarks(group)}
            </section>
          );
        })}
        {bookmarks.length === 0 && (
          <div className={tw.bookmarksEmptyState}>
            <strong>No bookmarks added.</strong>
            <span>Add Bookmark (F3) to code lines, symbols, files, and directories.</span>
          </div>
        )}
      </div>
      {creatingGroup && (
        <BookmarkGroupCreateDialog
          existingNames={new Set(state.groups.map((group) => group.name))}
          onClose={() => setCreatingGroup(false)}
          onCreate={(name, isDefault) => {
            onCreateGroup(name, isDefault);
            setCreatingGroup(false);
          }}
        />
      )}
      {dialog.node}
    </section>
  );
}
