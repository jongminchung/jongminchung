import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import type { KeyboardEventHandler, MouseEvent, RefObject } from "react";
import type { Commit } from "../../domain/types";
import { CommitGraph } from "../CommitGraph";
import { Notice } from "../Notice";
import { EmptyState, Spinner } from "../ProductCollections";
import type { CommitLogViewOptions } from "./commitLogTypes";

export const LOG_ROW_HEIGHT = 25;
const HISTORY_COMMIT_ROW_CLASS = `${`commitRow [html[data-compact=true]_&]:h-[22px]! [align-items:stretch]! [background:transparent] rounded-none! [display:grid]! [font-weight:400]! [grid-template-columns:34px_minmax(190px,_1fr)_100px_145px] [grid-template-rows:minmax(0,_1fr)] [height:20px]! [justify-content:start]! [left:0] [padding:0_3px]! [position:absolute] [right:0] [text-align:left] [top:0] [width:100%] [&:hover]:[background:color-mix(in_oklch,_var(--accent)_42%,_transparent)] [&>_*]:[align-items:center] [&>_*]:[display:flex] [&>_*]:[min-height:0] [&>_*]:[min-width:0] [&>_*]:[padding:0_4px] [&_strong]:[font-weight:600] [&>_span:last-child]:[color:var(--muted-foreground)] [&>_span:last-child]:[font-size:11px] commitRow rounded-none!`} [height:25px]!`;

function commitTime(timestamp: number, relativeTimeBaseSeconds?: number): string {
  const nowSeconds = relativeTimeBaseSeconds ?? Date.now() / 1000;
  const elapsedSeconds = Math.max(0, Math.floor(nowSeconds - timestamp));
  if (elapsedSeconds < 60) return "now";
  if (elapsedSeconds < 3_600) {
    const minutes = Math.floor(elapsedSeconds / 60);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  if (elapsedSeconds < 86_400) {
    const hours = Math.floor(elapsedSeconds / 3_600);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (elapsedSeconds < 604_800) {
    const days = Math.floor(elapsedSeconds / 86_400);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

export function CommitLogTable({
  activeFilterCount,
  behind,
  branch,
  error,
  filtered,
  loadMore,
  loading,
  normalizedQuery,
  onContextMenu,
  onKeyDown,
  onSelect,
  relativeTimeBaseSeconds,
  selectedOids,
  tableRef,
  toPushOids,
  upstreamRef,
  viewOptions,
}: {
  readonly activeFilterCount: number;
  readonly behind: number;
  readonly branch: string;
  readonly error: string | null;
  readonly filtered: readonly Commit[];
  readonly loadMore: () => Promise<void>;
  readonly loading: boolean;
  readonly normalizedQuery: string;
  readonly onContextMenu: (event: MouseEvent, commit: Commit) => void;
  readonly onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  readonly onSelect: (event: MouseEvent, commit: Commit) => void;
  readonly relativeTimeBaseSeconds?: number;
  readonly selectedOids: readonly string[];
  readonly tableRef: RefObject<HTMLDivElement | null>;
  readonly toPushOids: ReadonlySet<string>;
  readonly upstreamRef: string | null;
  readonly viewOptions: CommitLogViewOptions;
}) {
  const rowColumns = `34px minmax(190px, 1fr) ${viewOptions.showAuthor ? "100px" : "0px"} ${viewOptions.showDate ? "90px" : "0px"}`;

  return (
    <div
      aria-colcount={4}
      aria-label="Git log"
      aria-rowcount={filtered.length}
      className={`commitScroller [background:var(--card)] [min-height:0] [overflow:auto] [position:relative] commitScroller`}
      onScroll={(event) => {
        const target = event.currentTarget;
        if (target.scrollHeight - target.scrollTop - target.clientHeight < 220) {
          void loadMore();
        }
      }}
      onKeyDown={onKeyDown}
      ref={tableRef}
      role="table"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The virtualized Git log owns arrow-key navigation.
      tabIndex={0}
    >
      <div
        className={`srOnly [clip:rect(0_0_0_0)] [clip-path:inset(50%)] [height:1px] [overflow:hidden] [position:absolute] [left:0] [top:0] [white-space:nowrap] [width:1px] srOnly`}
        role="row"
      >
        <span role="columnheader">Graph</span>
        <span role="columnheader">Commit</span>
        <span role="columnheader">Author</span>
        <span role="columnheader">Date</span>
      </div>
      {filtered.length === 0 ? (
        loading ? (
          <Spinner
            className="h-full w-full justify-center px-6"
            label="Searching commit history…"
          />
        ) : error ? (
          <Notice className="m-auto w-auto max-w-lg" role="alert" size="sm" tone="destructive">
            {error}
          </Notice>
        ) : (
          <EmptyState
            role="status"
            title={
              normalizedQuery || activeFilterCount > 0 || branch !== "all"
                ? "No commits match these filters."
                : "This repository has no commits yet."
            }
          />
        )
      ) : (
        <div
          style={{
            height: filtered.length * LOG_ROW_HEIGHT + (loading || error ? LOG_ROW_HEIGHT : 0),
            position: "relative",
          }}
        >
          <div
            className={`graphCanvas [left:2px] [pointer-events:none] [position:absolute] [top:0] [width:34px] [z-index:2] graphCanvas`}
          >
            <CommitGraph commits={filtered} width={34} showLongEdges={viewOptions.showLongEdges} />
          </div>
          {filtered.map((commit, index) => {
            const selected = selectedOids.includes(commit.oid);
            const toPush = toPushOids.has(commit.oid);
            const toPull = behind > 0 && upstreamRef !== null && commit.refs.includes(upstreamRef);
            const references = commit.refs.filter(
              (ref) => viewOptions.showTagNames || !ref.startsWith("tag: refs/tags/"),
            );
            const visibleReferences = viewOptions.compactReferences
              ? references.slice(0, 1)
              : references;
            const displayedTime = commitTime(
              viewOptions.preferCommitDate ? commit.committedAt : commit.authoredAt,
              relativeTimeBaseSeconds,
            );
            const referenceBadges = visibleReferences.map((ref) => (
              <em key={ref}>
                {ref
                  .replace("HEAD -> refs/heads/", "")
                  .replace("refs/remotes/", "")
                  .replace("refs/heads/", "")
                  .replace("tag: refs/tags/", "")}
              </em>
            ));
            return (
              <Button
                aria-label={`${commit.author} ${displayedTime} ${commit.subject} ${commit.oid.slice(0, 7)}`}
                aria-rowindex={index + 1}
                aria-selected={selected}
                data-sync-state={toPush ? "push" : toPull ? "pull" : undefined}
                data-oid={commit.oid}
                key={commit.oid}
                onClick={(event) => onSelect(event, commit)}
                onContextMenu={(event) => onContextMenu(event, commit)}
                role="row"
                style={{
                  gridTemplateColumns: rowColumns,
                  height: LOG_ROW_HEIGHT,
                  transform: `translateY(${index * LOG_ROW_HEIGHT}px)`,
                }}
                type="button"
                className={cn(
                  "grid min-h-0 text-xs whitespace-normal text-left aria-selected:bg-accent aria-current:bg-accent",
                  `${HISTORY_COMMIT_ROW_CLASS} ${selected ? `selectedCommit [background:var(--accent)]! selectedCommit` : ""}`,
                )}
                variant="ghost"
                size="default"
              >
                <span aria-hidden="true" />
                <span
                  aria-label={commit.subject}
                  className={`commitSubject [gap:6px] [&_em]:[background:color-mix(in_oklch,_var(--primary)_16%,_var(--card))] [&_em]:[border:1px_solid_color-mix(in_oklch,_var(--primary)_35%,_var(--border))] [&_em]:rounded-xs [&_em]:[color:var(--primary)] [&_em]:[flex:none] [&_em]:[font-size:9px] [&_em]:[font-style:normal] [&_em]:[padding:1px_4px] [&_code]:[color:var(--disabled-foreground)] [&_code]:[font-size:9px] [&_code]:[margin-left:auto] commitSubject [&_em]:rounded-xs`}
                  role="cell"
                >
                  {viewOptions.referencesOnLeft && referenceBadges}
                  <span
                    className={`ellipsis [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap] ellipsis`}
                  >
                    {commit.subject}
                  </span>
                  {!viewOptions.referencesOnLeft && referenceBadges}
                  {viewOptions.showHash && <code>{commit.oid.slice(0, 7)}</code>}
                </span>
                <span
                  className={`ellipsis [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap] ellipsis`}
                  hidden={!viewOptions.showAuthor}
                  role="cell"
                >
                  {commit.author}
                </span>
                <span
                  className={`ellipsis [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap] ellipsis`}
                  hidden={!viewOptions.showDate}
                  role="cell"
                >
                  {displayedTime}
                </span>
              </Button>
            );
          })}
          {error ? (
            <Notice
              className="absolute top-0 right-0 left-0 h-5 rounded-none border-x-0 px-2 py-0 pl-[42px] text-[10px]"
              role="alert"
              size="sm"
              style={{
                transform: `translateY(${filtered.length * LOG_ROW_HEIGHT}px)`,
              }}
              tone="destructive"
            >
              {error}
            </Notice>
          ) : loading ? (
            <Spinner
              className="absolute top-0 right-0 left-0 h-5 pl-[42px] text-[10px]"
              label="Loading commits…"
              size="sm"
              style={{
                transform: `translateY(${filtered.length * LOG_ROW_HEIGHT}px)`,
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
