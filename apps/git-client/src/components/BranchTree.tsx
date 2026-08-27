import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useMemo, useRef, useState } from "react";
import type { Ref, RefKind } from "../domain/types";
import { Icon } from "./Icon";
import { StatePill } from "./ProductCollections";

type TreeRow =
  | {
      readonly type: "group";
      readonly key: RefKind;
      readonly label: string;
      readonly count: number;
    }
  | { readonly type: "ref"; readonly ref: Ref };

const groupLabels: Readonly<Record<RefKind, string>> = {
  local: "Local",
  remote: "Remote",
  tag: "Tags",
};

function trackingLabel(tracking?: string): string | null {
  if (!tracking) return null;
  const ahead = /ahead (\d+)/.exec(tracking)?.[1];
  const behind = /behind (\d+)/.exec(tracking)?.[1];
  if (!ahead && !behind) return tracking.replace(/^\[|\]$/g, "");
  return [ahead ? `${ahead}↑` : null, behind ? `${behind}↓` : null]
    .filter(Boolean)
    .join(" ");
}

export const BranchTree = memo(function BranchTree({
  refs,
  selected,
  onSelect,
  onAdd,
  compact = false,
  onActivate,
}: {
  readonly refs: readonly Ref[];
  readonly selected?: string;
  readonly onSelect: (ref: Ref) => void;
  readonly onAdd: () => void;
  readonly compact?: boolean;
  readonly onActivate?: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<RefKind>>(new Set());
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (["local", "remote", "tag"] as const).flatMap<TreeRow>((kind) => {
      const group = refs.filter(
        (ref) =>
          ref.kind === kind &&
          (!normalized || ref.shortName.toLowerCase().includes(normalized)),
      );
      const children = collapsed.has(kind)
        ? []
        : group.map((ref) => ({ type: "ref" as const, ref }));
      return [
        {
          type: "group",
          key: kind,
          label: groupLabels[kind],
          count: group.length,
        },
        ...children,
      ];
    });
  }, [collapsed, query, refs]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 27,
    overscan: 8,
  });

  const toggle = (kind: RefKind) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  if (compact) {
    return (
      <aside
        className={`branchRail branchRail [min-height:0] [overflow:hidden] [background:var(--card)] [border-right:1px_solid_var(--border)] [&_button]:[display:flex] [&_button]:[height:100%] [&_button]:[width:100%] [&_button]:[flex-direction:column] [&_button]:[align-items:center] [&_button]:[justify-content:flex-start] [&_button]:[gap:5px] [&_button]:[padding:7px_0] [&_button]:[color:var(--muted-foreground)] [&_button]:[background:transparent] [&_button_span]:[transform:rotate(180deg)] [&_button_span]:[font-size:10px] [&_button_span]:[writing-mode:vertical-rl]`}
        aria-label="Branches and tags"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Branches"
                onClick={onActivate}
                type="button"
                className={cn(
                  "h-[31px] w-[30px] gap-1.5 rounded-none p-0 text-xs text-muted-foreground aria-pressed:text-primary",
                )}
                variant="ghost"
                size="default"
              >
                <Icon name="chevron" size={10} />
                <span>Branches</span>
              </Button>
            }
          />
          <TooltipContent>Branches</TooltipContent>
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside
      className={`branchPane branchPane [display:grid] [min-height:0] [min-width:0] [grid-template-rows:31px_38px_29px_minmax(0,_1fr)] [background:var(--card)] [border-right:1px_solid_var(--border)] max-[1050px]:[display:none]`}
      aria-label="Branches and tags"
    >
      <div
        className={`paneTitle paneTitle [display:flex] [align-items:center] [padding:0_6px_0_10px] [font-weight:650] [border-bottom:1px_solid_var(--border)] [&_span]:[flex:1]`}
      >
        <span>Repositories</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Add repository"
                onClick={onAdd}
                type="button"
                className="text-muted-foreground"
                variant="ghost"
                size="icon-sm"
              >
                <Icon name="plus" size={14} />
              </Button>
            }
          />
          <TooltipContent>Add repository</TooltipContent>
        </Tooltip>
      </div>
      <div
        className={`treeSearch treeSearch [margin:6px_7px] [display:flex] [align-items:center] [gap:5px] rounded-sm [padding:0_7px] [background:var(--secondary)] [border:1px_solid_var(--border)] [&_input]:[height:24px] [&_input]:[width:100%] [&_input]:[min-width:0] [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] [&:focus-within]:[border-color:var(--primary)] [&:focus-within]:[box-shadow:0_0_0_1px_color-mix(in_oklch,_var(--primary)_20%,_transparent)]`}
      >
        <Icon name="search" size={14} />
        <Input
          aria-label="Filter branches"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Branch or tag"
          value={query}
        />
      </div>
      <div
        className={`headRow headRow [display:flex] [align-items:center] [gap:6px] [padding:0_10px] [border-bottom:1px_solid_var(--border)] [&.muted]:[font-size:10px] [&.muted]:[color:var(--disabled-foreground)]`}
      >
        <Icon name="commit" size={14} />
        <strong>HEAD</strong>
        <span
          className={`muted muted [font-size:10px] [color:var(--disabled-foreground)]`}
        >
          (Current Branch)
        </span>
      </div>
      <div
        className={`virtualTree virtualTree [min-height:0] [overflow:auto]`}
        ref={parentRef}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            return (
              <div
                className={`treeVirtualRow treeVirtualRow [position:absolute] [top:0] [right:0] [left:0] [height:27px]`}
                key={row.type === "group" ? row.key : row.ref.name}
                style={{
                  transform: `translateY(${item.start}px)`,
                }}
              >
                {row.type === "group" ? (
                  <Button
                    onClick={() => toggle(row.key)}
                    type="button"
                    className={cn(
                      "flex min-h-0 text-xs text-muted-foreground",
                      `treeGroup treeGroup [display:flex] [height:27px] [width:100%] [align-items:center] [gap:5px] [padding:0_8px] [text-align:left] [font-size:11px] [font-weight:650] [color:var(--muted-foreground)] [text-transform:uppercase] [background:transparent] [&_small]:[margin-left:auto] [&_small]:[font-weight:400] [&_small]:[color:var(--disabled-foreground)] [&_svg:first-child]:[transform:rotate(0deg)] [&_svg:first-child]:[transition:transform_0.12s] [&.rotated]:[transform:rotate(90deg)] [&:hover]:[background:var(--muted)]`,
                    )}
                    variant="ghost"
                    size="default"
                  >
                    <Icon
                      className={
                        collapsed.has(row.key)
                          ? undefined
                          : `rotated rotated [transform:rotate(90deg)]`
                      }
                      name="chevron"
                      size={13}
                    />
                    <Icon
                      name={
                        row.key === "local"
                          ? "folder"
                          : row.key === "remote"
                            ? "remote"
                            : "tag"
                      }
                      size={14}
                    />
                    <span>{row.label}</span>
                    <small>{row.count}</small>
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          onClick={() => onSelect(row.ref)}
                          type="button"
                          className={cn(
                            "flex min-h-0 text-xs",
                            `${`refRow refRow [display:flex] [height:27px] [width:100%] [align-items:center] [gap:5px] [padding:0_8px] [text-align:left] [background:transparent] [&.selected]:[color:var(--foreground)] [&.selected]:[background:var(--accent)] [&:hover]:[background:var(--muted)]`} ${selected === row.ref.name ? `selected selected [color:var(--foreground)] [background:var(--accent)]` : ""}`,
                          )}
                          variant="ghost"
                          size="default"
                        >
                          <span
                            className={`refIndent refIndent [width:15px]`}
                          />
                          {row.ref.favorite ? (
                            <Icon
                              className={`favorite favorite [fill:var(--bookmark)] [color:var(--bookmark)]`}
                              name="star"
                              size={13}
                            />
                          ) : (
                            <Icon name="branch" size={13} />
                          )}
                          <span
                            className={`ellipsis ellipsis [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap]`}
                          >
                            {row.ref.shortName}
                          </span>
                          {trackingLabel(row.ref.tracking) && (
                            <small className="text-[10px] text-muted-foreground">
                              {trackingLabel(row.ref.tracking)}
                            </small>
                          )}
                          {row.ref.current && (
                            <StatePill
                              className="ml-auto rounded-lg border-0 px-1.5 py-px text-[8px]"
                              tone="primary"
                            >
                              HEAD
                            </StatePill>
                          )}
                        </Button>
                      }
                    />
                    <TooltipContent>
                      {[row.ref.subject, row.ref.tracking]
                        .filter(Boolean)
                        .join(" · ")}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
});
