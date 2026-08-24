import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";
import type { GitConsoleEntry } from "../domain/gitConsole";
import { Icon } from "./Icon";
import { EmptyState } from "./ProductCollections";

function statusIcon(
  status: GitConsoleEntry["status"],
): Parameters<typeof Icon>[0]["name"] {
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
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const selected = useMemo(
    () =>
      entries.find((entry) => entry.requestId === selectedRequestId) ??
      entries.at(-1) ??
      null,
    [entries, selectedRequestId],
  );

  useEffect(() => {
    const latest = entries.at(-1);
    if (!latest) {
      setSelectedRequestId(null);
      return;
    }
    setSelectedRequestId((current) =>
      entries.some((entry) => entry.requestId === current)
        ? current
        : latest.requestId,
    );
  }, [entries]);

  return (
    <section
      className={`gitConsolePanel [display:grid] [grid-template-rows:31px_minmax(0,_1fr)] [height:100%] [min-height:0] [&>_header]:[align-items:center] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:5px] [&>_header]:[padding:0_6px] [&>_header_span]:[color:var(--muted-foreground)] [&>_header_i]:[flex:1] [&>_header_button]:[background:transparent] [&>_header_button]:[font-size:10px] [&>_header_button]:[height:24px] [&>_header_button]:[padding:0_6px] gitConsolePanel`}
      aria-label="Git Console"
      tabIndex={-1}
    >
      <header>
        <strong>Git Console</strong>
        <span>{entries.length} commands</span>
        <i />
        <Button
          disabled={entries.length === 0}
          onClick={() =>
            setExpanded(new Set(entries.map((entry) => entry.requestId)))
          }
          type="button"
          className={cn(
            "gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground",
          )}
          variant="ghost"
          size="default"
        >
          Expand All
        </Button>
        <Button
          disabled={expanded.size === 0}
          onClick={() => setExpanded(new Set())}
          type="button"
          className={cn(
            "gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground",
          )}
          variant="ghost"
          size="default"
        >
          Collapse All
        </Button>
        <Button
          disabled={!selected}
          onClick={() =>
            selected &&
            void navigator.clipboard.writeText(
              `${selected.command}\n${selected.output}`,
            )
          }
          type="button"
          className={cn(
            "gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground",
          )}
          variant="ghost"
          size="default"
        >
          Copy
        </Button>
        <Button
          disabled={entries.length === 0}
          onClick={onClear}
          type="button"
          className={cn(
            "gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground",
          )}
          variant="ghost"
          size="default"
        >
          Clear All
        </Button>
      </header>
      {entries.length === 0 ? (
        <EmptyState title="Git commands will be shown here." />
      ) : (
        <div
          className={`gitConsoleList [min-height:0] [overflow:auto] [&_article]:[border-bottom:1px_solid_var(--border)] [&_article[aria-selected=true]]:[background:var(--accent)] [&_article>_button]:[align-items:center] [&_article>_button]:[background:transparent] [&_article>_button]:[display:grid] [&_article>_button]:[gap:8px] [&_article>_button]:[grid-template-columns:16px_minmax(0,_1fr)_80px_62px] [&_article>_button]:[height:27px] [&_article>_button]:[padding:0_7px] [&_article>_button]:[text-align:left] [&_article>_button]:[width:100%] [&_article_code]:[overflow:hidden] [&_article_code]:[text-overflow:ellipsis] [&_article_code]:[white-space:nowrap] [&_article_small]:[color:var(--disabled-foreground)] [&_article_small]:[font-size:9px] [&_article_pre]:[background:var(--muted)] [&_article_pre]:[border-top:1px_solid_var(--border)] [&_article_pre]:[font-family:var(--font-family-code)] [&_article_pre]:[font-size:10px] [&_article_pre]:[margin:0] [&_article_pre]:[max-height:180px] [&_article_pre]:[overflow:auto] [&_article_pre]:[padding:7px_30px] [&_article_pre]:[white-space:pre-wrap] gitConsoleList`}
          role="listbox"
          aria-label="Git command history"
        >
          {entries.map((entry) => {
            const isExpanded = expanded.has(entry.requestId);
            const duration =
              entry.completedAt === null
                ? null
                : Math.max(0, entry.completedAt - entry.startedAt);
            return (
              <div
                aria-selected={selected?.requestId === entry.requestId}
                key={entry.requestId}
                role="option"
              >
                <Button
                  aria-expanded={isExpanded}
                  onClick={() => {
                    setSelectedRequestId(entry.requestId);
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(entry.requestId))
                        next.delete(entry.requestId);
                      else next.add(entry.requestId);
                      return next;
                    });
                  }}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  <Icon name={statusIcon(entry.status)} size={13} />
                  <code>{entry.command}</code>
                  <small>
                    {new Date(entry.startedAt).toLocaleTimeString()}
                  </small>
                  <small>
                    {duration === null ? "Running…" : `${duration} ms`}
                  </small>
                </Button>
                {isExpanded && (
                  <pre>
                    {entry.output ||
                      (entry.status === "running"
                        ? "Waiting for output…"
                        : "Process finished with no output.")}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
