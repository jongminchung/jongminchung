import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DiffPreferences } from "../domain/changeReview";
import { revisionDiffEntries } from "../domain/changeReview";
import type { FileContent, FileSource } from "../shared/contracts/model";
import { DiffViewer } from "./DiffViewer";
import { Notice } from "./Notice";
import { EmptyState, Spinner, StatusBadge } from "./ProductCollections";
import { VerticalResizeHandle } from "./VerticalResizeHandle";

export function RevisionComparison({
  from,
  to,
  patch,
  loading,
  preferences,
  onPreferencesChange,
  reviewWidth,
  onReviewWidthChange,
  readFile,
}: {
  readonly from: string;
  readonly to: string;
  readonly patch: string;
  readonly loading: boolean;
  readonly preferences: DiffPreferences;
  readonly onPreferencesChange: (preferences: DiffPreferences) => void;
  readonly reviewWidth: number;
  readonly onReviewWidthChange: (width: number) => void;
  readonly readFile: (source: FileSource, path: string) => Promise<FileContent>;
}) {
  const entries = useMemo(() => revisionDiffEntries(patch), [patch]);
  const error = patch.startsWith("Unable to compare revisions:") ? patch : null;
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<{
    readonly before: FileContent | null;
    readonly after: FileContent | null;
    readonly loading: boolean;
  }>({ before: null, after: null, loading: false });
  const generation = useRef(0);
  const selected = entries.find((entry) => entry.file.path === selectedPath) ?? entries[0] ?? null;
  const selectedIndex = selected ? entries.indexOf(selected) : -1;

  useEffect(() => {
    setSelectedPath((current) =>
      current && entries.some((entry) => entry.file.path === current)
        ? current
        : (entries[0]?.file.path ?? null),
    );
  }, [entries]);

  useEffect(() => {
    if (!selected) {
      setContent({ before: null, after: null, loading: false });
      return;
    }
    const current = generation.current + 1;
    generation.current = current;
    setContent((value) => ({ ...value, loading: true }));
    void Promise.all([
      readFile({ kind: "revision", revision: from }, selected.file.oldPath ?? selected.file.path),
      readFile({ kind: "revision", revision: to }, selected.file.path),
    ]).then(
      ([before, after]) => {
        if (generation.current === current) setContent({ before, after, loading: false });
      },
      () => {
        if (generation.current === current)
          setContent({ before: null, after: null, loading: false });
      },
    );
    return () => {
      if (generation.current === current) generation.current += 1;
    };
  }, [from, readFile, selected, to]);

  const move = (offset: number): void => {
    const next = entries[Math.min(entries.length - 1, Math.max(0, selectedIndex + offset))];
    if (next) setSelectedPath(next.file.path);
  };

  return (
    <aside
      aria-label="Revision comparison"
      className={`revisionComparison [border-left:1px_solid_var(--border)] [display:grid] [grid-template-rows:36px_minmax(0,_1fr)] [min-height:0] [min-width:0] [position:relative] [&>_.verticalResizeHandle]:[left:-4px] [&>_.verticalResizeHandle]:[right:auto] [&>_header]:[align-items:center] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:7px] [&>_header]:[padding:0_9px] [&>_header_strong]:[margin-right:auto] [&>_header_code]:[color:var(--muted-foreground)] [&>_header_code]:[font-size:11px] [&>_[data-revision-content]]:[display:grid] [&>_[data-revision-content]]:[grid-template-columns:minmax(155px,_195px)_minmax(0,_1fr)] [&>_[data-revision-content]]:[min-height:0] [&_nav]:[border-right:1px_solid_var(--border)] [&_nav]:[min-height:0] [&_nav]:[overflow:auto] [&_nav]:[padding:4px] [&_nav_button]:[align-items:center] [&_nav_button]:[background:transparent] [&_nav_button]:[display:flex] [&_nav_button]:[gap:6px] [&_nav_button]:[min-height:28px] [&_nav_button]:[padding:3px_6px] [&_nav_button]:[text-align:left] [&_nav_button]:[width:100%] [&_nav_button.selected]:[background:var(--accent)] [&_nav_button[aria-current=true]]:[background:var(--accent)] revisionComparison`}
    >
      <VerticalResizeHandle
        direction={-1}
        label="Resize revision comparison"
        onChange={onReviewWidthChange}
        value={reviewWidth}
      />
      <header>
        <strong>Compare revisions</strong>
        <code>{from.slice(0, 8)}</code>
        <span>→</span>
        <code>{to.slice(0, 8)}</code>
      </header>
      {loading ? (
        <Spinner className="h-full w-full justify-center" label="Loading revision comparison…" />
      ) : error ? (
        <Notice className="m-auto w-auto" role="alert" size="sm" tone="destructive">
          {error}
        </Notice>
      ) : entries.length === 0 ? (
        <EmptyState title="These revisions have no file differences." />
      ) : (
        <div data-revision-content>
          <nav aria-label="Compared files">
            {entries.map((entry) => (
              <Button
                aria-current={selected?.file.path === entry.file.path ? "true" : undefined}
                key={entry.file.path}
                onClick={() => setSelectedPath(entry.file.path)}
                type="button"
                className={cn(
                  "h-7 px-2.5",
                  selected?.file.path === entry.file.path
                    ? `selected [background:var(--accent)] [color:var(--foreground)] selected`
                    : undefined,
                )}
                variant="outline"
                size="sm"
              >
                <StatusBadge>{entry.file.status.charAt(0).toUpperCase()}</StatusBadge>
                <span
                  className={`ellipsis [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap] ellipsis`}
                >
                  {entry.file.path}
                </span>
              </Button>
            ))}
          </nav>
          <DiffViewer
            afterContent={content.after}
            beforeContent={content.before}
            file={selected?.file ?? null}
            loading={content.loading}
            mode="readOnly"
            onNextFile={
              selectedIndex >= 0 && selectedIndex < entries.length - 1 ? () => move(1) : undefined
            }
            onPreferencesChange={onPreferencesChange}
            onPreviousFile={selectedIndex > 0 ? () => move(-1) : undefined}
            patch={selected?.patch ?? ""}
            preferences={preferences}
            sourceLabel={`${from.slice(0, 8)} → ${to.slice(0, 8)}`}
          />
        </div>
      )}
    </aside>
  );
}
