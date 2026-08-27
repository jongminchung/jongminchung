import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import { Toggle } from "@jongminchung/ui/components/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import type {
  KeyboardEventHandler,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  RefObject,
} from "react";
import {
  hasSameChangeSelection,
  type ChangeEntry,
  type ChangeSelection,
} from "../../domain/changeReview";
import type { FileChange } from "../../domain/types";
import type { GitOperation } from "../../shared/contracts/model/index";
import { Icon } from "../Icon";
import { EmptyState, StatusBadge } from "../ProductCollections";
import { VerticalResizeHandle } from "../VerticalResizeHandle";
import { selectionKey } from "./useChangeSelection";

interface ChangeNavigatorProps {
  readonly assign: (file: FileChange) => Promise<void>;
  readonly discardSelectedChanges: () => Promise<void>;
  readonly effectiveSelectedEntries: readonly ChangeEntry[];
  readonly entries: readonly ChangeEntry[];
  readonly filteredEntries: readonly ChangeEntry[];
  readonly navigator: RefObject<HTMLElement | null>;
  readonly navigatorWidth: number;
  readonly onFocusDiff: () => void;
  readonly onInspectFile: (
    file: FileChange,
    layer: ChangeSelection["layer"],
    view: "file" | "history" | "blame",
  ) => void;
  readonly onKeyDown: KeyboardEventHandler<HTMLElement>;
  readonly onNavigatorWidthChange: (width: number) => void;
  readonly onOpenCommitComposer: () => void;
  readonly onOperation: (operation: GitOperation) => Promise<void>;
  readonly onQueryChange: (query: string) => void;
  readonly onSelectEntry: (event: ReactMouseEvent, entry: ChangeEntry) => void;
  readonly onTreeModeChange: (treeMode: boolean) => void;
  readonly query: string;
  readonly searchInput: RefObject<HTMLInputElement | null>;
  readonly selectedEntry: ChangeEntry | null;
  readonly selectedKeys: ReadonlySet<string>;
  readonly selection: ChangeSelection | null;
  readonly staged: readonly ChangeEntry[];
  readonly toolWindow: boolean;
  readonly treeMode: boolean;
  readonly viewOptions: ReactNode;
  readonly worktree: readonly ChangeEntry[];
}

function statusLetter(file: FileChange): string {
  if (file.status === "untracked") return "?";
  if (file.status === "conflicted") return "!";
  return file.status.charAt(0).toUpperCase();
}

function statusClass(file: FileChange): string {
  if (file.status === "added")
    return "statusAdded [background:color-mix(in_oklch,_var(--success)_16%,_transparent)] [color:var(--success)] statusAdded";
  if (file.status === "deleted")
    return "statusDeleted [background:color-mix(in_oklch,_var(--destructive)_16%,_transparent)] [color:var(--destructive)] statusDeleted";
  if (file.status === "renamed" || file.status === "copied")
    return "statusRenamed [background:color-mix(in_oklch,_var(--primary)_16%,_transparent)] [color:var(--primary)] statusRenamed";
  if (file.status === "conflicted")
    return "statusConflict [background:color-mix(in_oklch,_var(--destructive)_16%,_transparent)] [color:var(--destructive)] statusConflict";
  if (file.status === "untracked")
    return "statusUnknown [background:var(--muted)] [color:var(--muted-foreground)] statusUnknown";
  return "statusModified [background:color-mix(in_oklch,_var(--primary)_16%,_transparent)] [color:var(--primary)] statusModified";
}

export function ChangeNavigator({
  assign,
  discardSelectedChanges,
  effectiveSelectedEntries,
  entries,
  filteredEntries,
  navigator,
  navigatorWidth,
  onFocusDiff,
  onInspectFile,
  onKeyDown,
  onNavigatorWidthChange,
  onOpenCommitComposer,
  onOperation,
  onQueryChange,
  onSelectEntry,
  onTreeModeChange,
  query,
  searchInput,
  selectedEntry,
  selectedKeys,
  selection,
  staged,
  toolWindow,
  treeMode,
  viewOptions,
  worktree,
}: ChangeNavigatorProps) {
  const actionClass =
    "gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground";
  const renderGroup = (
    label: "Staged" | "Working Tree",
    group: readonly ChangeEntry[],
  ) => (
    <section className="changeNavigatorGroup changeNavigatorGroup [&:first-child_>_header]:[border-top:0] [&>_header]:[position:sticky] [&>_header]:[top:0] [&>_header]:[z-index:var(--layer-local-content)] [&>_header]:[display:flex] [&>_header]:[height:29px] [&>_header]:[align-items:center] [&>_header]:[gap:6px] [&>_header]:[padding:0_7px] [&>_header]:[background:var(--secondary)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[border-top:1px_solid_var(--border)] [&>_header_button]:[padding:0_5px] [&>_header_button]:[color:var(--primary)] [&>_header_button]:[background:transparent] [&>_header_small]:[color:var(--disabled-foreground)] [&>_header_span]:[flex:1]">
      <header>
        <strong>{label}</strong>
        <small>{group.length}</small>
        <span />
        <Button
          disabled={group.length === 0}
          onClick={() =>
            void onOperation({
              kind: label === "Staged" ? "unstage" : "stage",
              paths: group.map((entry) => entry.file.path),
            })
          }
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          {label === "Staged" ? "Unstage all" : "Stage all"}
        </Button>
      </header>
      {group.map((entry) => {
        const folders = entry.file.path.split("/");
        const filename = folders.pop() ?? entry.file.path;
        const active = selection
          ? hasSameChangeSelection(entry.selection, selection)
          : false;
        const multiSelected = selectedKeys.has(selectionKey(entry.selection));
        return (
          <Tooltip key={selectionKey(entry.selection)}>
            <TooltipTrigger
              render={
                <Toggle
                  aria-current={active ? "true" : undefined}
                  onClick={(event) => onSelectEntry(event, entry)}
                  onDoubleClick={onFocusDiff}
                  pressed={multiSelected}
                  type="button"
                  className={cn(
                    "inline-flex min-h-[29px] w-full items-center justify-center justify-start gap-1.5 rounded-sm border border-transparent bg-transparent px-2 py-1 text-left text-xs whitespace-normal text-foreground transition-[color,background-color,border-color,box-shadow] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 aria-current:bg-accent aria-selected:bg-accent [&_svg]:pointer-events-none [&_svg]:shrink-0",
                    `changeNavigatorRow changeNavigatorRow [display:flex] [min-height:29px] [width:100%] [align-items:center] [gap:5px] rounded-none! [padding:3px_7px] [text-align:left] [background:transparent] [&_small]:[color:var(--disabled-foreground)] [&.multiSelected]:[background:color-mix(in_oklch,_var(--accent)_62%,_transparent)] [&.selected]:[background:var(--accent)] [&[aria-current=true]]:[background:var(--accent)] ${active ? "selected selected [color:var(--foreground)] [background:var(--accent)]" : ""} ${multiSelected && !active ? "multiSelected multiSelected [background:color-mix(in_oklch,_var(--accent)_62%,_transparent)]" : ""}`,
                  )}
                >
                  <StatusBadge className={statusClass(entry.file)}>
                    {statusLetter(entry.file)}
                  </StatusBadge>
                  <Icon
                    name={entry.file.submodule ? "worktree" : "file"}
                    size={13}
                  />
                  <span className="ellipsis ellipsis grid [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap]">
                    <strong className="truncate">
                      {treeMode ? filename : entry.file.path}
                    </strong>
                    {treeMode && folders.length > 0 && (
                      <small className="truncate">{folders.join("/")}</small>
                    )}
                  </span>
                  <span className="diffStat diffStat [margin-left:auto] [display:flex] [gap:4px] [font-size:9px] [&_b]:[font-weight:400] [&_b]:[color:var(--destructive)] [&_i]:[color:var(--success)] [&_i]:[font-style:normal]">
                    <i>+{entry.file.additions ?? 0}</i>
                    <b>−{entry.file.deletions ?? 0}</b>
                  </span>
                </Toggle>
              }
            />
            <TooltipContent>{entry.file.path}</TooltipContent>
          </Tooltip>
        );
      })}
    </section>
  );

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The focusable landmark owns file-navigation keyboard shortcuts.
    <aside
      aria-label="Changed files"
      className="changeNavigator changeNavigator [position:relative] [display:grid] [min-height:0] [min-width:0] [grid-template-rows:38px_minmax(0,_1fr)_auto] [outline:0] [border-right:1px_solid_var(--border)]"
      onKeyDown={onKeyDown}
      ref={(node) => {
        navigator.current = node;
      }}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The landmark owns file-navigation keyboard shortcuts.
      tabIndex={0}
    >
      {!toolWindow && (
        <VerticalResizeHandle
          direction={1}
          label="Resize change navigator"
          onChange={onNavigatorWidthChange}
          value={navigatorWidth}
        />
      )}
      <header className="changeNavigatorToolbar changeNavigatorToolbar [display:flex] [align-items:center] [gap:4px] [padding:5px_6px] [border-bottom:1px_solid_var(--border)] [&_input]:[width:100%] [&_input]:[min-width:0] [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] [&>_label]:[display:flex] [&>_label]:[height:27px] [&>_label]:[flex:1] [&>_label]:[align-items:center] [&>_label]:[gap:5px] [&>_label]:rounded-lg [&>_label]:[padding:0_7px] [&>_label]:[background:var(--secondary)] [&>_label]:[border:1px_solid_var(--border)] [&>_label:focus-within]:[border-color:var(--primary)] [&>_label:focus-within]:[box-shadow:0_0_0_2px_color-mix(in_oklch,_var(--primary)_22%,_transparent)]">
        <label>
          <Icon name="search" size={13} />
          <Input
            aria-label="Filter changed files"
            data-command-search="changes"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filter files"
            ref={searchInput}
            value={query}
          />
        </label>
        <Toggle
          aria-label={treeMode ? "Show flat list" : "Show tree paths"}
          onPressedChange={onTreeModeChange}
          pressed={treeMode}
          type="button"
          className="size-7 p-0 text-muted-foreground"
          size="sm"
        >
          <Icon name={treeMode ? "folder" : "changes"} size={13} />
        </Toggle>
        {!toolWindow && viewOptions}
        <Button
          aria-label="Open commit composer"
          hidden={toolWindow}
          onClick={onOpenCommitComposer}
          type="button"
          className="[display:none]! text-muted-foreground max-[1120px]:[display:inline-flex]!"
          variant="ghost"
          size="icon-sm"
        >
          <Icon name="commit" size={13} />
        </Button>
      </header>
      <div className="changeNavigatorList changeNavigatorList [min-height:0] [overflow:auto]">
        {entries.length === 0 ? (
          <EmptyState title="Working tree clean." />
        ) : filteredEntries.length === 0 ? (
          <EmptyState title="No changed files match this filter." />
        ) : (
          <>
            {renderGroup("Staged", staged)}
            {renderGroup("Working Tree", worktree)}
          </>
        )}
      </div>
      {selectedEntry && (
        <footer className="changeNavigatorActions changeNavigatorActions [display:flex] [flex-wrap:wrap] [gap:4px] [padding:5px] [border-top:1px_solid_var(--border)] [&_button]:[min-height:25px] [&_button]:[padding:0_6px] [&_button]:[color:var(--muted-foreground)] [&_button]:[background:transparent]">
          {effectiveSelectedEntries.some(
            (entry) => entry.selection.layer === "worktree",
          ) && (
            <Button
              onClick={() =>
                void onOperation({
                  kind: "stage",
                  paths: effectiveSelectedEntries
                    .filter((entry) => entry.selection.layer === "worktree")
                    .map((entry) => entry.file.path),
                })
              }
              type="button"
              className={actionClass}
              variant="ghost"
              size="default"
            >
              Stage selected
            </Button>
          )}
          {effectiveSelectedEntries.some(
            (entry) =>
              entry.selection.layer === "worktree" &&
              entry.file.status !== "conflicted",
          ) && (
            <Button
              onClick={() => void discardSelectedChanges()}
              type="button"
              className={actionClass}
              variant="ghost"
              size="default"
            >
              Discard…
            </Button>
          )}
          {effectiveSelectedEntries.some(
            (entry) => entry.selection.layer === "index",
          ) && (
            <Button
              onClick={() =>
                void onOperation({
                  kind: "unstage",
                  paths: effectiveSelectedEntries
                    .filter((entry) => entry.selection.layer === "index")
                    .map((entry) => entry.file.path),
                })
              }
              type="button"
              className={actionClass}
              variant="ghost"
              size="default"
            >
              Unstage selected
            </Button>
          )}
          {(["file", "history", "blame"] as const).map((view) => (
            <Button
              key={view}
              onClick={() =>
                onInspectFile(
                  selectedEntry.file,
                  selectedEntry.selection.layer,
                  view,
                )
              }
              type="button"
              className={actionClass}
              variant="ghost"
              size="default"
            >
              {view === "file"
                ? "View"
                : view[0]?.toUpperCase() + view.slice(1)}
            </Button>
          ))}
          {selectedEntry.selection.layer === "worktree" && (
            <Button
              onClick={() => void assign(selectedEntry.file)}
              type="button"
              className={actionClass}
              variant="ghost"
              size="default"
            >
              Changelist
            </Button>
          )}
        </footer>
      )}
    </aside>
  );
}
