import { useEffect, useMemo, useRef, useState } from "react";
import type { DiffPreferences } from "../domain/changeReview";
import { revisionDiffEntries } from "../domain/changeReview";
import type { FileContent, FileSource } from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { DiffViewer } from "./DiffViewer";
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
    <aside aria-label="Revision comparison" className={tw.revisionComparison}>
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
        <div className={tw.emptyState}>Loading revision comparison…</div>
      ) : error ? (
        <div className={tw.emptyState}>{error}</div>
      ) : entries.length === 0 ? (
        <div className={tw.emptyState}>These revisions have no file differences.</div>
      ) : (
        <div>
          <nav aria-label="Compared files">
            {entries.map((entry) => (
              <button
                aria-current={selected?.file.path === entry.file.path ? "true" : undefined}
                className={selected?.file.path === entry.file.path ? tw.selected : undefined}
                key={entry.file.path}
                onClick={() => setSelectedPath(entry.file.path)}
              >
                <span className={tw.statusBadge}>{entry.file.status.charAt(0).toUpperCase()}</span>
                <span className={tw.ellipsis}>{entry.file.path}</span>
              </button>
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
