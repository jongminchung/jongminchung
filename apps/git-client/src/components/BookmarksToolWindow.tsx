import { Button } from "@jongminchung/ui/components/button";
import { Toggle } from "@jongminchung/ui/components/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useState, type KeyboardEvent } from "react";
import type {
  BookmarkGroup,
  BookmarkViewOptions,
  LineBookmark,
  ProjectBookmarks,
} from "../domain/bookmarks";
import { useAppDialog } from "./AppDialog";
import { BookmarkGroupCreateDialog } from "./BookmarkGroupCreateDialog";
import { Icon } from "./Icon";
import { EmptyState } from "./ProductCollections";
import { CheckboxInput } from "./ProductFormControls";
import { Popover } from "./ProductOverlays";

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
    <div
      className={`bookmarkRow [align-items:center] [display:grid] [grid-template-columns:minmax(0,_1fr)_20px_20px_20px] [height:31px] [min-width:0] [&>_button]:[align-items:center] [&>_button]:[background:transparent] [&>_button]:[border:0] [&>_button]:[color:var(--muted-foreground)] [&>_button]:[display:flex] [&>_button]:[height:28px] [&>_button]:[justify-content:center] [&>_button]:[padding:0] [&>_button:hover]:[background:var(--overlay-hover)] [&>_button:first-child]:[display:grid] [&>_button:first-child]:[gap:0_5px] [&>_button:first-child]:[grid-template-columns:17px_minmax(0,_1fr)] [&>_button:first-child]:[grid-template-rows:15px_12px] [&>_button:first-child]:[justify-content:stretch] [&>_button:first-child]:[padding:1px_5px_1px_16px] [&>_button:first-child]:[text-align:left] [&>_button:first-child]:[width:100%] [&>_button:first-child[aria-selected=true]]:[background:var(--accent)] [&>_button:first-child>_span]:[align-items:center] [&>_button:first-child>_span]:[color:var(--primary)] [&>_button:first-child>_span]:[display:flex] [&>_button:first-child>_span]:[font-size:10px] [&>_button:first-child>_span]:[font-weight:700] [&>_button:first-child>_span]:[grid-row:1_/_3] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:11px] [&_strong]:[font-weight:500] [&_strong]:[overflow:hidden] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&_small]:[color:var(--disabled-foreground)] [&_small]:[font-size:9px] [&_small]:[overflow:hidden] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&>_button:nth-child(3)>_svg]:[transform:rotate(180deg)] bookmarkRow`}
      key={bookmark.id}
    >
      <Button
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
          "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
        )}
        variant="ghost"
        size="default"
        tabIndex={-1}
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
              aria-label="Move Up"
              onClick={() => onMoveBookmark(bookmark.id, -1)}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
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
              aria-label="Move Down"
              onClick={() => onMoveBookmark(bookmark.id, 1)}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
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
              aria-label="Delete Bookmark"
              onClick={() => onDeleteBookmark(bookmark.id)}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
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
      <section
        className={`bookmarkFileGroup [&>_div:first-child]:[align-items:center] [&>_div:first-child]:[color:var(--muted-foreground)] [&>_div:first-child]:[display:grid] [&>_div:first-child]:[gap:5px] [&>_div:first-child]:[grid-template-columns:14px_minmax(0,_1fr)_auto] [&>_div:first-child]:[height:22px] [&>_div:first-child]:[padding:0_7px_0_18px] [&>_div:first-child>_strong]:[font-size:10px] [&>_div:first-child>_strong]:[font-weight:500] [&>_div:first-child>_strong]:[overflow:hidden] [&>_div:first-child>_strong]:[text-overflow:ellipsis] [&>_div:first-child>_strong]:[white-space:nowrap] [&>_div:first-child>_small]:[font-size:9px] bookmarkFileGroup`}
        key={path}
        role="group"
      >
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
    <section
      aria-label="Bookmarks Tool Window"
      className={`bookmarksToolWindow [background:var(--card)] rounded-xl [display:grid] [grid-template-rows:30px_minmax(0,_1fr)] [min-height:0] [min-width:0] [overflow:hidden] bookmarksToolWindow rounded-xl`}
    >
      <header
        className={`projectToolHeader [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [padding:0_3px_0_6px] [&>_span]:[flex:1] [&>_button]:[align-items:center] [&>_button]:[background:transparent] [&>_button]:rounded-sm [&>_button]:[color:var(--muted-foreground)] [&>_button]:[display:flex] [&>_button]:[height:24px] [&>_button]:[justify-content:center] [&>_button]:[width:24px] [&>_button:first-child]:[color:var(--foreground)] [&>_button:first-child]:[font-size:12px] [&>_button:first-child]:[padding:0_4px] [&>_button:first-child]:[width:auto] [&>_button:hover]:[background:var(--muted)] [&>_button:hover]:[color:var(--foreground)] projectToolHeader [&>_button]:rounded-sm`}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Bookmarks"
                type="button"
                className={cn(
                  "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                )}
                variant="ghost"
                size="xs"
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
                aria-label="Create Bookmark List"
                onClick={() => setCreatingGroup(true)}
                type="button"
                className={cn(
                  "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
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
                aria-label="Edit"
                disabled={!selectedBookmark}
                onClick={() => selectedBookmark && void editBookmark(selectedBookmark)}
                type="button"
                className={cn(
                  "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
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
                aria-label="Expand All"
                onClick={() => setCollapsedGroups(new Set())}
                type="button"
                className={cn(
                  "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
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
                aria-label="Collapse All"
                onClick={() => setCollapsedGroups(new Set(state.groups.map((group) => group.id)))}
                type="button"
                className={cn(
                  "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
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
              <div
                className={`bookmarkOptions [display:grid] [gap:2px] [padding:5px] bookmarkOptions`}
              >
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
                  aria-label="Options"
                  type="button"
                  className={cn(
                    "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                  )}
                  variant="ghost"
                  size="icon-sm"
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
                aria-label="Close Bookmarks"
                onClick={onClose}
                type="button"
                className={cn(
                  "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
              >
                <Icon name="close" size={13} />
              </Button>
            }
          />
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </header>
      <div
        className={`bookmarksTree [min-height:0] [overflow:auto] [padding:3px_0] bookmarksTree`}
        role="tree"
      >
        {state.groups.map((group) => {
          const collapsed = collapsedGroups.has(group.id);
          return (
            <section key={group.id} role="group">
              <div
                className={`bookmarkGroupRow [align-items:center] [display:grid] [grid-template-columns:minmax(0,_1fr)_22px_22px_22px] [min-width:0] [&>_button]:[align-items:center] [&>_button]:[background:transparent] [&>_button]:[border:0] [&>_button]:[color:var(--muted-foreground)] [&>_button]:[display:flex] [&>_button]:[height:24px] [&>_button]:[justify-content:center] [&>_button]:[min-width:0] [&>_button]:[padding:0] [&>_button:hover]:[background:var(--overlay-hover)] [&>_button:first-child]:[gap:4px] [&>_button:first-child]:[justify-content:flex-start] [&>_button:first-child]:[padding:0_5px] [&>_button:first-child>_svg:first-child]:[transition:transform_100ms] [&>_button:first-child[aria-expanded=true]>_svg:first-child]:[transform:rotate(90deg)] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:11px] [&_strong]:[overflow:hidden] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&_small]:[background:var(--muted)] [&_small]:rounded-xs [&_small]:[font-size:9px] [&_small]:[margin-left:3px] [&_small]:[padding:1px_4px] bookmarkGroupRow [&_small]:rounded-xs`}
              >
                <Button
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
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
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
                        className={cn("h-7 px-2.5")}
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
                        aria-label={`Rename ${group.name}`}
                        onClick={() => void renameGroup(group)}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="outline"
                        size="sm"
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
                        aria-label={`Delete ${group.name}`}
                        disabled={state.groups.length <= 1}
                        onClick={() => onDeleteGroup(group)}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="outline"
                        size="sm"
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
          <EmptyState
            className="min-h-[180px] px-[22px] py-[22px] [&_[data-slot=empty-description]]:max-w-[230px] [&_[data-slot=empty-title]]:font-medium [&_[data-slot=empty-title]]:text-foreground"
            description="Add Bookmark (F3) to code lines, symbols, files, and directories."
            role="status"
            title="No bookmarks added."
          />
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
