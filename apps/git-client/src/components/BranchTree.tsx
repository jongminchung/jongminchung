import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useMemo, useRef, useState } from "react";
import type { Ref, RefKind } from "../domain/types";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

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
  return [ahead ? `${ahead}↑` : null, behind ? `${behind}↓` : null].filter(Boolean).join(" ");
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
          ref.kind === kind && (!normalized || ref.shortName.toLowerCase().includes(normalized)),
      );
      const children = collapsed.has(kind)
        ? []
        : group.map((ref) => ({ type: "ref" as const, ref }));
      return [
        { type: "group", key: kind, label: groupLabels[kind], count: group.length },
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
      <aside className={tw.branchRail} aria-label="Branches and tags">
        <button aria-label="Branches" onClick={onActivate} title="Branches">
          <Icon name="chevron" size={10} />
          <span>Branches</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className={tw.branchPane} aria-label="Branches and tags">
      <div className={tw.paneTitle}>
        <span>Repositories</span>
        <button className={tw.iconButton} onClick={onAdd} title="Add repository">
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className={tw.treeSearch}>
        <Icon name="search" size={14} />
        <input
          aria-label="Filter branches"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Branch or tag"
          value={query}
        />
      </div>
      <div className={tw.headRow}>
        <Icon name="commit" size={14} />
        <strong>HEAD</strong>
        <span className={tw.muted}>(Current Branch)</span>
      </div>
      <div className={tw.virtualTree} ref={parentRef}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            return (
              <div
                className={tw.treeVirtualRow}
                key={row.type === "group" ? row.key : row.ref.name}
                style={{ transform: `translateY(${item.start}px)` }}
              >
                {row.type === "group" ? (
                  <button className={tw.treeGroup} onClick={() => toggle(row.key)}>
                    <Icon
                      className={collapsed.has(row.key) ? undefined : tw.rotated}
                      name="chevron"
                      size={13}
                    />
                    <Icon
                      name={
                        row.key === "local" ? "folder" : row.key === "remote" ? "remote" : "tag"
                      }
                      size={14}
                    />
                    <span>{row.label}</span>
                    <small>{row.count}</small>
                  </button>
                ) : (
                  <button
                    className={`${tw.refRow} ${selected === row.ref.name ? tw.selected : ""}`}
                    onClick={() => onSelect(row.ref)}
                    title={[row.ref.subject, row.ref.tracking].filter(Boolean).join(" · ")}
                  >
                    <span className={tw.refIndent} />
                    {row.ref.favorite ? (
                      <Icon className={tw.favorite} name="star" size={13} />
                    ) : (
                      <Icon name="branch" size={13} />
                    )}
                    <span className={tw.ellipsis}>{row.ref.shortName}</span>
                    {trackingLabel(row.ref.tracking) && (
                      <small className="text-[10px] text-secondary">
                        {trackingLabel(row.ref.tracking)}
                      </small>
                    )}
                    {row.ref.current && <span className={tw.headPill}>HEAD</span>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
});
