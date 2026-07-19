import { EditorState, type Extension } from "@codemirror/state";
import {
  diff,
  getChunks,
  goToNextChunk,
  goToPreviousChunk,
  MergeView,
  unifiedMergeView,
} from "@codemirror/merge";
import {
  search,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import { EditorView, GutterMarker, gutter, lineNumbers } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { languageExtensionForPath } from "./codeMirrorLanguage";

export interface DiffNavigationRequest {
  readonly sequence: number;
  readonly direction: -1 | 1;
}

export interface SelectableDiffLine {
  readonly side: "before" | "after";
  readonly lineNumber: number;
  readonly unifiedLineNumber: number;
  readonly patchLineIndex: number;
  readonly selected: boolean;
}

class LineActionMarker extends GutterMarker {
  constructor(readonly selected: boolean) {
    super();
  }

  override eq(other: GutterMarker): boolean {
    return other instanceof LineActionMarker && other.selected === this.selected;
  }

  override toDOM(): Node {
    const marker = document.createElement("span");
    marker.className = "cm-lineActionMarker";
    marker.textContent = this.selected ? "●" : "○";
    marker.title = this.selected ? "Remove line from partial operation" : "Add line to partial operation";
    return marker;
  }
}

const SELECTED_LINE_MARKER = new LineActionMarker(true);
const AVAILABLE_LINE_MARKER = new LineActionMarker(false);

function lineActionGutter(
  side: SelectableDiffLine["side"] | "unified",
  actions: readonly SelectableDiffLine[],
  onToggle: (patchLineIndexes: readonly number[]) => void,
): Extension {
  const byLine = new Map<number, SelectableDiffLine[]>();
  for (const action of actions.filter((action) => side === "unified" || action.side === side)) {
    const lineNumber = side === "unified" ? action.unifiedLineNumber : action.lineNumber;
    byLine.set(lineNumber, [...(byLine.get(lineNumber) ?? []), action]);
  }
  return gutter({
    class: "cm-lineActionGutter",
    renderEmptyElements: true,
    lineMarker: (view, line) => {
      const lineActions = byLine.get(view.state.doc.lineAt(line.from).number);
      return lineActions
        ? (lineActions.every((action) => action.selected) ? SELECTED_LINE_MARKER : AVAILABLE_LINE_MARKER)
        : null;
    },
    domEventHandlers: {
      mousedown: (view, line, event) => {
        const lineActions = byLine.get(view.state.doc.lineAt(line.from).number);
        if (!lineActions) return false;
        event.preventDefault();
        onToggle(lineActions.map((action) => action.patchLineIndex));
        return true;
      },
    },
  });
}

interface DiffEditorHandle {
  readonly primary: EditorView;
  readonly secondary?: EditorView;
  readonly destroy: () => void;
}

function updateSearch(handle: DiffEditorHandle, queryValue: string): void {
  const query = new SearchQuery({ search: queryValue, literal: true });
  handle.primary.dispatch({ effects: setSearchQuery.of(query) });
  handle.secondary?.dispatch({ effects: setSearchQuery.of(query) });
}

function ignoreWhitespaceDiff(before: string, after: string) {
  return diff(before, after).filter((change) => {
    const previous = before.slice(change.fromA, change.toA).replace(/\s+/g, "");
    const next = after.slice(change.fromB, change.toB).replace(/\s+/g, "");
    return previous !== next;
  });
}

function countMatches(value: string, query: string): number {
  if (!query) return 0;
  const needle = query.toLocaleLowerCase();
  let count = 0;
  let offset = 0;
  const haystack = value.toLocaleLowerCase();
  while (offset <= haystack.length - needle.length) {
    const match = haystack.indexOf(needle, offset);
    if (match < 0) break;
    count += 1;
    offset = match + Math.max(needle.length, 1);
  }
  return count;
}

function matchOffsets(value: string, query: string): readonly { readonly from: number; readonly to: number }[] {
  if (!query) return [];
  const needle = query.toLocaleLowerCase();
  const haystack = value.toLocaleLowerCase();
  const matches: { from: number; to: number }[] = [];
  let offset = 0;
  while (offset <= haystack.length - needle.length) {
    const from = haystack.indexOf(needle, offset);
    if (from < 0) break;
    matches.push({ from, to: from + needle.length });
    offset = from + Math.max(needle.length, 1);
  }
  return matches;
}

function editorTheme(wordWrap: boolean): readonly Extension[] {
  const theme = EditorView.theme({
    "&": { height: "100%", fontSize: "12px", background: "var(--color-background-surface)" },
    ".cm-scroller": {
      fontFamily: "var(--font-family-code)",
      lineHeight: "1.55",
      overflow: "auto",
    },
    ".cm-gutters": {
      background: "var(--color-background-muted)",
      borderRight: "1px solid var(--color-border)",
      color: "var(--color-text-disabled)",
    },
    ".cm-changedLine": { background: "color-mix(in srgb, var(--color-success) 10%, transparent)" },
    ".cm-deletedLine": { background: "color-mix(in srgb, var(--color-danger) 10%, transparent)" },
    ".cm-insertedLine": { background: "color-mix(in srgb, var(--color-success) 12%, transparent)" },
    ".cm-changedText": { background: "color-mix(in srgb, var(--color-success) 22%, transparent)" },
    ".cm-deletedChunk .cm-changedText": { background: "color-mix(in srgb, var(--color-danger) 22%, transparent)" },
    ".cm-searchMatch": { background: "color-mix(in srgb, var(--color-warning) 35%, transparent)" },
    ".cm-searchMatch-selected": { background: "color-mix(in srgb, var(--color-accent) 28%, transparent)" },
  });
  return [
    lineNumbers(),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    search({ top: true, literal: true }),
    theme,
    ...(wordWrap ? [EditorView.lineWrapping] : []),
  ];
}

export default function CodeMirrorDiff({
  path,
  before,
  after,
  viewMode,
  wordWrap,
  collapseUnchanged,
  contextLines,
  synchronizedScroll,
  ignoreWhitespace,
  searchQuery,
  searchMatchIndex,
  searchNavigation,
  differenceNavigation,
  selectableLines,
  onToggleLine,
  onStatisticsChange,
}: {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  readonly viewMode: "split" | "unified";
  readonly wordWrap: boolean;
  readonly collapseUnchanged: boolean;
  readonly contextLines: 3 | 5 | 10 | "full";
  readonly synchronizedScroll: boolean;
  readonly ignoreWhitespace: boolean;
  readonly searchQuery: string;
  readonly searchMatchIndex: number;
  readonly searchNavigation: DiffNavigationRequest;
  readonly differenceNavigation: DiffNavigationRequest;
  readonly selectableLines: readonly SelectableDiffLine[];
  readonly onToggleLine: (patchLineIndexes: readonly number[]) => void;
  readonly onStatisticsChange: (statistics: { readonly differences: number; readonly matches: number }) => void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const handle = useRef<DiffEditorHandle | null>(null);

  useEffect(() => {
    let disposed = false;
    const render = async (): Promise<void> => {
      const language = await languageExtensionForPath(path);
      if (disposed || !parent.current) return;
      const common = [...editorTheme(wordWrap), ...(language ? [language] : [])];
      const collapse = collapseUnchanged
        ? { margin: contextLines === "full" ? 3 : contextLines, minSize: 6 }
        : undefined;
      const diffConfig = ignoreWhitespace
        ? { override: ignoreWhitespaceDiff, timeout: 1_000 }
        : { timeout: 1_000 };

      if (viewMode === "split") {
        const merge = new MergeView({
          a: {
            doc: before,
            extensions: [
              ...common,
              EditorView.contentAttributes.of({ "aria-label": `Before changes for ${path}` }),
              lineActionGutter("before", selectableLines, onToggleLine),
            ],
          },
          b: {
            doc: after,
            extensions: [
              ...common,
              EditorView.contentAttributes.of({ "aria-label": `After changes for ${path}` }),
              lineActionGutter("after", selectableLines, onToggleLine),
            ],
          },
          parent: parent.current,
          highlightChanges: true,
          gutter: true,
          collapseUnchanged: collapse,
          diffConfig,
        });
        let synchronizing = false;
        const sync = (source: EditorView, target: EditorView): void => {
          if (!synchronizedScroll || synchronizing) return;
          synchronizing = true;
          target.scrollDOM.scrollTop = source.scrollDOM.scrollTop;
          target.scrollDOM.scrollLeft = source.scrollDOM.scrollLeft;
          requestAnimationFrame(() => { synchronizing = false; });
        };
        const syncFromA = () => sync(merge.a, merge.b);
        const syncFromB = () => sync(merge.b, merge.a);
        merge.a.scrollDOM.addEventListener("scroll", syncFromA, { passive: true });
        merge.b.scrollDOM.addEventListener("scroll", syncFromB, { passive: true });
        handle.current = {
          primary: merge.b,
          secondary: merge.a,
          destroy: () => {
            merge.a.scrollDOM.removeEventListener("scroll", syncFromA);
            merge.b.scrollDOM.removeEventListener("scroll", syncFromB);
            merge.destroy();
          },
        };
        updateSearch(handle.current, searchQuery);
        onStatisticsChange({
          differences: merge.chunks.length,
          matches: countMatches(before, searchQuery) + countMatches(after, searchQuery),
        });
      } else {
        const view = new EditorView({
          parent: parent.current,
          state: EditorState.create({
            doc: after,
            extensions: [
              ...common,
              EditorView.contentAttributes.of({ "aria-label": `Changes for ${path}` }),
              lineActionGutter("unified", selectableLines, onToggleLine),
              unifiedMergeView({
                original: before,
                highlightChanges: true,
                gutter: true,
                syntaxHighlightDeletions: true,
                allowInlineDiffs: true,
                mergeControls: false,
                collapseUnchanged: collapse,
                diffConfig,
              }),
            ],
          }),
        });
        handle.current = { primary: view, destroy: () => view.destroy() };
        updateSearch(handle.current, searchQuery);
        onStatisticsChange({
          differences: getChunks(view.state)?.chunks.length ?? 0,
          matches: countMatches(after, searchQuery),
        });
      }
    };
    void render();
    return () => {
      disposed = true;
      handle.current?.destroy();
      handle.current = null;
    };
  }, [
    after,
    before,
    collapseUnchanged,
    contextLines,
    ignoreWhitespace,
    onStatisticsChange,
    onToggleLine,
    path,
    selectableLines,
    synchronizedScroll,
    viewMode,
    wordWrap,
  ]);

  useEffect(() => {
    const current = handle.current;
    if (!current) return;
    updateSearch(current, searchQuery);
    onStatisticsChange({
      differences: getChunks(current.primary.state)?.chunks.length ?? 0,
      matches: countMatches(after, searchQuery) + (current.secondary ? countMatches(before, searchQuery) : 0),
    });
  }, [after, before, onStatisticsChange, searchQuery]);

  useEffect(() => {
    if (searchNavigation.sequence === 0) return;
    const current = handle.current;
    if (!current) return;
    const beforeMatches = current.secondary ? matchOffsets(before, searchQuery) : [];
    const afterMatches = matchOffsets(after, searchQuery);
    const matches = [
      ...beforeMatches.map((match) => ({ ...match, view: current.secondary! })),
      ...afterMatches.map((match) => ({ ...match, view: current.primary })),
    ];
    const selected = matches[searchMatchIndex];
    if (!selected) return;
    const { view } = selected;
    view.dispatch({
      selection: { anchor: selected.from, head: selected.to },
      effects: EditorView.scrollIntoView(selected.from, { y: "center" }),
    });
    view.focus();
  }, [after, before, searchMatchIndex, searchNavigation, searchQuery]);

  useEffect(() => {
    if (differenceNavigation.sequence === 0) return;
    const view = handle.current?.primary;
    if (!view) return;
    (differenceNavigation.direction === 1 ? goToNextChunk : goToPreviousChunk)(view);
    view.focus();
  }, [differenceNavigation]);

  return <div ref={parent} style={{ height: "100%", minHeight: 0 }} />;
}
