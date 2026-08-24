import { Button } from "@jongminchung/ui/components/button";
import { Toggle } from "@jongminchung/ui/components/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import type { RefObject } from "react";
import type { Ref } from "../../domain/types";
import type { LogFilters } from "../../shared/contracts/model/index";
import { Icon } from "../Icon";
import { Selector, TextInput } from "../ProductFormControls";
import type {
  CommitLogFilterState,
  CommitLogViewOptions,
} from "./commitLogTypes";
import { GraphFilterOptions, GraphViewOptions } from "./GraphOptions";

type FilterChange = <Key extends keyof CommitLogFilterState>(
  key: Key,
  value: CommitLogFilterState[Key],
) => void;
type ViewOptionChange = <Key extends keyof CommitLogViewOptions>(
  key: Key,
  value: CommitLogViewOptions[Key],
) => void;

export function CommitLogToolbar({
  activeFilterCount,
  authors,
  canCherryPick,
  filterState,
  filters,
  indexing,
  indexingEnabled,
  onCherryPick,
  onEnableIndexing,
  onFilterChange,
  onImportPatch,
  onOpenNewTab,
  onRefresh,
  onResetFilters,
  onViewOptionChange,
  powerSaveMode,
  refs,
  searchInputRef,
  selectedOids,
  viewOptions,
}: {
  readonly activeFilterCount: number;
  readonly authors: readonly string[];
  readonly canCherryPick: boolean;
  readonly filterState: CommitLogFilterState;
  readonly filters: LogFilters;
  readonly indexing: boolean;
  readonly indexingEnabled: boolean;
  readonly onCherryPick: (oids: readonly string[]) => void;
  readonly onEnableIndexing: (
    filters: LogFilters,
    order: CommitLogFilterState["order"],
  ) => Promise<void>;
  readonly onFilterChange: FilterChange;
  readonly onImportPatch: () => void;
  readonly onOpenNewTab: () => void;
  readonly onRefresh: () => void;
  readonly onResetFilters: () => void;
  readonly onViewOptionChange: ViewOptionChange;
  readonly powerSaveMode: boolean;
  readonly refs: readonly Ref[];
  readonly searchInputRef: RefObject<HTMLInputElement | null>;
  readonly selectedOids: readonly string[];
  readonly viewOptions: CommitLogViewOptions;
}) {
  const indexingLabel = powerSaveMode
    ? "Git Log Indexing is unavailable in Power Save Mode"
    : indexing
      ? "Indexing Git Log"
      : "Enable Git Log Indexing";

  return (
    <div
      className={`logFilters [align-items:center] [background:var(--secondary)] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:1px] [overflow:hidden] [padding:0_3px] [&>_label]:[flex:none] logFilters`}
      style={{ height: 35 }}
    >
      <div
        className={`logSearchControls [flex:0_1_145px] [height:22px] [max-width:145px] [min-width:125px] [position:relative] [&_input]:[padding-right:39px]! [&>_button]:[position:absolute] [&>_button]:[top:1px] [&>_button:nth-of-type(1)]:[right:19px] [&>_button:nth-of-type(2)]:[right:0] logSearchControls`}
        style={{ height: 35 }}
      >
        <TextInput
          className="h-7! min-w-0 rounded-sm px-1.5"
          data-command-search="history"
          isLabelHidden
          label="Search"
          onChange={(value) => onFilterChange("query", value)}
          placeholder="Text or hash"
          ref={searchInputRef}
          size="sm"
          startIcon={<Icon name="search" size={14} />}
          value={filterState.query}
          width="100%"
        />
        <Toggle
          aria-label="Use regular expression"
          onPressedChange={(value) => onFilterChange("regex", value)}
          pressed={filterState.regex}
          type="button"
          className={cn(
            "h-5 min-w-5 border-transparent bg-transparent px-1 font-mono text-[9px] text-muted-foreground hover:bg-accent hover:text-accent-foreground data-pressed:bg-accent data-pressed:text-foreground",
          )}
        >
          .*
        </Toggle>
        <Toggle
          aria-label="Match case"
          onPressedChange={(value) => onFilterChange("matchCase", value)}
          pressed={filterState.matchCase}
          type="button"
          className={cn(
            "h-5 min-w-5 border-transparent bg-transparent px-1 font-mono text-[9px] text-muted-foreground hover:bg-accent hover:text-accent-foreground data-pressed:bg-accent data-pressed:text-foreground",
          )}
        >
          Cc
        </Toggle>
      </div>
      <Selector
        isLabelHidden
        label="Branch"
        onChange={(value) => onFilterChange("branch", value)}
        options={[
          { value: "all", label: "Branch" },
          ...refs.map((ref) => ({
            value: ref.name,
            label: ref.shortName,
          })),
        ]}
        placement="below"
        className="h-7! rounded-sm px-1.5!"
        size="sm"
        value={filterState.branch}
        width={74}
      />
      <Selector
        isLabelHidden
        label="User"
        onChange={(value) => onFilterChange("author", value)}
        options={[
          { value: "all", label: "User" },
          ...authors.map((name) => ({ value: name, label: name })),
        ]}
        placement="below"
        className="h-7! rounded-sm px-1.5!"
        size="sm"
        value={filterState.author}
        width={64}
      />
      <Selector
        isLabelHidden
        label="Date"
        onChange={(value) => onFilterChange("since", value)}
        options={[
          { value: "all", label: "Date" },
          { value: "1 day ago", label: "Last day" },
          { value: "1 week ago", label: "Last week" },
          { value: "1 month ago", label: "Last month" },
        ]}
        placement="below"
        className="h-7! rounded-sm px-1.5!"
        size="sm"
        value={filterState.since}
        width={64}
      />
      <TextInput
        className="h-7! rounded-sm px-1.5"
        isLabelHidden
        label="Paths"
        onChange={(value) => onFilterChange("path", value)}
        placeholder="Paths"
        size="sm"
        value={filterState.path}
        width={65}
      />
      <span className={`filterSpacer [flex:1] filterSpacer`} />
      <GraphFilterOptions
        activeFilterCount={activeFilterCount}
        authors={authors}
        filters={filterState}
        onChange={onFilterChange}
        onReset={onResetFilters}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={onOpenNewTab}
              type="button"
              aria-label="Open New Git Log Tab"
              className={cn("h-5 min-w-5 px-0 aspect-square")}
              variant="ghost"
              size="icon-xs"
            >
              <Icon name="plus" size={14} />
            </Button>
          }
        />
        <TooltipContent>Open New Git Log Tab</TooltipContent>
      </Tooltip>
      {!indexingEnabled && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={() =>
                  void onEnableIndexing(filters, filterState.order)
                }
                type="button"
                aria-label={indexingLabel}
                disabled={indexing || powerSaveMode}
                className={cn("h-5 min-w-5 px-0 aspect-square")}
                variant="ghost"
                size="icon-xs"
              >
                <Icon name="search" size={14} />
              </Button>
            }
          />
          <TooltipContent>{indexingLabel}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={onRefresh}
              type="button"
              aria-label="Refresh"
              className={cn("h-5 min-w-5 px-0 aspect-square")}
              variant="ghost"
              size="icon-xs"
            >
              <Icon name="refresh" size={14} />
            </Button>
          }
        />
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={() => onCherryPick(selectedOids)}
              type="button"
              aria-label="Cherry-Pick"
              disabled={!canCherryPick}
              className={cn("h-5 min-w-5 px-0 aspect-square")}
              variant="ghost"
              size="icon-xs"
            >
              <Icon name="cherry" size={14} />
            </Button>
          }
        />
        <TooltipContent>Cherry-Pick</TooltipContent>
      </Tooltip>
      <GraphViewOptions onChange={onViewOptionChange} options={viewOptions} />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={() => searchInputRef.current?.focus()}
              type="button"
              aria-label="Go To Hash/Branch/Tag"
              className={cn("h-5 min-w-5 px-0 aspect-square")}
              variant="ghost"
              size="icon-xs"
            >
              <Icon name="search" size={14} />
            </Button>
          }
        />
        <TooltipContent>Go To Hash/Branch/Tag</TooltipContent>
      </Tooltip>
      <Button
        onClick={onImportPatch}
        tabIndex={-1}
        type="button"
        className={cn(
          "h-7 px-2.5",
          `srOnly [clip:rect(0_0_0_0)] [clip-path:inset(50%)] [height:1px] [overflow:hidden] [position:absolute] [left:0] [top:0] [white-space:nowrap] [width:1px] srOnly`,
        )}
        variant="outline"
        size="sm"
      >
        Import Patch
      </Button>
    </div>
  );
}
