import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { DiffPreferences } from "../domain/changeReview";
import { assembleHunkPatch, assembleSelectedLinePatch, parseDiffDocument } from "../domain/parsers";
import type { FileChange } from "../domain/types";
import type {
  FileContent,
  FilePreview,
  ImagePreview,
  SubmoduleDiff,
} from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import type { SelectableDiffLine } from "./CodeMirrorDiff";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { Popover } from "./ui";

const CodeMirrorDiff = lazy(() => import("./CodeMirrorDiff"));

export type DiffActionMode = "readOnly" | "stage" | "unstage";

interface DiffViewerProps {
  readonly file: FileChange | null;
  readonly patch: string;
  readonly loading: boolean;
  readonly beforePreview?: FilePreview | null;
  readonly afterPreview?: FilePreview | null;
  readonly beforeContent?: FileContent | null;
  readonly afterContent?: FileContent | null;
  readonly submoduleDiff?: SubmoduleDiff | null;
  readonly mode: DiffActionMode;
  readonly sourceLabel: string;
  readonly preferences: DiffPreferences;
  readonly onPreferencesChange: (preferences: DiffPreferences) => void;
  readonly onApplyPatch?: (patch: string, cached: boolean, reverse: boolean) => Promise<void>;
  readonly onFileAction?: () => Promise<void>;
  readonly onOpenExternally?: () => Promise<void>;
  readonly onPreviousFile?: () => void;
  readonly onNextFile?: () => void;
  readonly onToggleFocus?: () => void;
  readonly focused?: boolean;
}

type ImageDiffMode = "sideBySide" | "swipe" | "onion";

function imageFrom(preview: FilePreview | null | undefined): ImagePreview | null {
  return preview?.kind === "image" ? preview.preview : null;
}

function previewDescription(preview: FilePreview | null | undefined): string {
  if (!preview || preview.kind === "missing") return "File does not exist";
  if (preview.kind === "tooLarge")
    return `${preview.sizeBytes.toLocaleString()} bytes · preview limit exceeded`;
  if (preview.kind === "binary") return `${preview.sizeBytes.toLocaleString()} bytes · binary`;
  return `${preview.preview.mimeType} · ${preview.preview.sizeBytes.toLocaleString()} bytes`;
}

function ImageDiff({
  beforePreview,
  afterPreview,
}: {
  readonly beforePreview: FilePreview | null | undefined;
  readonly afterPreview: FilePreview | null | undefined;
}) {
  const [mode, setMode] = useState<ImageDiffMode>("sideBySide");
  const [mix, setMix] = useState(50);
  const before = imageFrom(beforePreview);
  const after = imageFrom(afterPreview);

  return (
    <div className={tw.imageDiff}>
      <div className={tw.imageDiffToolbar}>
        <div role="group" aria-label="Image comparison mode">
          <button
            className={mode === "sideBySide" ? tw.activeButton : undefined}
            onClick={() => setMode("sideBySide")}
          >
            Side by side
          </button>
          <button
            disabled={!before || !after}
            className={mode === "swipe" ? tw.activeButton : undefined}
            onClick={() => setMode("swipe")}
          >
            Swipe
          </button>
          <button
            disabled={!before || !after}
            className={mode === "onion" ? tw.activeButton : undefined}
            onClick={() => setMode("onion")}
          >
            Onion skin
          </button>
        </div>
        {mode !== "sideBySide" && before && after && (
          <label>
            {mode === "swipe" ? "Reveal" : "After opacity"}
            <input
              aria-label={mode === "swipe" ? "Image reveal" : "After image opacity"}
              min="0"
              max="100"
              onChange={(event) => setMix(Number(event.target.value))}
              type="range"
              value={mix}
            />
            <small>{mix}%</small>
          </label>
        )}
      </div>
      {mode === "sideBySide" || !before || !after ? (
        <div className={tw.imageDiffPair}>
          <figure>
            <figcaption>Before · {previewDescription(beforePreview)}</figcaption>
            {before ? <img alt="Before revision" src={before.dataUrl} /> : <div>Not available</div>}
          </figure>
          <figure>
            <figcaption>After · {previewDescription(afterPreview)}</figcaption>
            {after ? <img alt="After revision" src={after.dataUrl} /> : <div>Not available</div>}
          </figure>
        </div>
      ) : (
        <figure className={tw.imageDiffOverlay}>
          <figcaption>Before / After</figcaption>
          <div>
            <img alt="Before revision" src={before.dataUrl} />
            <img
              alt="After revision"
              src={after.dataUrl}
              style={
                mode === "swipe"
                  ? { clipPath: `inset(0 ${100 - mix}% 0 0)` }
                  : { opacity: mix / 100 }
              }
            />
          </div>
        </figure>
      )}
    </div>
  );
}

function textContent(content: FileContent | null | undefined): string | null {
  if (content?.kind === "text") return content.content;
  if (content?.kind === "missing") return "";
  return null;
}

function contentDescription(content: FileContent | null | undefined): string | null {
  if (!content || content.kind === "text" || content.kind === "missing") return null;
  if (content.kind === "tooLarge") {
    const lines =
      content.lineCount === null
        ? "line count unavailable"
        : `${content.lineCount.toLocaleString()} lines`;
    return `${content.sizeBytes.toLocaleString()} bytes · ${lines} · preview limit exceeded`;
  }
  if (content.kind === "invalidUtf8")
    return `${content.sizeBytes.toLocaleString()} bytes · invalid UTF-8`;
  return `${content.sizeBytes.toLocaleString()} bytes · binary`;
}

export function DiffViewer({
  file,
  patch,
  loading,
  beforePreview,
  afterPreview,
  beforeContent,
  afterContent,
  submoduleDiff,
  mode,
  sourceLabel,
  preferences,
  onPreferencesChange,
  onApplyPatch,
  onFileAction,
  onOpenExternally,
  onPreviousFile,
  onNextFile,
  onToggleFocus,
  focused = false,
}: DiffViewerProps) {
  const root = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [hunkIndex, setHunkIndex] = useState(0);
  const [selectedLines, setSelectedLines] = useState<ReadonlySet<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [statistics, setStatistics] = useState({ differences: 0, matches: 0 });
  const [searchNavigation, setSearchNavigation] = useState({ sequence: 0, direction: 1 as -1 | 1 });
  const [differenceNavigation, setDifferenceNavigation] = useState({
    sequence: 0,
    direction: 1 as -1 | 1,
  });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const dialog = useAppDialog();
  const document = useMemo(() => parseDiffDocument(patch), [patch]);
  const hunk = document.hunks[hunkIndex] ?? null;
  const selectableLines = useMemo<readonly SelectableDiffLine[]>(() => {
    if (!hunk || mode === "readOnly") return [];
    const range = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(hunk.header);
    if (!range) return [];
    let oldLine = Number(range[1]);
    let newLine = Number(range[2]);
    const actions: SelectableDiffLine[] = [];
    hunk.lines.forEach((line, patchLineIndex) => {
      const prefix = line.charAt(0);
      if (prefix === "-") {
        actions.push({
          side: "before",
          lineNumber: oldLine,
          unifiedLineNumber: Math.max(1, newLine),
          patchLineIndex,
          selected: selectedLines.has(patchLineIndex),
        });
      } else if (prefix === "+") {
        actions.push({
          side: "after",
          lineNumber: newLine,
          unifiedLineNumber: Math.max(1, newLine),
          patchLineIndex,
          selected: selectedLines.has(patchLineIndex),
        });
      }
      if (prefix !== "+" && prefix !== "\\") oldLine += 1;
      if (prefix !== "-" && prefix !== "\\") newLine += 1;
    });
    return actions;
  }, [hunk, mode, selectedLines]);
  const toggleSelectedLine = useCallback((patchLineIndexes: readonly number[]): void => {
    setSelectedLines((current) => {
      const next = new Set(current);
      const shouldSelect = patchLineIndexes.some((patchLineIndex) => !next.has(patchLineIndex));
      for (const patchLineIndex of patchLineIndexes) {
        if (shouldSelect) next.add(patchLineIndex);
        else next.delete(patchLineIndex);
      }
      return next;
    });
  }, []);
  const split =
    preferences.viewMode === "split" || (preferences.viewMode === "auto" && availableWidth >= 720);
  const beforeText = textContent(beforeContent);
  const afterText = textContent(afterContent);
  const contentUnavailable = contentDescription(afterContent) ?? contentDescription(beforeContent);
  const unsupportedReason = !file
    ? null
    : file.submodule
      ? "Submodule pointer change"
      : file.binary
        ? "Binary file"
        : file.utf8 === false
          ? "Not valid UTF-8"
          : (file.sizeBytes ?? 0) > 5 * 1024 * 1024
            ? "File exceeds 5 MiB"
            : (file.lineCount ?? 0) > 50_000
              ? "File exceeds 50,000 lines"
              : contentUnavailable;
  const hasImagePreview = imageFrom(beforePreview) !== null || imageFrom(afterPreview) !== null;
  const matchCount = statistics.matches;
  const updateStatistics = useCallback(
    (next: { readonly differences: number; readonly matches: number }): void => setStatistics(next),
    [],
  );

  useEffect(() => {
    setHunkIndex(0);
    setSelectedLines(new Set());
    setSearchQuery("");
    setSearchMatchIndex(0);
    setStatistics({ differences: 0, matches: 0 });
    setSearchNavigation({ sequence: 0, direction: 1 });
    setDifferenceNavigation({ sequence: 0, direction: 1 });
  }, [file?.path, mode, patch]);

  useEffect(() => setSelectedLines(new Set()), [hunkIndex]);

  useEffect(() => {
    const find = (event: Event): void => {
      if (!(event instanceof CustomEvent) || !searchQuery || matchCount === 0) return;
      const ownsSearch =
        searchInput.current === window.document.activeElement ||
        root.current?.contains(window.document.activeElement);
      if (!ownsSearch) return;
      const direction = event.detail?.direction === -1 ? -1 : 1;
      setSearchMatchIndex((current) => (current + direction + matchCount) % matchCount);
      setSearchNavigation((current) => ({ sequence: current.sequence + 1, direction }));
    };
    window.addEventListener("git-client:find", find);
    return () => window.removeEventListener("git-client:find", find);
  }, [matchCount, searchQuery]);

  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  const moveHunk = (offset: number): void => {
    if (document.hunks.length === 0) return;
    setHunkIndex((current) => Math.min(document.hunks.length - 1, Math.max(0, current + offset)));
    setDifferenceNavigation((current) => ({
      sequence: current.sequence + 1,
      direction: offset < 0 ? -1 : 1,
    }));
  };

  const handleKeyboard = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const target = event.target;
    const editing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "f") {
      event.preventDefault();
      searchInput.current?.focus();
      return;
    }
    if (editing) return;
    if (event.altKey && event.key === "ArrowUp") moveHunk(-1);
    else if (event.altKey && event.key === "ArrowDown") moveHunk(1);
    else if (!event.altKey && event.key === "ArrowUp") onPreviousFile?.();
    else if (!event.altKey && event.key === "ArrowDown") onNextFile?.();
    else if (event.key === " ") onToggleFocus?.();
    else return;
    event.preventDefault();
  };

  const applyHunk = async (cached: boolean, reverse: boolean): Promise<void> => {
    if (hunk === null || !onApplyPatch) return;
    await onApplyPatch(assembleHunkPatch(document.fileHeader, [hunk]), cached, reverse);
  };

  const applySelectedLines = async (): Promise<void> => {
    if (hunk === null || selectedLines.size === 0 || !onApplyPatch) return;
    await onApplyPatch(
      assembleSelectedLinePatch(document.fileHeader, hunk, selectedLines),
      true,
      mode === "unstage",
    );
  };

  const discardHunk = async (): Promise<void> => {
    if (hunk === null || !onApplyPatch) return;
    const accepted = await dialog.confirm({
      title: "Discard this hunk?",
      description:
        "This reverses the selected working-tree hunk and cannot be undone by Git Client.",
      impact: hunk.header,
      confirmLabel: "Discard hunk",
      dangerous: true,
    });
    if (!accepted) return;
    await applyHunk(false, true);
  };

  return (
    <section
      aria-label={file ? `Diff for ${file.path}` : "Diff preview"}
      className={`${tw.diffViewer} ${focused ? tw.focusedDiffViewer : ""}`}
      data-diff-viewer
      onKeyDown={handleKeyboard}
      ref={root}
      tabIndex={0}
    >
      <header className={tw.diffViewerHeader}>
        <button
          aria-label="Previous changed file"
          className={tw.iconButton}
          disabled={!onPreviousFile}
          onClick={onPreviousFile}
          title="Previous file · ↑"
        >
          ↑
        </button>
        <button
          aria-label="Next changed file"
          className={tw.iconButton}
          disabled={!onNextFile}
          onClick={onNextFile}
          title="Next file · ↓"
        >
          ↓
        </button>
        {file ? (
          <>
            <span className={tw.statusBadge}>{file.status.charAt(0).toUpperCase()}</span>
            <strong className={tw.ellipsis}>{file.path}</strong>
            <small>{sourceLabel}</small>
          </>
        ) : (
          <strong>Select a changed file</strong>
        )}
        <span />
        <label className={tw.diffSearch}>
          <Icon name="search" size={13} />
          <input
            aria-label="Search diff"
            data-command-search="diff"
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchMatchIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || matchCount === 0) return;
              const direction = event.shiftKey ? -1 : 1;
              setSearchMatchIndex((current) => (current + direction + matchCount) % matchCount);
              setSearchNavigation((current) => ({ sequence: current.sequence + 1, direction }));
              event.preventDefault();
            }}
            placeholder="Find"
            ref={searchInput}
            value={searchQuery}
          />
          {searchQuery && (
            <small>{matchCount > 0 ? `${searchMatchIndex + 1}/${matchCount}` : "0"}</small>
          )}
        </label>
        {onToggleFocus && (
          <button
            aria-label={focused ? "Exit focused diff" : "Focus diff"}
            className={tw.iconButton}
            onClick={onToggleFocus}
            title="Focus diff · Space"
          >
            <Icon name="external" size={13} />
          </button>
        )}
      </header>
      <div className={tw.diffViewerToolbar}>
        <label>
          View
          <select
            aria-label="Diff view mode"
            onChange={(event) =>
              onPreferencesChange({
                ...preferences,
                viewMode:
                  event.target.value === "split" || event.target.value === "unified"
                    ? event.target.value
                    : "auto",
              })
            }
            value={preferences.viewMode}
          >
            <option value="auto">Auto</option>
            <option value="split">Split</option>
            <option value="unified">Unified</option>
          </select>
        </label>
        <button
          aria-label="Previous difference"
          disabled={statistics.differences === 0}
          onClick={() => moveHunk(-1)}
          title="Previous difference · ⌥↑"
        >
          ↑ Difference
        </button>
        <button
          aria-label="Next difference"
          disabled={statistics.differences === 0}
          onClick={() => moveHunk(1)}
          title="Next difference · ⌥↓"
        >
          ↓ Difference
        </button>
        <small>{statistics.differences} differences</small>
        <Popover
          alignment="end"
          hasAutoFocus
          isOpen={optionsOpen}
          label="Diff options"
          onOpenChange={setOptionsOpen}
          placement="below"
          width={240}
          content={
            <div className="grid gap-2 p-1">
              <label>
                Context
                <select
                  aria-label="Diff context lines"
                  onChange={(event) => {
                    const value = event.target.value;
                    onPreferencesChange({
                      ...preferences,
                      contextLines:
                        value === "full" ? "full" : value === "5" ? 5 : value === "10" ? 10 : 3,
                    });
                  }}
                  value={String(preferences.contextLines)}
                >
                  <option value="3">3 lines</option>
                  <option value="5">5 lines</option>
                  <option value="10">10 lines</option>
                  <option value="full">Entire file</option>
                </select>
              </label>
              <label>
                <input
                  checked={preferences.whitespace === "ignoreAll"}
                  onChange={(event) =>
                    onPreferencesChange({
                      ...preferences,
                      whitespace: event.target.checked ? "ignoreAll" : "show",
                    })
                  }
                  type="checkbox"
                />
                Ignore whitespace
              </label>
              <label>
                <input
                  checked={preferences.wordWrap}
                  onChange={(event) =>
                    onPreferencesChange({ ...preferences, wordWrap: event.target.checked })
                  }
                  type="checkbox"
                />
                Wrap
              </label>
              <label>
                <input
                  checked={preferences.collapseUnchanged}
                  onChange={(event) =>
                    onPreferencesChange({ ...preferences, collapseUnchanged: event.target.checked })
                  }
                  type="checkbox"
                />
                Fold unchanged
              </label>
              {split && (
                <label>
                  <input
                    checked={preferences.synchronizedScroll}
                    onChange={(event) =>
                      onPreferencesChange({
                        ...preferences,
                        synchronizedScroll: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  Sync scroll
                </label>
              )}
            </div>
          }
        >
          <Button label="Diff options" size="sm" variant="secondary" />
        </Popover>
        <span />
        {mode !== "readOnly" && (
          <>
            <select
              aria-label="Selected hunk"
              disabled={document.hunks.length === 0}
              onChange={(event) => setHunkIndex(Number(event.target.value))}
              value={Math.min(hunkIndex, Math.max(0, document.hunks.length - 1))}
            >
              {document.hunks.map((item, index) => (
                <option key={`${item.header}-${index}`} value={index}>
                  Hunk {index + 1}
                </option>
              ))}
            </select>
            {hunk && (
              <code className="max-w-56 truncate text-[10px] text-secondary" title={hunk.header}>
                {hunk.header}
              </code>
            )}
            <button
              disabled={!onFileAction}
              onClick={() => void onFileAction?.()}
              title="Stage or unstage · ⌘S"
            >
              {mode === "stage" ? "Stage file" : "Unstage file"}
            </button>
            <button
              disabled={hunk === null || !onApplyPatch}
              onClick={() => void applyHunk(true, mode === "unstage")}
            >
              {mode === "stage" ? "Stage hunk" : "Unstage hunk"}
            </button>
            <button
              disabled={hunk === null || selectedLines.size === 0 || !onApplyPatch}
              onClick={() => void applySelectedLines()}
            >
              {mode === "stage" ? "Stage lines" : "Unstage lines"}
            </button>
            {mode === "stage" && (
              <button disabled={hunk === null || !onApplyPatch} onClick={() => void discardHunk()}>
                Discard hunk
              </button>
            )}
          </>
        )}
      </div>
      <div
        aria-label={file ? `Diff content for ${file.path}` : "Diff content"}
        className={tw.diffViewerContent}
        role="region"
        tabIndex={0}
      >
        {loading ? (
          <div className={tw.emptyState}>Loading diff…</div>
        ) : file === null ? (
          <div className={tw.emptyState}>Select a changed file to review its diff.</div>
        ) : file.binary && hasImagePreview ? (
          <ImageDiff afterPreview={afterPreview} beforePreview={beforePreview} />
        ) : file.submodule && submoduleDiff ? (
          <div className={tw.submoduleDiff}>
            <Icon name="worktree" size={24} />
            <strong>Submodule pointer change</strong>
            <div>
              <section>
                <small>Before</small>
                <code>{submoduleDiff.beforeOid ?? "Not present"}</code>
                {submoduleDiff.beforeSubject && <span>{submoduleDiff.beforeSubject}</span>}
              </section>
              <Icon name="chevron" size={14} />
              <section>
                <small>After</small>
                <code>{submoduleDiff.afterOid ?? "Not present"}</code>
                {submoduleDiff.afterSubject && <span>{submoduleDiff.afterSubject}</span>}
              </section>
            </div>
            {submoduleDiff.ahead !== null && submoduleDiff.behind !== null ? (
              <p>
                {submoduleDiff.ahead} ahead · {submoduleDiff.behind} behind
              </p>
            ) : (
              <p>
                Commit relationship is unavailable because one or both objects are not present
                locally.
              </p>
            )}
          </div>
        ) : unsupportedReason ? (
          <div className={tw.unsupportedDiff}>
            <Icon name={file.submodule ? "worktree" : "warning"} size={24} />
            <strong>{unsupportedReason}</strong>
            <p>
              {file.submodule
                ? "The old and new submodule revisions are shown when Git metadata is available."
                : "This file is shown as metadata only to keep the renderer responsive and safe."}
            </p>
            {file.binary && (
              <div className={tw.binaryMetadata}>
                <span>Before: {previewDescription(beforePreview)}</span>
                <span>After: {previewDescription(afterPreview)}</span>
              </div>
            )}
            {!file.binary && file.sizeBytes !== undefined && (
              <small>{file.sizeBytes.toLocaleString()} bytes</small>
            )}
            {onOpenExternally && (
              <button onClick={() => void onOpenExternally()}>Open externally</button>
            )}
          </div>
        ) : beforeText !== null && afterText !== null ? (
          <Suspense fallback={<div className={tw.emptyState}>Loading diff editor…</div>}>
            <CodeMirrorDiff
              after={afterText}
              before={beforeText}
              collapseUnchanged={preferences.collapseUnchanged}
              contextLines={preferences.contextLines}
              differenceNavigation={differenceNavigation}
              ignoreWhitespace={preferences.whitespace === "ignoreAll"}
              onStatisticsChange={updateStatistics}
              onToggleLine={toggleSelectedLine}
              path={file.path}
              searchNavigation={searchNavigation}
              searchMatchIndex={searchMatchIndex}
              searchQuery={searchQuery}
              selectableLines={selectableLines}
              synchronizedScroll={split && preferences.synchronizedScroll}
              viewMode={split ? "split" : "unified"}
              wordWrap={preferences.wordWrap}
            />
          </Suspense>
        ) : (
          <div className={tw.unsupportedDiff}>
            <Icon name="warning" size={24} />
            <strong>Semantic preview unavailable</strong>
            <p>{contentUnavailable ?? "The before/after file content could not be loaded."}</p>
            {onOpenExternally && (
              <button onClick={() => void onOpenExternally()}>Open externally</button>
            )}
          </div>
        )}
      </div>
      {dialog.node}
    </section>
  );
}
