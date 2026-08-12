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
        return (["local", "remote", "tag"] as const).flatMap<TreeRow>(
            (kind) => {
                const group = refs.filter(
                    (ref) =>
                        ref.kind === kind &&
                        (!normalized ||
                            ref.shortName.toLowerCase().includes(normalized)),
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
            },
        );
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
                className={`branchRail [background:var(--card)] [border-right:1px_solid_var(--border)] [min-height:0] [overflow:hidden] [&_button]:[align-items:center] [&_button]:[background:transparent] [&_button]:[color:var(--muted-foreground)] [&_button]:[display:flex] [&_button]:[flex-direction:column] [&_button]:[gap:5px] [&_button]:[height:100%] [&_button]:[justify-content:flex-start] [&_button]:[padding:7px_0] [&_button]:[width:100%] [&_button_span]:[font-size:10px] [&_button_span]:[writing-mode:vertical-rl] [&_button_span]:[transform:rotate(180deg)] branchRail`}
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
                                    "gap-1.5 text-xs h-[31px] w-[30px] rounded-none p-0 text-muted-foreground aria-pressed:text-primary",
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
            className={`branchPane [background:var(--card)] [min-height:0] [min-width:0] [border-right:1px_solid_var(--border)] [display:grid] [grid-template-rows:31px_38px_29px_minmax(0,_1fr)] max-[1050px]:[display:none] branchPane`}
            aria-label="Branches and tags"
        >
            <div
                className={`paneTitle [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [font-weight:650] [padding:0_6px_0_10px] [&_span]:[flex:1] paneTitle`}
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
                className={`treeSearch [align-items:center] [background:var(--secondary)] [border:1px_solid_var(--border)] rounded-sm [display:flex] [gap:5px] [margin:6px_7px] [padding:0_7px] [&:focus-within]:[border-color:var(--primary)] [&:focus-within]:[box-shadow:0_0_0_1px_color-mix(in_oklch,_var(--primary)_20%,_transparent)] [&_input]:[background:transparent] [&_input]:[border:0] [&_input]:[height:24px] [&_input]:[min-width:0] [&_input]:[outline:0] [&_input]:[width:100%] treeSearch rounded-sm`}
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
                className={`headRow [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:6px] [padding:0_10px] [&.muted]:[color:var(--disabled-foreground)] [&.muted]:[font-size:10px] headRow`}
            >
                <Icon name="commit" size={14} />
                <strong>HEAD</strong>
                <span
                    className={`muted [color:var(--disabled-foreground)] [font-size:10px] muted`}
                >
                    (Current Branch)
                </span>
            </div>
            <div
                className={`virtualTree [min-height:0] [overflow:auto] virtualTree`}
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
                                className={`treeVirtualRow [height:27px] [left:0] [position:absolute] [right:0] [top:0] treeVirtualRow`}
                                key={
                                    row.type === "group"
                                        ? row.key
                                        : row.ref.name
                                }
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
                                            `treeGroup [align-items:center] [background:transparent] [display:flex] [gap:5px] [height:27px] [padding:0_8px] [text-align:left] [width:100%] [color:var(--muted-foreground)] [font-size:11px] [font-weight:650] [text-transform:uppercase] [&_small]:[color:var(--disabled-foreground)] [&_small]:[font-weight:400] [&_small]:[margin-left:auto] [&_svg:first-child]:[transform:rotate(0deg)] [&_svg:first-child]:[transition:transform_0.12s] [&.rotated]:[transform:rotate(90deg)] [&:hover]:[background:var(--muted)] treeGroup`,
                                        )}
                                        variant="ghost"
                                        size="default"
                                    >
                                        <Icon
                                            className={
                                                collapsed.has(row.key)
                                                    ? undefined
                                                    : `rotated [transform:rotate(90deg)] rotated`
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
                                                    onClick={() =>
                                                        onSelect(row.ref)
                                                    }
                                                    type="button"
                                                    className={cn(
                                                        "flex min-h-0 text-xs",
                                                        `${`refRow [align-items:center] [background:transparent] [display:flex] [gap:5px] [height:27px] [padding:0_8px] [text-align:left] [width:100%] [&:hover]:[background:var(--muted)] [&.selected]:[background:var(--accent)] [&.selected]:[color:var(--foreground)] refRow`} ${selected === row.ref.name ? `selected [background:var(--accent)] [color:var(--foreground)] selected` : ""}`,
                                                    )}
                                                    variant="ghost"
                                                    size="default"
                                                >
                                                    <span
                                                        className={`refIndent [width:15px] refIndent`}
                                                    />
                                                    {row.ref.favorite ? (
                                                        <Icon
                                                            className={`favorite [color:var(--bookmark)] [fill:var(--bookmark)] favorite`}
                                                            name="star"
                                                            size={13}
                                                        />
                                                    ) : (
                                                        <Icon
                                                            name="branch"
                                                            size={13}
                                                        />
                                                    )}
                                                    <span
                                                        className={`ellipsis [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap] ellipsis`}
                                                    >
                                                        {row.ref.shortName}
                                                    </span>
                                                    {trackingLabel(
                                                        row.ref.tracking,
                                                    ) && (
                                                        <small className="text-[10px] text-muted-foreground">
                                                            {trackingLabel(
                                                                row.ref
                                                                    .tracking,
                                                            )}
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
