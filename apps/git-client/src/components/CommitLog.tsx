import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { memo } from "react";
import type { MouseEvent } from "react";
import type { Commit, Ref } from "../domain/types";
import type { LogFilters, LogOrder } from "../shared/contracts/model/index";
import { CommitLogTable, LOG_ROW_HEIGHT } from "./commit-log/CommitLogTable";
import { CommitLogToolbar } from "./commit-log/CommitLogToolbar";
import { useCommitLogNavigation } from "./commit-log/useCommitLogNavigation";
import { useCommitLogState } from "./commit-log/useCommitLogState";

const LOG_FILTER_ROW_HEIGHT = 35;

export interface CommitLogProps {
  readonly commits: readonly Commit[];
  readonly selectedOids: readonly string[];
  readonly onSelectionChange: (oids: readonly string[]) => void;
  readonly onContextMenu: (event: MouseEvent, commit: Commit) => void;
  readonly refs: readonly Ref[];
  readonly hasMore: boolean;
  readonly onLoad: (
    filters: LogFilters,
    order: LogOrder,
    append: boolean,
  ) => Promise<void>;
  readonly onImportPatch: () => void;
  readonly onRefresh: () => void;
  readonly onOpenNewTab: () => void;
  readonly onEnableIndexing: (
    filters: LogFilters,
    order: LogOrder,
  ) => Promise<void>;
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
}: CommitLogProps) {
  const state = useCommitLogState({
    ahead,
    commits,
    hasMore,
    loading,
    onLoad,
    upstream,
  });
  const navigation = useCommitLogNavigation({
    commits,
    filtered: state.filtered,
    normalizedQuery: state.normalizedQuery,
    onSelectionChange,
    selectedOids,
  });

  return (
    <section
      className={`logPane [background:var(--card)] [min-height:0] [min-width:0] [display:grid] [grid-template-rows:35px_minmax(0,_1fr)_0] logPane`}
      aria-busy={loading}
      aria-label="Commit log"
      data-filter-row-height={LOG_FILTER_ROW_HEIGHT}
      data-log-row-height={LOG_ROW_HEIGHT}
      style={{
        gridTemplateRows: `${LOG_FILTER_ROW_HEIGHT}px minmax(0, 1fr) 0`,
      }}
    >
      <CommitLogToolbar
        activeFilterCount={state.activeFilterCount}
        authors={state.authors}
        canCherryPick={canCherryPick}
        filterState={state.filterState}
        filters={state.filters}
        indexing={indexing}
        indexingEnabled={indexingEnabled}
        onCherryPick={onCherryPick}
        onEnableIndexing={onEnableIndexing}
        onFilterChange={state.setFilter}
        onImportPatch={onImportPatch}
        onOpenNewTab={onOpenNewTab}
        onRefresh={onRefresh}
        onResetFilters={state.resetFilters}
        onViewOptionChange={state.setViewOption}
        powerSaveMode={powerSaveMode}
        refs={refs}
        searchInputRef={navigation.searchInputRef}
        selectedOids={selectedOids}
        viewOptions={state.viewOptions}
      />
      <CommitLogTable
        activeFilterCount={state.activeFilterCount}
        behind={behind}
        branch={state.filterState.branch}
        error={error}
        filtered={state.filtered}
        loadMore={state.loadMore}
        loading={loading}
        normalizedQuery={state.normalizedQuery}
        onContextMenu={onContextMenu}
        onKeyDown={navigation.onKeyDown}
        onSelect={navigation.select}
        relativeTimeBaseSeconds={relativeTimeBaseSeconds}
        selectedOids={selectedOids}
        tableRef={navigation.tableRef}
        toPushOids={state.toPushOids}
        upstreamRef={state.upstreamRef}
        viewOptions={state.viewOptions}
      />
      <div className={`logFooter [display:none] logFooter`}>
        <span>
          {loading
            ? "Loading…"
            : `${state.filtered.length.toLocaleString()} commits`}
        </span>
        {hasMore ? (
          <Button
            onClick={() => void state.loadMore()}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Load 500 more
          </Button>
        ) : (
          <span>
            {state.filterState.order === "firstParent"
              ? "First parent"
              : state.filterState.order}{" "}
            order
          </span>
        )}
      </div>
    </section>
  );
});
