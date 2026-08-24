import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  adjacentHostingChangeRequest,
  filterHostingChangeRequests,
  type HostingListScope,
} from "../../domain/hostingView";
import type { HostingChangeRequest } from "../../shared/contracts/model/index";
import { Icon } from "../Icon";
import { EmptyState } from "../ProductCollections";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ProductSelect";

interface HostingRequestListProps {
  readonly items: readonly HostingChangeRequest[];
  readonly nextPage: number | null;
  readonly onInspect: (item: HostingChangeRequest) => void;
  readonly onLoadMore: (page: number) => void;
  readonly selectedNumber: number | null;
}

export function HostingRequestList({
  items,
  nextPage,
  onInspect,
  onLoadMore,
  selectedNumber,
}: HostingRequestListProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<HostingListScope>("open");
  const visibleItems = useMemo(
    () => filterHostingChangeRequests(items, query, scope),
    [items, query, scope],
  );

  const navigate = (event: KeyboardEvent<HTMLElement>): void => {
    const direction =
      event.key === "ArrowDown"
        ? "next"
        : event.key === "ArrowUp"
          ? "previous"
          : event.key === "Home"
            ? "first"
            : event.key === "End"
              ? "last"
              : null;
    if (direction === null) return;
    event.preventDefault();
    const next = adjacentHostingChangeRequest(
      visibleItems,
      selectedNumber,
      direction,
    );
    if (next) onInspect(next);
  };

  return (
    <div
      className={`hostingList [min-height:0] [overflow:auto] [border-right:1px_solid_var(--border)] [&>_button]:[align-items:stretch] [&>_button]:[background:transparent] [&>_button]:[border:0] [&>_button]:[border-bottom:1px_solid_var(--border)] [&>_button]:rounded-none [&>_button]:[display:flex] [&>_button]:[flex-direction:column] [&>_button]:[gap:4px] [&>_button]:[padding:10px_11px] [&>_button]:[text-align:left] [&>_button]:[width:100%] [&_small]:[color:var(--disabled-foreground)] hostingList [&>_button]:rounded-none`}
      aria-label="Pull and merge requests"
      onKeyDown={navigate}
      role="grid"
      tabIndex={0}
    >
      <div
        className={`hostingListToolbar [align-items:center] [background:var(--muted)] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:5px] [padding:5px] [position:sticky] [top:0] [z-index:var(--layer-local-content)] [&>_label]:[align-items:center] [&>_label]:[background:var(--secondary)] [&>_label]:[border:1px_solid_var(--border)] [&>_label]:rounded-sm [&>_label]:[display:flex] [&>_label]:[flex:1] [&>_label]:[gap:5px] [&>_label]:[padding:0_6px] [&>_label_input]:[background:transparent] [&>_label_input]:[border:0] [&>_label_input]:[min-width:0] [&>_label_input]:[outline:0] [&>_label_input]:[padding:0] [&>_label_input]:[width:100%] [&>_select]:[width:78px] hostingListToolbar [&>_label]:rounded-sm`}
      >
        <label>
          <Icon name="search" size={13} />
          <Input
            aria-label="Filter pull and merge requests"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            value={query}
          />
        </label>
        <Select
          onValueChange={(value) =>
            value && setScope(value as HostingListScope)
          }
          value={scope}
        >
          <SelectTrigger
            aria-label="Pull and merge request state"
            className="w-[78px] bg-secondary"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {items.length === 0 && (
        <EmptyState title="Load pull or merge requests for this project." />
      )}
      {items.length > 0 && visibleItems.length === 0 && (
        <EmptyState title="No pull or merge requests match the filter." />
      )}
      {visibleItems.map((item) => (
        <Button
          aria-current={selectedNumber === item.number ? "true" : undefined}
          key={item.number}
          onClick={() => onInspect(item)}
          type="button"
          className="min-h-[29px] w-full justify-start gap-1.5 whitespace-normal px-2 py-1 text-left text-xs aria-current:bg-accent aria-current:text-foreground"
          variant="ghost"
          size="default"
        >
          <span>
            #{item.number} · {item.state}
            {item.draft ? " · draft" : ""}
          </span>
          <strong>{item.title}</strong>
          <small>
            {item.author} · {item.sourceBranch} → {item.targetBranch}
          </small>
        </Button>
      ))}
      {nextPage && (
        <Button
          onClick={() => onLoadMore(nextPage)}
          type="button"
          className="min-h-[29px] w-full items-center justify-start gap-1.5 whitespace-normal px-2 py-1 text-left text-xs text-primary"
          variant="ghost"
          size="default"
        >
          Load more
        </Button>
      )}
    </div>
  );
}
