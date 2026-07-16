import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useDeferredValue, useMemo, useRef, useState } from "react";
import type { Commit } from "../domain/types";
import { CommitGraph } from "./CommitGraph";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (seconds < 60) return "now";
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const CommitLog = memo(function CommitLog({
  commits,
  selectedOids,
  onSelectionChange,
  onContextMenu,
}: {
  readonly commits: readonly Commit[];
  readonly selectedOids: readonly string[];
  readonly onSelectionChange: (oids: readonly string[]) => void;
  readonly onContextMenu: (event: React.MouseEvent, commit: Commit) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("all");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const authors = useMemo(() => [...new Set(commits.map((commit) => commit.author))], [commits]);
  const filtered = useMemo(
    () =>
      commits.filter(
        (commit) =>
          (!deferredQuery ||
            commit.subject.toLowerCase().includes(deferredQuery) ||
            commit.oid.startsWith(deferredQuery)) &&
          (author === "all" || commit.author === author),
      ),
    [author, commits, deferredQuery],
  );
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 29,
    overscan: 18,
  });

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

  return (
    <section className={styles.logPane} aria-label="Commit log">
      <div className={styles.logFilters}>
        <label className={styles.logSearch}>
          <Icon name="search" size={14} />
          <input
            aria-label="Search commits"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Text or hash"
            value={query}
          />
          <kbd>⌘F</kbd>
        </label>
        <button className={styles.filterButton}>
          <Icon name="branch" size={13} />
          Branch: all
          <Icon name="chevron" size={11} />
        </button>
        <label className={styles.filterButton}>
          <span>User</span>
          <select
            aria-label="Filter by author"
            onChange={(event) => setAuthor(event.target.value)}
            value={author}
          >
            <option value="all">All</option>
            {authors.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <button className={styles.filterButton}>
          Date
          <Icon name="chevron" size={11} />
        </button>
        <button className={styles.filterButton}>
          Paths
          <Icon name="chevron" size={11} />
        </button>
        <span className={styles.filterSpacer} />
        <button className={styles.iconButton} title="Topology order">
          <Icon name="filter" size={14} />
        </button>
      </div>
      <div className={styles.logHeader}>
        <span>Author</span>
        <span>Date</span>
        <span>Graph</span>
        <span>Commit</span>
      </div>
      <div className={styles.commitScroller} ref={parentRef} tabIndex={0}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          <div className={styles.graphCanvas}>
            <CommitGraph commits={filtered} />
          </div>
          {virtualizer.getVirtualItems().map((item) => {
            const commit = filtered[item.index];
            if (!commit) return null;
            const selected = selectedOids.includes(commit.oid);
            return (
              <button
                aria-pressed={selected}
                className={`${styles.commitRow} ${selected ? styles.selectedCommit : ""}`}
                data-oid={commit.oid}
                key={commit.oid}
                onClick={(event) => select(event, commit)}
                onContextMenu={(event) => onContextMenu(event, commit)}
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <strong className={styles.ellipsis}>{commit.author}</strong>
                <span>{relativeTime(commit.authoredAt)}</span>
                <span />
                <span className={styles.commitSubject}>
                  {commit.refs.map((ref) => (
                    <em key={ref}>
                      {ref
                        .replace("HEAD -> refs/heads/", "")
                        .replace("refs/remotes/", "")
                        .replace("refs/heads/", "")
                        .replace("tag: refs/tags/", "")}
                    </em>
                  ))}
                  <span className={styles.ellipsis}>{commit.subject}</span>
                  <code>{commit.oid.slice(0, 7)}</code>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.logFooter}>
        <span>{filtered.length.toLocaleString()} commits</span>
        <span>Topology · 500 per page</span>
      </div>
    </section>
  );
});
