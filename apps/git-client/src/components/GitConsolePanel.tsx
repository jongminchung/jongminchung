import { useEffect, useMemo, useState } from "react";
import type { GitConsoleEntry } from "../domain/gitConsole";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

function statusIcon(status: GitConsoleEntry["status"]): Parameters<typeof Icon>[0]["name"] {
  if (status === "completed") return "check";
  if (status === "failed") return "warning";
  if (status === "cancelled") return "close";
  return "refresh";
}

export function GitConsolePanel({
  entries,
  onClear,
}: {
  readonly entries: readonly GitConsoleEntry[];
  readonly onClear: () => void;
}) {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const selected = useMemo(
    () => entries.find((entry) => entry.requestId === selectedRequestId) ?? entries.at(-1) ?? null,
    [entries, selectedRequestId],
  );

  useEffect(() => {
    const latest = entries.at(-1);
    if (!latest) {
      setSelectedRequestId(null);
      return;
    }
    setSelectedRequestId((current) => entries.some((entry) => entry.requestId === current) ? current : latest.requestId);
  }, [entries]);

  return (
    <section className={tw.gitConsolePanel} aria-label="Git Console" tabIndex={-1}>
      <header>
        <strong>Git Console</strong>
        <span>{entries.length} commands</span>
        <i />
        <button disabled={entries.length === 0} onClick={() => setExpanded(new Set(entries.map((entry) => entry.requestId)))}>Expand All</button>
        <button disabled={expanded.size === 0} onClick={() => setExpanded(new Set())}>Collapse All</button>
        <button
          disabled={!selected}
          onClick={() => selected && void navigator.clipboard.writeText(`${selected.command}\n${selected.output}`)}
        >
          Copy
        </button>
        <button disabled={entries.length === 0} onClick={onClear}>Clear All</button>
      </header>
      {entries.length === 0 ? (
        <div className={tw.emptyState}>Git commands will be shown here.</div>
      ) : (
        <div className={tw.gitConsoleList} role="listbox" aria-label="Git command history">
          {entries.map((entry) => {
            const isExpanded = expanded.has(entry.requestId);
            const duration = entry.completedAt === null ? null : Math.max(0, entry.completedAt - entry.startedAt);
            return (
              <article aria-selected={selected?.requestId === entry.requestId} key={entry.requestId} role="option">
                <button
                  aria-expanded={isExpanded}
                  onClick={() => {
                    setSelectedRequestId(entry.requestId);
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(entry.requestId)) next.delete(entry.requestId);
                      else next.add(entry.requestId);
                      return next;
                    });
                  }}
                >
                  <Icon name={statusIcon(entry.status)} size={13} />
                  <code>{entry.command}</code>
                  <small>{new Date(entry.startedAt).toLocaleTimeString()}</small>
                  <small>{duration === null ? "Running…" : `${duration} ms`}</small>
                </button>
                {isExpanded && <pre>{entry.output || (entry.status === "running" ? "Waiting for output…" : "Process finished with no output.")}</pre>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
