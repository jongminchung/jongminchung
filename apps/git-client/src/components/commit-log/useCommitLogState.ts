import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Commit } from "../../domain/types";
import type { LogFilters, LogOrder } from "../../shared/contracts/model/index";
import type {
    CommitLogFilterState,
    CommitLogViewOptions,
} from "./commitLogTypes";

const INITIAL_FILTERS: CommitLogFilterState = {
    query: "",
    regex: false,
    matchCase: false,
    author: "all",
    branch: "all",
    since: "all",
    path: "",
    order: "topology",
};

const INITIAL_VIEW_OPTIONS: CommitLogViewOptions = {
    showAuthor: true,
    showDate: true,
    showHash: false,
    showTagNames: true,
    compactReferences: false,
    showLongEdges: true,
    referencesOnLeft: false,
    preferCommitDate: false,
};

export function useCommitLogState({
    ahead,
    commits,
    hasMore,
    loading,
    onLoad,
    upstream,
}: {
    readonly ahead: number;
    readonly commits: readonly Commit[];
    readonly hasMore: boolean;
    readonly loading: boolean;
    readonly onLoad: (
        filters: LogFilters,
        order: LogOrder,
        append: boolean,
    ) => Promise<void>;
    readonly upstream?: string;
}) {
    const [filterState, setFilterState] = useState(INITIAL_FILTERS);
    const [viewOptions, setViewOptions] = useState(INITIAL_VIEW_OPTIONS);
    const firstLoad = useRef(true);
    const loadingMore = useRef(false);
    const normalizedQuery = filterState.query.trim();
    const queryPattern = useMemo<RegExp | null>(() => {
        if (!filterState.regex || normalizedQuery.length === 0) return null;
        try {
            return new RegExp(
                normalizedQuery,
                filterState.matchCase ? "" : "i",
            );
        } catch {
            return null;
        }
    }, [filterState.matchCase, filterState.regex, normalizedQuery]);
    const authors = useMemo(
        () => [...new Set(commits.map((commit) => commit.author))],
        [commits],
    );
    const filtered = useMemo(
        () =>
            commits.filter(
                (commit) =>
                    (normalizedQuery.length === 0 ||
                        (filterState.regex
                            ? queryPattern?.test(
                                  `${commit.subject}\n${commit.oid}`,
                              ) === true
                            : (filterState.matchCase
                                  ? commit.subject
                                  : commit.subject.toLowerCase()
                              ).includes(
                                  filterState.matchCase
                                      ? normalizedQuery
                                      : normalizedQuery.toLowerCase(),
                              ) ||
                              (filterState.matchCase
                                  ? commit.oid
                                  : commit.oid.toLowerCase()
                              ).startsWith(
                                  filterState.matchCase
                                      ? normalizedQuery
                                      : normalizedQuery.toLowerCase(),
                              ))) &&
                    (filterState.author === "all" ||
                        commit.author === filterState.author),
            ),
        [
            commits,
            filterState.author,
            filterState.matchCase,
            filterState.regex,
            normalizedQuery,
            queryPattern,
        ],
    );
    const filters = useMemo<LogFilters>(
        () => ({
            query: normalizedQuery || null,
            branch: filterState.branch === "all" ? null : filterState.branch,
            author: filterState.author === "all" ? null : filterState.author,
            since: filterState.since === "all" ? null : filterState.since,
            until: null,
            paths: filterState.path.trim() ? [filterState.path.trim()] : [],
            noMerges: false,
            regex: filterState.regex,
            matchCase: filterState.matchCase,
        }),
        [filterState, normalizedQuery],
    );
    const activeFilterCount =
        Number(Boolean(normalizedQuery)) +
        Number(filterState.branch !== "all") +
        Number(filterState.author !== "all") +
        Number(filterState.since !== "all") +
        Number(Boolean(filterState.path.trim()));
    const toPushOids = useMemo(
        () =>
            new Set(
                commits
                    .slice(0, Math.max(0, ahead))
                    .map((commit) => commit.oid),
            ),
        [ahead, commits],
    );

    useEffect(() => {
        if (firstLoad.current) {
            firstLoad.current = false;
            return;
        }
        const timeout = window.setTimeout(() => {
            void onLoad(filters, filterState.order, false);
        }, 250);
        return () => window.clearTimeout(timeout);
    }, [filterState.order, filters, onLoad]);

    const loadMore = useCallback(async (): Promise<void> => {
        if (!hasMore || loading || loadingMore.current) return;
        loadingMore.current = true;
        try {
            await onLoad(filters, filterState.order, true);
        } finally {
            loadingMore.current = false;
        }
    }, [filterState.order, filters, hasMore, loading, onLoad]);

    const setFilter = useCallback(
        <Key extends keyof CommitLogFilterState>(
            key: Key,
            value: CommitLogFilterState[Key],
        ): void => {
            setFilterState((current) => ({ ...current, [key]: value }));
        },
        [],
    );
    const setViewOption = useCallback(
        <Key extends keyof CommitLogViewOptions>(
            key: Key,
            value: CommitLogViewOptions[Key],
        ): void => {
            setViewOptions((current) => ({ ...current, [key]: value }));
        },
        [],
    );
    const resetFilters = useCallback(
        (): void => setFilterState(INITIAL_FILTERS),
        [],
    );

    return {
        activeFilterCount,
        authors,
        filterState,
        filtered,
        filters,
        loadMore,
        normalizedQuery,
        resetFilters,
        setFilter,
        setViewOption,
        toPushOids,
        upstreamRef: upstream ? `refs/remotes/${upstream}` : null,
        viewOptions,
    };
}
