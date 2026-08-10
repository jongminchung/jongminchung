import { Button } from "@jongminchung/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useState } from "react";
import type { LogOrder } from "../../shared/contracts/model";
import { useDismissLayer } from "../CommandProvider";
import { Icon } from "../Icon";
import { CheckboxInput, Selector, TextInput } from "../ProductFormControls";
import { Popover } from "../ProductOverlays";
import type { CommitLogFilterState, CommitLogViewOptions } from "./commitLogTypes";

type FilterChange = <Key extends keyof CommitLogFilterState>(
  key: Key,
  value: CommitLogFilterState[Key],
) => void;
type ViewOptionChange = <Key extends keyof CommitLogViewOptions>(
  key: Key,
  value: CommitLogViewOptions[Key],
) => void;

function isLogOrder(value: string): value is LogOrder {
  return value === "topology" || value === "date" || value === "firstParent";
}

export function GraphFilterOptions({
  activeFilterCount,
  authors,
  filters,
  onChange,
  onReset,
}: {
  readonly activeFilterCount: number;
  readonly authors: readonly string[];
  readonly filters: CommitLogFilterState;
  readonly onChange: FilterChange;
  readonly onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  useDismissLayer(
    useMemo(
      () => ({
        id: "log-filters",
        priority: 110,
        active: open,
        dismiss: () => setOpen(false),
      }),
      [open],
    ),
  );

  return (
    <Popover
      alignment="end"
      hasAutoFocus
      isOpen={open}
      label="Graph Options"
      onOpenChange={setOpen}
      placement="below"
      width={300}
      content={
        <div className="grid gap-3 p-1">
          <Selector
            label="Author"
            onChange={(value) => onChange("author", value)}
            options={[
              { value: "all", label: "All authors" },
              ...authors.map((name) => ({
                value: name,
                label: name,
              })),
            ]}
            placement="below"
            size="sm"
            value={filters.author}
            width="100%"
          />
          <Selector
            label="Date"
            onChange={(value) => onChange("since", value)}
            options={[
              { value: "all", label: "All dates" },
              { value: "1 day ago", label: "Last day" },
              { value: "1 week ago", label: "Last week" },
              { value: "1 month ago", label: "Last month" },
            ]}
            placement="below"
            size="sm"
            value={filters.since}
            width="100%"
          />
          <TextInput
            label="Path"
            onChange={(value) => onChange("path", value)}
            placeholder="src/components"
            size="sm"
            value={filters.path}
            width="100%"
          />
          <Selector
            label="Order"
            onChange={(value) => {
              if (isLogOrder(value)) onChange("order", value);
            }}
            options={[
              { value: "topology", label: "Topology" },
              { value: "date", label: "Date" },
              { value: "firstParent", label: "First parent" },
            ]}
            placement="below"
            size="sm"
            value={filters.order}
            width="100%"
          />
          <Button
            onClick={onReset}
            type="button"
            disabled={activeFilterCount === 0 && filters.order === "topology"}
            className={cn("h-7 px-2.5")}
            variant="ghost"
            size="sm"
          >
            Reset filters
          </Button>
        </div>
      }
    >
      <Button
        type="button"
        aria-label="Graph Options"
        className={cn("h-5 min-w-5 px-0 aspect-square")}
        variant="ghost"
        size="icon-xs"
      >
        <Icon name="filter" size={14} />
      </Button>
    </Popover>
  );
}

export function GraphViewOptions({
  onChange,
  options,
}: {
  readonly onChange: ViewOptionChange;
  readonly options: CommitLogViewOptions;
}) {
  const [open, setOpen] = useState(false);
  useDismissLayer(
    useMemo(
      () => ({
        id: "log-view-options",
        priority: 110,
        active: open,
        dismiss: () => setOpen(false),
      }),
      [open],
    ),
  );

  return (
    <Tooltip>
      <Popover
        alignment="end"
        hasAutoFocus
        isOpen={open}
        label="View Options"
        onOpenChange={setOpen}
        placement="below"
        width={264}
        content={
          <div
            className={`logViewOptions [display:grid] [gap:3px] [padding:5px] [&>_strong]:[border-top:1px_solid_var(--border)] [&>_strong]:[color:var(--muted-foreground)] [&>_strong]:[font-size:10px] [&>_strong]:[margin:4px_5px_1px] [&>_strong]:[padding-top:6px] logViewOptions`}
          >
            <CheckboxInput isDisabled label="Root Names" size="sm" value={false} />
            <CheckboxInput
              label="Compact References View"
              onChange={(value) => onChange("compactReferences", value)}
              size="sm"
              value={options.compactReferences}
            />
            <CheckboxInput
              label="Tag Names"
              onChange={(value) => onChange("showTagNames", value)}
              size="sm"
              value={options.showTagNames}
            />
            <CheckboxInput
              label="Long Edges"
              onChange={(value) => onChange("showLongEdges", value)}
              size="sm"
              value={options.showLongEdges}
            />
            <CheckboxInput
              label="Commit Timestamp"
              onChange={(value) => onChange("preferCommitDate", value)}
              size="sm"
              value={options.preferCommitDate}
            />
            <CheckboxInput
              label="References on the Left"
              onChange={(value) => onChange("referencesOnLeft", value)}
              size="sm"
              value={options.referencesOnLeft}
            />
            <strong>Columns</strong>
            <CheckboxInput
              label="Author"
              onChange={(value) => onChange("showAuthor", value)}
              size="sm"
              value={options.showAuthor}
            />
            <CheckboxInput
              label="Date"
              onChange={(value) => onChange("showDate", value)}
              size="sm"
              value={options.showDate}
            />
            <CheckboxInput
              label="Commit Hash"
              onChange={(value) => onChange("showHash", value)}
              size="sm"
              value={options.showHash}
            />
          </div>
        }
      >
        <TooltipTrigger
          render={
            <Button
              type="button"
              aria-label="View Options"
              className={cn("h-5 min-w-5 px-0 aspect-square")}
              variant="ghost"
              size="icon-xs"
            >
              <Icon name="more" size={14} />
            </Button>
          }
        />
      </Popover>
      <TooltipContent>View Options</TooltipContent>
    </Tooltip>
  );
}
