import { Button } from "@base-ui/react/button";
import { Toggle } from "@base-ui/react/toggle";
import { useMemo, useState, type KeyboardEvent } from "react";
import type {
  BookmarkGroup,
  BookmarkViewOptions,
  LineBookmark,
  ProjectBookmarks,
} from "../domain/bookmarks";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { BookmarkGroupCreateDialog } from "./BookmarkGroupCreateDialog";
import { Icon } from "./Icon";
import { CheckboxInput, Popover, Tooltip, TooltipContent, TooltipTrigger } from "./ui";

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
      <Button
        data-slot="button"
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
        type="button"
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[29px] w-full justify-start whitespace-normal rounded-sm px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent aria-expanded:text-foreground",
        )}
      >
        <span>{bookmark.mnemonic ?? <Icon name="bookmarkFilled" size={11} />}</span>
        <strong>{bookmark.description || bookmark.path.split("/").at(-1)}</strong>
        <small>
          {bookmark.path}, line {bookmark.line}
        </small>
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              data-slot="button"
              aria-label="Move Up"
              onClick={() => onMoveBookmark(bookmark.id, -1)}
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80 h-7 px-2.5",
              )}
            >
              <Icon name="chevron" size={11} />
            </Button>
          }
        />
        <TooltipContent>Move Up</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              data-slot="button"
              aria-label="Move Down"
              onClick={() => onMoveBookmark(bookmark.id, 1)}
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80 h-7 px-2.5",
              )}
            >
              <Icon name="chevron" size={11} />
            </Button>
          }
        />
        <TooltipContent>Move Down</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              data-slot="button"
              aria-label="Delete Bookmark"
              onClick={() => onDeleteBookmark(bookmark.id)}
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80 h-7 px-2.5",
              )}
            >
              <Icon name="close" size={11} />
            </Button>
          }
        />
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-slot="button"
                aria-label="Bookmarks"
                type="button"
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[26px] min-w-[26px] p-1 text-muted-foreground hover:text-foreground",
                )}
              >
                <strong>Bookmarks</strong>
              </Button>
            }
          />
          <TooltipContent>Bookmarks</TooltipContent>
        </Tooltip>
        <span />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-slot="button"
                aria-label="Create Bookmark List"
                onClick={() => setCreatingGroup(true)}
                type="button"
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[26px] min-w-[26px] p-1 text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon name="plus" size={14} />
              </Button>
            }
          />
          <TooltipContent>Create Bookmark List</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-slot="button"
                aria-label="Edit"
                disabled={!selectedBookmark}
                onClick={() => selectedBookmark && void editBookmark(selectedBookmark)}
                type="button"
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[26px] min-w-[26px] p-1 text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon name="appearance" size={14} />
              </Button>
            }
          />
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-slot="button"
                aria-label="Expand All"
                onClick={() => setCollapsedGroups(new Set())}
                type="button"
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[26px] min-w-[26px] p-1 text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon name="chevron" size={14} />
              </Button>
            }
          />
          <TooltipContent>Expand All</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-slot="button"
                aria-label="Collapse All"
                onClick={() => setCollapsedGroups(new Set(state.groups.map((group) => group.id)))}
                type="button"
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[26px] min-w-[26px] p-1 text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon name="minus" size={14} />
              </Button>
            }
          />
          <TooltipContent>Collapse All</TooltipContent>
        </Tooltip>
        <Tooltip>
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
                    onViewOptionsChange({
                      ...state.view,
                      groupLineBookmarks,
                    })
                  }
                  size="sm"
                  value={state.view.groupLineBookmarks}
                />
                <CheckboxInput
                  label="Open Files in Preview Tab"
                  onChange={(openInPreviewTab) =>
                    onViewOptionsChange({
                      ...state.view,
                      openInPreviewTab,
                    })
                  }
                  size="sm"
                  value={state.view.openInPreviewTab}
                />
                <CheckboxInput
                  label="Autoscroll to Source"
                  onChange={(autoscrollToSource) =>
                    onViewOptionsChange({
                      ...state.view,
                      autoscrollToSource,
                    })
                  }
                  size="sm"
                  value={state.view.autoscrollToSource}
                />
              </div>
            }
          >
            <TooltipTrigger
              render={
                <Button
                  data-slot="button"
                  aria-label="Options"
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[26px] min-w-[26px] p-1 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon name="more" size={14} />
                </Button>
              }
            />
          </Popover>
          <TooltipContent>Options</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-slot="button"
                aria-label="Close Bookmarks"
                onClick={onClose}
                type="button"
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[26px] min-w-[26px] p-1 text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon name="close" size={13} />
              </Button>
            }
          />
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </header>
      <div className={tw.bookmarksTree} role="tree">
        {state.groups.map((group) => {
          const collapsed = collapsedGroups.has(group.id);
          return (
            <section key={group.id} role="group">
              <div className={tw.bookmarkGroupRow}>
                <Button
                  data-slot="button"
                  aria-expanded={!collapsed}
                  onClick={() =>
                    setCollapsedGroups((current) => {
                      const next = new Set(current);
                      if (next.has(group.id)) next.delete(group.id);
                      else next.add(group.id);
                      return next;
                    })
                  }
                  type="button"
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80 h-7 px-2.5",
                  )}
                >
                  <Icon name="chevron" size={12} />
                  <Icon name="bookmarksList" size={14} />
                  <strong>{group.name}</strong>
                  {group.isDefault && <small>Default</small>}
                </Button>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Toggle
                        aria-label={
                          group.isDefault ? "Unmark List as Default" : "Mark List as Default"
                        }
                        onPressedChange={() => onSetDefaultGroup(group.id)}
                        pressed={group.isDefault}
                        type="button"
                        className={cn(
                          "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80 h-7 px-2.5",
                        )}
                      >
                        <Icon name="check" size={12} />
                      </Toggle>
                    }
                  />
                  <TooltipContent>
                    {group.isDefault ? "Unmark List as Default" : "Mark List as Default"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        data-slot="button"
                        aria-label={`Rename ${group.name}`}
                        onClick={() => void renameGroup(group)}
                        type="button"
                        className={cn(
                          "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80 h-7 px-2.5",
                        )}
                      >
                        <Icon name="appearance" size={12} />
                      </Button>
                    }
                  />
                  <TooltipContent>Rename Bookmark List…</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        data-slot="button"
                        aria-label={`Delete ${group.name}`}
                        disabled={state.groups.length <= 1}
                        onClick={() => onDeleteGroup(group)}
                        type="button"
                        className={cn(
                          "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80 h-7 px-2.5",
                        )}
                      >
                        <Icon name="trash" size={12} />
                      </Button>
                    }
                  />
                  <TooltipContent>Delete Bookmark List</TooltipContent>
                </Tooltip>
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
