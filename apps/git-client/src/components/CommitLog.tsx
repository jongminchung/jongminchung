import { Button } from "@jongminchung/ui/components/button";
import { Toggle } from "@jongminchung/ui/components/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Commit, Ref } from "../domain/types";
import type { LogFilters, LogOrder } from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { useDismissLayer } from "./CommandProvider";
import { CommitGraph } from "./CommitGraph";
import { Icon } from "./Icon";
import { CheckboxInput } from "./ProductFormControls";
import { Selector } from "./ProductFormControls";
import { TextInput } from "./ProductFormControls";
import { Popover } from "./ProductOverlays";

const LOG_ROW_HEIGHT = 20;

function commitTime(timestamp: number, relativeTimeBaseSeconds?: number): string {
  const nowSeconds = relativeTimeBaseSeconds ?? Date.now() / 1000;
  const elapsedSeconds = Math.max(0, Math.floor(nowSeconds - timestamp));
  if (elapsedSeconds < 60) return "now";
  if (elapsedSeconds < 3_600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86_400) return `${Math.floor(elapsedSeconds / 3_600)}h ago`;
  if (elapsedSeconds < 604_800) return `${Math.floor(elapsedSeconds / 86_400)}d ago`;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function isLogOrder(value: string): value is LogOrder {
  return value === "topology" || value === "date" || value === "firstParent";
}

export const CommitLog = memo(function CommitLog({
  commits,
  selectedOids,
  onSelectionChange,
  onContextMenu,
  refs,
  hasMore,
  onLoad,
  onImportPatch,
  onRefresh,
  onOpenNewTab,
  onEnableIndexing,
  indexingEnabled,
  indexing,
  onCherryPick,
  canCherryPick,
  loading,
  error,
  ahead,
  behind,
  upstream,
  powerSaveMode,
  relativeTimeBaseSeconds,
}: {
  readonly commits: readonly Commit[];
  readonly selectedOids: readonly string[];
  readonly onSelectionChange: (oids: readonly string[]) => void;
  readonly onContextMenu: (event: React.MouseEvent, commit: Commit) => void;
  readonly refs: readonly Ref[];
  readonly hasMore: boolean;
  readonly onLoad: (filters: LogFilters, order: LogOrder, append: boolean) => Promise<void>;
  readonly onImportPatch: () => void;
  readonly onRefresh: () => void;
  readonly onOpenNewTab: () => void;
  readonly onEnableIndexing: (filters: LogFilters, order: LogOrder) => Promise<void>;
  readonly indexingEnabled: boolean;
  readonly indexing: boolean;
  readonly onCherryPick: (oids: readonly string[]) => void;
  readonly canCherryPick: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly ahead: number;
  readonly behind: number;
  readonly upstream?: string;
  readonly powerSaveMode: boolean;
  readonly relativeTimeBaseSeconds?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [author, setAuthor] = useState("all");
  const [branch, setBranch] = useState("all");
  const [since, setSince] = useState("all");
  const [path, setPath] = useState("");
  const [order, setOrder] = useState<LogOrder>("topology");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [showAuthor, setShowAuthor] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [showHash, setShowHash] = useState(false);
  const [showTagNames, setShowTagNames] = useState(true);
  const [compactReferences, setCompactReferences] = useState(false);
  const [showLongEdges, setShowLongEdges] = useState(true);
  const [referencesOnLeft, setReferencesOnLeft] = useState(false);
  const [preferCommitDate, setPreferCommitDate] = useState(false);
  const firstLoad = useRef(true);
  const loadingMore = useRef(false);
  const normalizedQuery = query.trim();
  const queryPattern = useMemo<RegExp | null>(() => {
    if (!regex || normalizedQuery.length === 0) return null;
    try {
      return new RegExp(normalizedQuery, matchCase ? "" : "i");
    } catch {
      return null;
    }
  }, [matchCase, normalizedQuery, regex]);
  const authors = useMemo(() => [...new Set(commits.map((commit) => commit.author))], [commits]);
  const filtered = useMemo(
    () =>
      commits.filter(
        (commit) =>
          (normalizedQuery.length === 0 ||
            (regex
              ? queryPattern?.test(`${commit.subject}\n${commit.oid}`) === true
              : (matchCase ? commit.subject : commit.subject.toLowerCase()).includes(
                  matchCase ? normalizedQuery : normalizedQuery.toLowerCase(),
                ) ||
                (matchCase ? commit.oid : commit.oid.toLowerCase()).startsWith(
                  matchCase ? normalizedQuery : normalizedQuery.toLowerCase(),
                ))) &&
          (author === "all" || commit.author === author),
      ),
    [author, commits, matchCase, normalizedQuery, queryPattern, regex],
  );
  const toPushOids = useMemo(
    () => new Set(commits.slice(0, Math.max(0, ahead)).map((commit) => commit.oid)),
    [ahead, commits],
  );
  const upstreamRef = upstream ? `refs/remotes/${upstream}` : null;
  const indexingLabel = powerSaveMode
    ? "Git Log Indexing is unavailable in Power Save Mode"
    : indexing
      ? "Indexing Git Log"
      : "Enable Git Log Indexing";

  const filters = useMemo<LogFilters>(
    () => ({
      query: normalizedQuery || null,
      branch: branch === "all" ? null : branch,
      author: author === "all" ? null : author,
      since: since === "all" ? null : since,
      until: null,
      paths: path.trim() ? [path.trim()] : [],
      noMerges: false,
      regex,
      matchCase,
    }),
    [author, branch, matchCase, normalizedQuery, path, regex, since],
  );

  const activeFilterCount =
    Number(Boolean(normalizedQuery)) +
    Number(branch !== "all") +
    Number(author !== "all") +
    Number(since !== "all") +
    Number(Boolean(path.trim()));
  const rowColumns = `34px minmax(190px, 1fr) ${showAuthor ? "100px" : "0px"} ${showDate ? "145px" : "0px"}`;

  const loadMore = async (): Promise<void> => {
    if (!hasMore || loading || loadingMore.current) return;
    loadingMore.current = true;
    try {
      await onLoad(filters, order, true);
    } finally {
      loadingMore.current = false;
    }
  };

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      void onLoad(filters, order, false);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [filters, onLoad, order]);

  useEffect(() => {
    const find = (event: Event): void => {
      if (!(event instanceof CustomEvent) || !normalizedQuery || filtered.length === 0) return;
      const ownsSearch =
        searchInput.current === document.activeElement ||
        parentRef.current?.contains(document.activeElement);
      if (!ownsSearch) return;
      const direction = event.detail?.direction === -1 ? -1 : 1;
      const current = filtered.findIndex((commit) => commit.oid === selectedOids[0]);
      const index = ((current < 0 ? 0 : current) + direction + filtered.length) % filtered.length;
      const commit = filtered[index];
      if (commit) onSelectionChange([commit.oid]);
    };
    window.addEventListener("git-client:find", find);
    return () => window.removeEventListener("git-client:find", find);
  }, [filtered, normalizedQuery, onSelectionChange, selectedOids]);

  const select = (event: React.MouseEvent, commit: Commit) => {
    if (event.metaKey || event.ctrlKey) {
      onSelectionChange(
        selectedOids.includes(commit.oid)
          ? selectedOids.filter((oid) => oid !== commit.oid)
          : [...selectedOids, commit.oid],
      );
    } else if (event.shiftKey && selectedOids[0]) {
      const from = filtered.findIndex((item) => item.oid === selectedOids[0]);
      const to = filtered.findIndex((item) => item.oid === commit.oid);
      onSelectionChange(
        filtered.slice(Math.min(from, to), Math.max(from, to) + 1).map((item) => item.oid),
      );
    } else onSelectionChange([commit.oid]);
  };

  const navigateCommit = (direction: "parent" | "child"): void => {
    const selected = commits.find((commit) => commit.oid === selectedOids[0]);
    if (!selected) return;
    const oid =
      direction === "parent"
        ? selected.parents[0]
        : commits.find((commit) => commit.parents.includes(selected.oid))?.oid;
    if (oid) onSelectionChange([oid]);
  };

  const navigateRow = (offset: number): void => {
    if (filtered.length === 0) return;
    const current = filtered.findIndex((commit) => commit.oid === selectedOids[0]);
    const nextIndex = Math.max(
      0,
      Math.min(filtered.length - 1, (current < 0 ? 0 : current) + offset),
    );
    const next = filtered[nextIndex];
    if (!next) return;
    onSelectionChange([next.oid]);
    window.requestAnimationFrame(() => {
      parentRef.current
        ?.querySelector<HTMLElement>(`[data-oid="${next.oid}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  useDismissLayer(
    useMemo(
      () => ({
        id: "log-filters",
        priority: 110,
        active: filtersOpen,
        dismiss: () => setFiltersOpen(false),
      }),
      [filtersOpen],
    ),
  );
  useDismissLayer(
    useMemo(
      () => ({
        id: "log-view-options",
        priority: 110,
        active: viewOptionsOpen,
        dismiss: () => setViewOptionsOpen(false),
      }),
      [viewOptionsOpen],
    ),
  );

  return (
    <section className={tw.logPane} aria-busy={loading} aria-label="Commit log">
      <div className={tw.logFilters}>
        <div className={tw.logSearchControls}>
          <TextInput
            className="min-w-0"
            data-command-search="history"
            isLabelHidden
            label="Search"
            onChange={setQuery}
            placeholder="Text or hash"
            ref={searchInput}
            size="sm"
            startIcon={<Icon name="search" size={14} />}
            value={query}
            width="100%"
          />
          <Toggle
            aria-label="Use regular expression"
            onPressedChange={setRegex}
            pressed={regex}
            type="button"
            className={cn(
              " h-6 min-w-5 px-1 border-transparent bg-transparent font-mono text-[9px] text-muted-foreground hover:bg-accent hover:text-accent-foreground data-pressed:bg-accent data-pressed:text-foreground",
            )}
          >
            .*
          </Toggle>
          <Toggle
            aria-label="Match case"
            onPressedChange={setMatchCase}
            pressed={matchCase}
            type="button"
            className={cn(
              " h-6 min-w-5 px-1 border-transparent bg-transparent font-mono text-[9px] text-muted-foreground hover:bg-accent hover:text-accent-foreground data-pressed:bg-accent data-pressed:text-foreground",
            )}
          >
            Cc
          </Toggle>
        </div>
        <Selector
          isLabelHidden
          label="Branch"
          onChange={setBranch}
          options={[
            { value: "all", label: "Branch" },
            ...refs.map((ref) => ({
              value: ref.name,
              label: ref.shortName,
            })),
          ]}
          placement="below"
          size="sm"
          value={branch}
          width={62}
        />
        <Selector
          isLabelHidden
          label="User"
          onChange={setAuthor}
          options={[
            { value: "all", label: "User" },
            ...authors.map((name) => ({
              value: name,
              label: name,
            })),
          ]}
          placement="below"
          size="sm"
          value={author}
          width={55}
        />
        <Selector
          isLabelHidden
          label="Date"
          onChange={setSince}
          options={[
            { value: "all", label: "Date" },
            { value: "1 day ago", label: "Last day" },
            { value: "1 week ago", label: "Last week" },
            { value: "1 month ago", label: "Last month" },
          ]}
          placement="below"
          size="sm"
          value={since}
          width={55}
        />
        <TextInput
          isLabelHidden
          label="Paths"
          onChange={setPath}
          placeholder="Paths"
          size="sm"
          value={path}
          width={65}
        />
        <span className={tw.filterSpacer} />
        <Popover
          alignment="end"
          hasAutoFocus
          isOpen={filtersOpen}
          label="Graph Options"
          onOpenChange={setFiltersOpen}
          placement="below"
          width={300}
          content={
            <div className="grid gap-3 p-1">
              <Selector
                label="Author"
                onChange={setAuthor}
                options={[
                  { value: "all", label: "All authors" },
                  ...authors.map((name) => ({
                    value: name,
                    label: name,
                  })),
                ]}
                placement="below"
                size="sm"
                value={author}
                width="100%"
              />
              <Selector
                label="Date"
                onChange={setSince}
                options={[
                  { value: "all", label: "All dates" },
                  { value: "1 day ago", label: "Last day" },
                  { value: "1 week ago", label: "Last week" },
                  {
                    value: "1 month ago",
                    label: "Last month",
                  },
                ]}
                placement="below"
                size="sm"
                value={since}
                width="100%"
              />
              <TextInput
                label="Path"
                onChange={setPath}
                placeholder="src/components"
                size="sm"
                value={path}
                width="100%"
              />
              <Selector
                label="Order"
                onChange={(value) => {
                  if (isLogOrder(value)) setOrder(value);
                }}
                options={[
                  { value: "topology", label: "Topology" },
                  { value: "date", label: "Date" },
                  {
                    value: "firstParent",
                    label: "First parent",
                  },
                ]}
                placement="below"
                size="sm"
                value={order}
                width="100%"
              />
              <Button
                onClick={() => {
                  setQuery("");
                  setBranch("all");
                  setAuthor("all");
                  setSince("all");
                  setPath("");
                  setOrder("topology");
                }}
                type="button"
                disabled={activeFilterCount === 0 && order === "topology"}
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
            aria-label={"Graph Options"}
            className={cn("h-6 min-w-5 px-1 aspect-square px-0")}
            variant="ghost"
            size="icon-xs"
          >
            <Icon name="filter" size={14} />
          </Button>
        </Popover>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={onOpenNewTab}
                type="button"
                aria-label="Open New Git Log Tab"
                className={cn("h-6 min-w-5 px-1 aspect-square px-0")}
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
                  onClick={() => void onEnableIndexing(filters, order)}
                  type="button"
                  aria-label={indexingLabel}
                  disabled={indexing || powerSaveMode}
                  className={cn("h-6 min-w-5 px-1 aspect-square px-0")}
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
                className={cn("h-6 min-w-5 px-1 aspect-square px-0")}
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
                className={cn("h-6 min-w-5 px-1 aspect-square px-0")}
                variant="ghost"
                size="icon-xs"
              >
                <Icon name="cherry" size={14} />
              </Button>
            }
          />
          <TooltipContent>Cherry-Pick</TooltipContent>
        </Tooltip>
        <Tooltip>
          <Popover
            alignment="end"
            hasAutoFocus
            isOpen={viewOptionsOpen}
            label="View Options"
            onOpenChange={setViewOptionsOpen}
            placement="below"
            width={264}
            content={
              <div className={tw.logViewOptions}>
                <CheckboxInput isDisabled label="Root Names" size="sm" value={false} />
                <CheckboxInput
                  label="Compact References View"
                  onChange={setCompactReferences}
                  size="sm"
                  value={compactReferences}
                />
                <CheckboxInput
                  label="Tag Names"
                  onChange={setShowTagNames}
                  size="sm"
                  value={showTagNames}
                />
                <CheckboxInput
                  label="Long Edges"
                  onChange={setShowLongEdges}
                  size="sm"
                  value={showLongEdges}
                />
                <CheckboxInput
                  label="Commit Timestamp"
                  onChange={setPreferCommitDate}
                  size="sm"
                  value={preferCommitDate}
                />
                <CheckboxInput
                  label="References on the Left"
                  onChange={setReferencesOnLeft}
                  size="sm"
                  value={referencesOnLeft}
                />
                <strong>Columns</strong>
                <CheckboxInput
                  label="Author"
                  onChange={setShowAuthor}
                  size="sm"
                  value={showAuthor}
                />
                <CheckboxInput label="Date" onChange={setShowDate} size="sm" value={showDate} />
                <CheckboxInput
                  label="Commit Hash"
                  onChange={setShowHash}
                  size="sm"
                  value={showHash}
                />
              </div>
            }
          >
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  aria-label="View Options"
                  className={cn("h-6 min-w-5 px-1 aspect-square px-0")}
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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={() => searchInput.current?.focus()}
                type="button"
                aria-label="Go To Hash/Branch/Tag"
                className={cn("h-6 min-w-5 px-1 aspect-square px-0")}
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
          className={cn("h-7 px-2.5", tw.srOnly)}
          variant="outline"
          size="sm"
        >
          Import Patch
        </Button>
      </div>
      <div
        aria-colcount={4}
        aria-label="Git log"
        aria-rowcount={filtered.length}
        className={tw.commitScroller}
        onScroll={(event) => {
          const target = event.currentTarget;
          if (target.scrollHeight - target.scrollTop - target.clientHeight < 220) {
            void loadMore();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") navigateRow(1);
          else if (event.key === "ArrowUp") navigateRow(-1);
          else if (event.key === "ArrowRight") navigateCommit("parent");
          else if (event.key === "ArrowLeft") navigateCommit("child");
          else return;
          event.preventDefault();
        }}
        ref={parentRef}
        role="table"
        tabIndex={0}
      >
        <div className={tw.srOnly} role="row">
          <span role="columnheader">Graph</span>
          <span role="columnheader">Commit</span>
          <span role="columnheader">Author</span>
          <span role="columnheader">Date</span>
        </div>
        {filtered.length === 0 ? (
          <div className={tw.logEmpty} role="status">
            {loading
              ? "Searching commit history…"
              : error
                ? error
                : normalizedQuery || activeFilterCount > 0 || branch !== "all"
                  ? "No commits match these filters."
                  : "This repository has no commits yet."}
          </div>
        ) : (
          <div
            style={{
              height: filtered.length * LOG_ROW_HEIGHT + (loading || error ? LOG_ROW_HEIGHT : 0),
              position: "relative",
            }}
          >
            <div className={tw.graphCanvas}>
              <CommitGraph commits={filtered} width={34} showLongEdges={showLongEdges} />
            </div>
            {filtered.map((commit, index) => {
              const selected = selectedOids.includes(commit.oid);
              const toPush = toPushOids.has(commit.oid);
              const toPull =
                behind > 0 && upstreamRef !== null && commit.refs.includes(upstreamRef);
              const references = commit.refs.filter(
                (ref) => showTagNames || !ref.startsWith("tag: refs/tags/"),
              );
              const visibleReferences = compactReferences ? references.slice(0, 1) : references;
              const displayedTime = commitTime(
                preferCommitDate ? commit.committedAt : commit.authoredAt,
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
                  data-oid={commit.oid}
                  key={commit.oid}
                  onClick={(event) => select(event, commit)}
                  onContextMenu={(event) => onContextMenu(event, commit)}
                  role="row"
                  style={{
                    gridTemplateColumns: rowColumns,
                    transform: `translateY(${index * LOG_ROW_HEIGHT}px)`,
                  }}
                  type="button"
                  className={cn(
                    "grid min-h-0 text-xs whitespace-normal text-left aria-selected:bg-accent aria-current:bg-accent",
                    `${tw.commitRow} ${selected ? tw.selectedCommit : ""}`,
                  )}
                  variant="ghost"
                  size="default"
                >
                  <span
                    aria-hidden="true"
                    className="relative z-[3] justify-end gap-0.5 pr-1 text-[9px] font-semibold"
                  >
                    {toPush && (
                      <em
                        className="rounded bg-success/15 px-1 text-success"
                        title="Local-only commit to push"
                      >
                        ↑ push
                      </em>
                    )}
                    {toPull && (
                      <em
                        className="rounded bg-accent/15 px-1 text-primary"
                        title="Remote-only history to pull"
                      >
                        ↓ pull
                      </em>
                    )}
                  </span>
                  <span aria-label={commit.subject} className={tw.commitSubject} role="cell">
                    {referencesOnLeft && referenceBadges}
                    <span className={tw.ellipsis}>{commit.subject}</span>
                    {!referencesOnLeft && referenceBadges}
                    {showHash && <code>{commit.oid.slice(0, 7)}</code>}
                  </span>
                  <strong className={tw.ellipsis} hidden={!showAuthor} role="cell">
                    {commit.author}
                  </strong>
                  <span hidden={!showDate} role="cell">
                    {displayedTime}
                  </span>
                </Button>
              );
            })}
            {(loading || error) && (
              <div
                className={tw.logLoadMore}
                role={error ? "alert" : "status"}
                style={{
                  transform: `translateY(${filtered.length * LOG_ROW_HEIGHT}px)`,
                }}
              >
                {error ?? "Loading commits…"}
              </div>
            )}
          </div>
        )}
      </div>
      <div className={tw.logFooter}>
        <span>{loading ? "Loading…" : `${filtered.length.toLocaleString()} commits`}</span>
        {hasMore ? (
          <Button
            onClick={() => void loadMore()}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Load 500 more
          </Button>
        ) : (
          <span>{order === "firstParent" ? "First parent" : order} order</span>
        )}
      </div>
    </section>
  );
});
