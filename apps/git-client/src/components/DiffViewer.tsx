import { Button } from "@jongminchung/ui/components/button";
import { ButtonGroup } from "@jongminchung/ui/components/button-group";
import { Checkbox } from "@jongminchung/ui/components/checkbox";
import { Input } from "@jongminchung/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jongminchung/ui/components/select";
import { Toggle } from "@jongminchung/ui/components/toggle";
import { ToggleGroup, ToggleGroupItem } from "@jongminchung/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
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
import { useAppDialog } from "./AppDialog";
import type { SelectableDiffLine } from "./CodeMirrorDiff";
import { Icon } from "./Icon";
import { EmptyState, Spinner, StatusBadge } from "./ProductCollections";
import { Popover } from "./ProductOverlays";

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
    <div
      className={`imageDiff [display:grid] [grid-template-rows:auto_minmax(0,_1fr)] [height:100%] [min-height:0] [background:var(--card)] [&_figcaption]:[position:relative] [&_figcaption]:[z-index:2] [&_figcaption]:[padding:7px_10px] [&_figcaption]:[color:var(--muted-foreground)] [&_figcaption]:[background:var(--muted)] [&_figcaption]:[border-bottom:1px_solid_var(--border)] [&_figcaption]:[font-size:11px] imageDiff`}
    >
      <div
        className={`imageDiffToolbar [display:flex] [min-height:36px] [align-items:center] [justify-content:space-between] [gap:12px] [padding:5px_10px] [border-bottom:1px_solid_var(--border)] [background:var(--muted)] [&>_div]:[display:flex] [&>_div]:[align-items:center] [&>_div]:[gap:6px] [&>_label]:[display:flex] [&>_label]:[align-items:center] [&>_label]:[gap:6px] [&_input[type=range]]:[width:120px] imageDiffToolbar`}
      >
        <ToggleGroup
          aria-label="Image comparison mode"
          onValueChange={(value) => {
            const selected = value[0] as ImageDiffMode | undefined;
            if (selected !== undefined) setMode(selected);
          }}
          value={[mode]}
        >
          <ToggleGroupItem
            value="sideBySide"
            className={cn(
              "h-7 px-2.5",
              "data-pressed:bg-accent data-pressed:text-accent-foreground",
            )}
          >
            Side by side
          </ToggleGroupItem>
          <ToggleGroupItem
            disabled={!before || !after}
            value="swipe"
            className={cn(
              "h-7 px-2.5",
              "data-pressed:bg-accent data-pressed:text-accent-foreground",
            )}
          >
            Swipe
          </ToggleGroupItem>
          <ToggleGroupItem
            disabled={!before || !after}
            value="onion"
            className={cn(
              "h-7 px-2.5",
              "data-pressed:bg-accent data-pressed:text-accent-foreground",
            )}
          >
            Onion skin
          </ToggleGroupItem>
        </ToggleGroup>
        {mode !== "sideBySide" && before && after && (
          <label>
            {mode === "swipe" ? "Reveal" : "After opacity"}
            <Input
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
        <div
          className={`imageDiffPair [display:grid] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [min-height:0] [&_figure]:[display:grid] [&_figure]:[grid-template-rows:auto_minmax(0,_1fr)] [&_figure]:[min-width:0] [&_figure]:[min-height:0] [&_figure]:[margin:0] [&_figure]:[background-color:var(--card)] [&_figure]:[background-image:linear-gradient(45deg,_var(--muted)_25%,_transparent_25%),_linear-gradient(-45deg,_var(--muted)_25%,_transparent_25%),_linear-gradient(45deg,_transparent_75%,_var(--muted)_75%),_linear-gradient(-45deg,_transparent_75%,_var(--muted)_75%)] [&_figure]:[background-size:18px_18px] [&_figure]:[background-position:0_0,_0_9px,_9px_-9px,_-9px_0] [&_figure_+_figure]:[border-left:1px_solid_var(--border)] [&_figure_>_img]:[width:100%] [&_figure_>_img]:[height:100%] [&_figure_>_img]:[min-height:180px] [&_figure_>_img]:[object-fit:contain] [&_figure_>_img]:[padding:16px] [&_figure_>_div]:[width:100%] [&_figure_>_div]:[height:100%] [&_figure_>_div]:[min-height:180px] [&_figure_>_div]:[object-fit:contain] [&_figure_>_div]:[padding:16px] [&_figure_>_div]:[display:grid] [&_figure_>_div]:[place-items:center] [&_figure_>_div]:[color:var(--muted-foreground)] max-[960px]:[grid-template-columns:1fr] max-[960px]:[overflow:auto] max-[960px]:[&_figure_+_figure]:[border-left:0] max-[960px]:[&_figure_+_figure]:[border-top:1px_solid_var(--border)] imageDiffPair`}
        >
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
        <figure
          className={`imageDiffOverlay [display:grid] [grid-template-rows:auto_minmax(0,_1fr)] [min-width:0] [min-height:0] [margin:0] [background-color:var(--card)] [background-image:linear-gradient(45deg,_var(--muted)_25%,_transparent_25%),_linear-gradient(-45deg,_var(--muted)_25%,_transparent_25%),_linear-gradient(45deg,_transparent_75%,_var(--muted)_75%),_linear-gradient(-45deg,_transparent_75%,_var(--muted)_75%)] [background-size:18px_18px] [background-position:0_0,_0_9px,_9px_-9px,_-9px_0] [&>_div]:[position:relative] [&>_div]:[min-height:0] [&_img]:[position:absolute] [&_img]:[inset:0] [&_img]:[width:100%] [&_img]:[height:100%] [&_img]:[object-fit:contain] [&_img]:[padding:16px] imageDiffOverlay`}
        >
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
  const [statistics, setStatistics] = useState({
    differences: 0,
    matches: 0,
  });
  const [searchNavigation, setSearchNavigation] = useState({
    sequence: 0,
    direction: 1 as -1 | 1,
  });
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
      setSearchNavigation((current) => ({
        sequence: current.sequence + 1,
        direction,
      }));
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
      className={`${`diffViewer [background:var(--card)] [display:grid] [grid-template-rows:36px_auto_minmax(0,_1fr)] [min-height:0] [min-width:0] [outline:0] [position:relative] [&:focus-visible]:[box-shadow:inset_0_0_0_2px_color-mix(in_oklch,_var(--primary)_55%,_transparent)] diffViewer`} ${focused ? `focusedDiffViewer [background:var(--card)] rounded-lg [inset:56px_30px_18px_31px] [position:fixed] [z-index:45] focusedDiffViewer rounded-lg` : ""}`}
      data-diff-viewer
      onKeyDown={handleKeyboard}
      ref={root}
      tabIndex={0}
    >
      <header
        className={`diffViewerHeader [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:6px] [min-width:0] [padding:4px_7px] [&>_span:last-of-type]:[flex:1] [&_strong]:[min-width:40px] [&_small]:[color:var(--disabled-foreground)] [&_small]:[flex:none] diffViewerHeader`}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Previous changed file"
                disabled={!onPreviousFile}
                onClick={onPreviousFile}
                type="button"
                className="text-muted-foreground"
                variant="ghost"
                size="icon-sm"
              >
                ↑
              </Button>
            }
          />
          <TooltipContent>Previous file · ↑</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Next changed file"
                disabled={!onNextFile}
                onClick={onNextFile}
                type="button"
                className="text-muted-foreground"
                variant="ghost"
                size="icon-sm"
              >
                ↓
              </Button>
            }
          />
          <TooltipContent>Next file · ↓</TooltipContent>
        </Tooltip>
        {file ? (
          <>
            <StatusBadge>{file.status.charAt(0).toUpperCase()}</StatusBadge>
            <strong
              className={`ellipsis [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap] ellipsis`}
            >
              {file.path}
            </strong>
            <small>{sourceLabel}</small>
          </>
        ) : (
          <strong>Select a changed file</strong>
        )}
        <span />
        <label
          className={`diffSearch [align-items:center] [background:var(--secondary)] [border:1px_solid_var(--border)] rounded-lg [display:flex] [height:26px] [padding:0_6px] [width:128px] [&:focus-within]:[border-color:var(--primary)] [&:focus-within]:[box-shadow:0_0_0_2px_color-mix(in_oklch,_var(--primary)_22%,_transparent)] [&_input]:[background:transparent] [&_input]:[border:0] [&_input]:[min-width:0] [&_input]:[outline:0] [&_input]:[width:100%] [&_small]:[color:var(--disabled-foreground)] diffSearch rounded-lg`}
        >
          <Icon name="search" size={13} />
          <Input
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
              setSearchNavigation((current) => ({
                sequence: current.sequence + 1,
                direction,
              }));
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
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  aria-label={focused ? "Exit focused diff" : "Focus diff"}
                  onPressedChange={onToggleFocus}
                  pressed={focused}
                  type="button"
                  className="size-7 p-0 text-muted-foreground"
                  size="sm"
                >
                  <Icon name="external" size={13} />
                </Toggle>
              }
            />
            <TooltipContent>Focus diff · Space</TooltipContent>
          </Tooltip>
        )}
      </header>
      <div
        className={`diffViewerToolbar [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:6px] [min-width:0] [padding:4px_7px] [&>_span]:[flex:1] [background:var(--secondary)] [flex-wrap:wrap] [min-height:34px] [&_label]:[align-items:center] [&_label]:[color:var(--muted-foreground)] [&_label]:[display:inline-flex] [&_label]:[font-size:10px] [&_label]:[gap:5px] [&_label]:[white-space:nowrap] [&_button]:[background:var(--card)] [&_button]:[border:1px_solid_var(--border)] [&_button]:[min-height:25px] [&_button]:[padding:0_7px] [&_select]:[background:var(--card)] [&_select]:[border:1px_solid_var(--border)] [&_select]:[min-height:25px] [&_select]:[padding:0_7px] diffViewerToolbar`}
      >
        <label>
          View
          <Select
            onValueChange={(value) =>
              onPreferencesChange({
                ...preferences,
                viewMode: value === "split" || value === "unified" ? value : "auto",
              })
            }
            value={preferences.viewMode}
          >
            <SelectTrigger aria-label="Diff view mode" className="bg-card" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="split">Split</SelectItem>
              <SelectItem value="unified">Unified</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Previous difference"
                  disabled={statistics.differences === 0}
                  onClick={() => moveHunk(-1)}
                  type="button"
                  variant="outline"
                  size="sm"
                >
                  ↑ Difference
                </Button>
              }
            />
            <TooltipContent>Previous difference · ⌥↑</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Next difference"
                  disabled={statistics.differences === 0}
                  onClick={() => moveHunk(1)}
                  type="button"
                  variant="outline"
                  size="sm"
                >
                  ↓ Difference
                </Button>
              }
            />
            <TooltipContent>Next difference · ⌥↓</TooltipContent>
          </Tooltip>
        </ButtonGroup>
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
                <Select
                  onValueChange={(value) => {
                    onPreferencesChange({
                      ...preferences,
                      contextLines:
                        value === "full" ? "full" : value === "5" ? 5 : value === "10" ? 10 : 3,
                    });
                  }}
                  value={String(preferences.contextLines)}
                >
                  <SelectTrigger aria-label="Diff context lines" className="w-full" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="3">3 lines</SelectItem>
                    <SelectItem value="5">5 lines</SelectItem>
                    <SelectItem value="10">10 lines</SelectItem>
                    <SelectItem value="full">Entire file</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                <Checkbox
                  checked={preferences.whitespace === "ignoreAll"}
                  onCheckedChange={(checked) =>
                    onPreferencesChange({
                      ...preferences,
                      whitespace: checked ? "ignoreAll" : "show",
                    })
                  }
                />
                Ignore whitespace
              </label>
              <label>
                <Checkbox
                  checked={preferences.wordWrap}
                  onCheckedChange={(checked) =>
                    onPreferencesChange({
                      ...preferences,
                      wordWrap: checked,
                    })
                  }
                />
                Wrap
              </label>
              <label>
                <Checkbox
                  checked={preferences.collapseUnchanged}
                  onCheckedChange={(checked) =>
                    onPreferencesChange({
                      ...preferences,
                      collapseUnchanged: checked,
                    })
                  }
                />
                Fold unchanged
              </label>
              {split && (
                <label>
                  <Checkbox
                    checked={preferences.synchronizedScroll}
                    onCheckedChange={(checked) =>
                      onPreferencesChange({
                        ...preferences,
                        synchronizedScroll: checked,
                      })
                    }
                  />
                  Sync scroll
                </label>
              )}
            </div>
          }
        >
          <Button type="button" className={cn("h-7 px-2.5")} variant="outline" size="sm">
            Diff options
          </Button>
        </Popover>
        <span />
        {mode !== "readOnly" && (
          <>
            <Select
              disabled={document.hunks.length === 0}
              onValueChange={(value) => value !== null && setHunkIndex(Number(value))}
              value={String(Math.min(hunkIndex, Math.max(0, document.hunks.length - 1)))}
            >
              <SelectTrigger aria-label="Selected hunk" className="bg-card" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {document.hunks.map((item, index) => (
                  <SelectItem key={`${item.header}-${index}`} value={String(index)}>
                    Hunk {index + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hunk && (
              <code
                className="max-w-56 truncate text-[10px] text-muted-foreground"
                title={hunk.header}
              >
                {hunk.header}
              </code>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    disabled={!onFileAction}
                    onClick={() => void onFileAction?.()}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                  >
                    {mode === "stage" ? "Stage file" : "Unstage file"}
                  </Button>
                }
              />
              <TooltipContent>Stage or unstage · ⌘S</TooltipContent>
            </Tooltip>
            <Button
              disabled={hunk === null || !onApplyPatch}
              onClick={() => void applyHunk(true, mode === "unstage")}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              {mode === "stage" ? "Stage hunk" : "Unstage hunk"}
            </Button>
            <Button
              disabled={hunk === null || selectedLines.size === 0 || !onApplyPatch}
              onClick={() => void applySelectedLines()}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              {mode === "stage" ? "Stage lines" : "Unstage lines"}
            </Button>
            {mode === "stage" && (
              <Button
                disabled={hunk === null || !onApplyPatch}
                onClick={() => void discardHunk()}
                type="button"
                className={cn("h-7 px-2.5")}
                variant="outline"
                size="sm"
              >
                Discard hunk
              </Button>
            )}
          </>
        )}
      </div>
      <div
        aria-label={file ? `Diff content for ${file.path}` : "Diff content"}
        className={`diffViewerContent [min-height:0] [overflow:auto] [&>_pre]:[font-family:var(--font-family-code)] [&>_pre]:[font-size:11px] [&>_pre]:[line-height:1.55] [&>_pre]:[margin:0] [&>_pre]:[min-height:100%] [&>_pre]:[padding:12px] [&>_pre]:[white-space:pre] [&>_pre.wrappedDiff]:[white-space:pre-wrap] [&>_pre.wrappedDiff]:[word-break:break-word] [&>_pre_>_span]:[display:inline] diffViewerContent`}
        role="region"
        tabIndex={0}
      >
        {loading ? (
          <Spinner className="h-full w-full justify-center" label="Loading diff…" />
        ) : file === null ? (
          <EmptyState title="Select a changed file to review its diff." />
        ) : file.binary && hasImagePreview ? (
          <ImageDiff afterPreview={afterPreview} beforePreview={beforePreview} />
        ) : file.submodule && submoduleDiff ? (
          <div
            className={`submoduleDiff [display:grid] [align-content:center] [justify-items:center] [gap:10px] [min-height:100%] [padding:28px] [color:var(--muted-foreground)] [text-align:center] [&>_strong]:[color:var(--foreground)] [&>_div]:[display:grid] [&>_div]:[grid-template-columns:minmax(0,_1fr)_auto_minmax(0,_1fr)] [&>_div]:[align-items:center] [&>_div]:[gap:12px] [&>_div]:[width:min(680px,_100%)] [&_section]:[display:grid] [&_section]:[gap:6px] [&_section]:[min-width:0] [&_section]:[padding:12px] [&_section]:[border:1px_solid_var(--border)] [&_section]:rounded-lg [&_section]:[background:var(--secondary)] [&_section]:[text-align:left] [&_code]:[overflow:hidden] [&_code]:[color:var(--foreground)] [&_code]:[font-size:11px] [&_code]:[text-overflow:ellipsis] submoduleDiff [&_section]:rounded-lg`}
          >
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
          <div
            className={`unsupportedDiff [align-items:center] [color:var(--muted-foreground)] [display:flex] [flex-direction:column] [height:100%] [justify-content:center] [text-align:center] [&_strong]:[color:var(--foreground)] [&_strong]:[margin-top:9px] [&_p]:[max-width:380px] [&_button]:[align-items:center] [&_button]:[background:var(--muted)] [&_button]:[border:1px_solid_var(--border)] [&_button]:rounded-sm [&_button]:[display:inline-flex] [&_button]:[gap:6px] [&_button]:[height:29px] [&_button]:[padding:0_10px] unsupportedDiff [&_button]:rounded-sm`}
          >
            <Icon name={file.submodule ? "worktree" : "warning"} size={24} />
            <strong>{unsupportedReason}</strong>
            <p>
              {file.submodule
                ? "The old and new submodule revisions are shown when Git metadata is available."
                : "This file is shown as metadata only to keep the renderer responsive and safe."}
            </p>
            {file.binary && (
              <div
                className={`binaryMetadata [display:grid] [gap:4px] [color:var(--muted-foreground)] [font-family:var(--font-family-code)] [font-size:11px] binaryMetadata`}
              >
                <span>Before: {previewDescription(beforePreview)}</span>
                <span>After: {previewDescription(afterPreview)}</span>
              </div>
            )}
            {!file.binary && file.sizeBytes !== undefined && (
              <small>{file.sizeBytes.toLocaleString()} bytes</small>
            )}
            {onOpenExternally && (
              <Button
                onClick={() => void onOpenExternally()}
                type="button"
                className={cn("h-7 px-2.5")}
                variant="outline"
                size="sm"
              >
                Open externally
              </Button>
            )}
          </div>
        ) : beforeText !== null && afterText !== null ? (
          <Suspense
            fallback={
              <Spinner className="h-full w-full justify-center" label="Loading diff editor…" />
            }
          >
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
          <div
            className={`unsupportedDiff [align-items:center] [color:var(--muted-foreground)] [display:flex] [flex-direction:column] [height:100%] [justify-content:center] [text-align:center] [&_strong]:[color:var(--foreground)] [&_strong]:[margin-top:9px] [&_p]:[max-width:380px] [&_button]:[align-items:center] [&_button]:[background:var(--muted)] [&_button]:[border:1px_solid_var(--border)] [&_button]:rounded-sm [&_button]:[display:inline-flex] [&_button]:[gap:6px] [&_button]:[height:29px] [&_button]:[padding:0_10px] unsupportedDiff [&_button]:rounded-sm`}
          >
            <Icon name="warning" size={24} />
            <strong>Semantic preview unavailable</strong>
            <p>{contentUnavailable ?? "The before/after file content could not be loaded."}</p>
            {onOpenExternally && (
              <Button
                onClick={() => void onOpenExternally()}
                type="button"
                className={cn("h-7 px-2.5")}
                variant="outline"
                size="sm"
              >
                Open externally
              </Button>
            )}
          </div>
        )}
      </div>
      {dialog.node}
    </section>
  );
}
