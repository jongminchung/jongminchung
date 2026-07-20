import {
  copyLineDown,
  cursorMatchingBracket,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  moveLineDown,
  moveLineUp,
  selectParentSyntax,
  simplifySelection,
  transposeChars,
  toggleBlockComment,
  toggleLineComment,
  undo,
  redo,
  undoSelection,
} from "@codemirror/commands";
import {
  foldAll,
  foldCode,
  foldGutter,
  toggleFold,
  unfoldAll,
  unfoldCode,
} from "@codemirror/language";
import {
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  search,
  SearchQuery,
  searchKeymap,
  selectNextOccurrence,
  selectSelectionMatches,
  setSearchQuery,
} from "@codemirror/search";
import { EditorSelection, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

export type EditorSearchAction =
  | "find"
  | "replace"
  | "next"
  | "previous"
  | "nextWord"
  | "previousWord"
  | "selectionScope";
export type EditorAction =
  | "selectAllOccurrences"
  | "selectNextOccurrence"
  | "unselectOccurrence"
  | "addCaretsToLineEnds"
  | "extendSelection"
  | "shrinkSelection"
  | "toggleCase"
  | "joinLines"
  | "duplicate"
  | "fillParagraph"
  | "sortLines"
  | "reverseLines"
  | "transpose"
  | "indent"
  | "unindent"
  | "convertIndentsToSpaces"
  | "convertIndentsToTabs"
  | "expandFold"
  | "expandAllFolds"
  | "collapseFold"
  | "collapseAllFolds"
  | "toggleFold"
  | "lineComment"
  | "blockComment"
  | "moveStatementDown"
  | "moveStatementUp"
  | "moveLineDown"
  | "moveLineUp"
  | "nextMethod"
  | "previousMethod"
  | "matchingBrace"
  | "undo"
  | "redo";

export const codeMirrorSearchExtensions = [search({ top: true }), keymap.of(searchKeymap)];

export const codeMirrorEditingExtensions: readonly Extension[] = [
  history(),
  keymap.of(historyKeymap),
  EditorState.allowMultipleSelections.of(true),
  foldGutter(),
];

function isFocusedEditor(view: EditorView): boolean {
  return (
    document.activeElement instanceof HTMLElement &&
    document.activeElement.closest(".cm-editor") === view.dom
  );
}

export function installCodeMirrorSearchBridge(getView: () => EditorView | null): () => void {
  const searchEditor = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    const view = getView();
    if (view === null || !isFocusedEditor(view)) return;
    const action = event.detail?.action as EditorSearchAction | undefined;
    if (!action) return;
    event.preventDefault();
    if (action === "next") {
      findNext(view);
      return;
    }
    if (action === "previous") {
      findPrevious(view);
      return;
    }
    if (action === "nextWord" || action === "previousWord") {
      const selection = view.state.selection.main;
      const word = selection.empty ? view.state.wordAt(selection.head) : selection;
      if (!word) return;
      const query = new SearchQuery({
        search: view.state.sliceDoc(word.from, word.to),
        literal: true,
      });
      view.dispatch({ effects: setSearchQuery.of(query) });
      (action === "nextWord" ? findNext : findPrevious)(view);
      return;
    }
    if (action === "selectionScope") {
      const selection = view.state.selection.main;
      if (selection.empty) return;
      const current = getSearchQuery(view.state);
      const query = new SearchQuery({
        search: current.search || view.state.sliceDoc(selection.from, selection.to),
        caseSensitive: current.caseSensitive,
        literal: current.literal,
        regexp: current.regexp,
        replace: current.replace,
        wholeWord: current.wholeWord,
        test: (_match, _state, from, to) => from >= selection.from && to <= selection.to,
      });
      view.dispatch({ effects: setSearchQuery.of(query) });
      openSearchPanel(view);
      return;
    }
    openSearchPanel(view);
    if (action === "replace") {
      window.requestAnimationFrame(() => {
        view.dom.querySelector<HTMLInputElement>('[name="replace"]')?.focus();
      });
    }
  };
  window.addEventListener("git-client:editor-search", searchEditor);
  return () => window.removeEventListener("git-client:editor-search", searchEditor);
}

function selectedLineRange(view: EditorView): {
  readonly from: number;
  readonly to: number;
} {
  const selection = view.state.selection.main;
  const first = view.state.doc.lineAt(selection.from);
  const last = view.state.doc.lineAt(selection.to);
  return { from: first.from, to: last.to };
}

function replaceSelectedLines(
  view: EditorView,
  transform: (lines: readonly string[]) => readonly string[],
): boolean {
  if (view.state.readOnly) return false;
  const { from, to } = selectedLineRange(view);
  const replacement = transform(view.state.sliceDoc(from, to).split("\n")).join("\n");
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: EditorSelection.range(from, from + replacement.length),
  });
  return true;
}

function toggleSelectionCase(view: EditorView): boolean {
  if (view.state.readOnly) return false;
  const main = view.state.selection.main;
  const target = main.empty ? view.state.wordAt(main.head) : main;
  if (!target) return false;
  const value = view.state.sliceDoc(target.from, target.to);
  const replacement =
    value === value.toLocaleUpperCase() ? value.toLocaleLowerCase() : value.toLocaleUpperCase();
  view.dispatch({
    changes: { from: target.from, to: target.to, insert: replacement },
    selection: EditorSelection.range(target.from, target.from + replacement.length),
  });
  return true;
}

function addCaretsToLineEnds(view: EditorView): boolean {
  const positions = new Set<number>();
  for (const range of view.state.selection.ranges) {
    const first = view.state.doc.lineAt(range.from).number;
    const last = view.state.doc.lineAt(range.to).number;
    for (let line = first; line <= last; line += 1) {
      positions.add(view.state.doc.line(line).to);
    }
  }
  view.dispatch({
    selection: EditorSelection.create(
      [...positions].map((position) => EditorSelection.cursor(position)),
    ),
  });
  return true;
}

function unselectOccurrence(view: EditorView): boolean {
  const ranges = view.state.selection.ranges;
  if (ranges.length <= 1) return simplifySelection(view);
  view.dispatch({
    selection: EditorSelection.create(ranges.slice(0, -1)),
  });
  return true;
}

function joinSelectedLines(view: EditorView): boolean {
  if (view.state.readOnly) return false;
  const main = view.state.selection.main;
  const first = view.state.doc.lineAt(main.from);
  const last = view.state.doc.lineAt(main.to);
  const to =
    first.number === last.number && first.number < view.state.doc.lines
      ? view.state.doc.line(first.number + 1).to
      : last.to;
  if (to === first.to) return false;
  const replacement = view.state.sliceDoc(first.from, to).replace(/\s*\n\s*/gu, " ");
  view.dispatch({
    changes: { from: first.from, to, insert: replacement },
    selection: EditorSelection.cursor(first.from + replacement.length),
  });
  return true;
}

function convertIndents(view: EditorView, target: "spaces" | "tabs"): boolean {
  const tabSize = view.state.tabSize;
  return replaceSelectedLines(view, (lines) =>
    lines.map((line) => {
      const indentation = line.match(/^[\t ]*/u)?.[0] ?? "";
      let width = 0;
      for (const character of indentation) {
        width += character === "\t" ? tabSize - (width % tabSize) : 1;
      }
      const next =
        target === "spaces"
          ? " ".repeat(width)
          : "\t".repeat(Math.floor(width / tabSize)) + " ".repeat(width % tabSize);
      return next + line.slice(indentation.length);
    }),
  );
}

function navigateMethod(view: EditorView, direction: -1 | 1): boolean {
  const declaration =
    /^\s*(?:(?:export|public|private|protected|static|async|abstract)\s+)*(?:class|interface|type|enum|function|const|let|var|[A-Za-z_$][\w$]*\s*\()/u;
  const currentLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const matches: number[] = [];
  for (let number = 1; number <= view.state.doc.lines; number += 1) {
    if (declaration.test(view.state.doc.line(number).text)) matches.push(number);
  }
  const target =
    direction > 0
      ? (matches.find((line) => line > currentLine) ?? matches[0])
      : ([...matches].reverse().find((line) => line < currentLine) ?? matches.at(-1));
  if (target === undefined) return false;
  const position = view.state.doc.line(target).from;
  view.dispatch({
    selection: EditorSelection.cursor(position),
    effects: EditorView.scrollIntoView(position, { y: "center" }),
  });
  return true;
}

function runEditorAction(view: EditorView, action: EditorAction): boolean {
  switch (action) {
    case "selectAllOccurrences":
      return selectSelectionMatches(view);
    case "selectNextOccurrence":
      return selectNextOccurrence(view);
    case "unselectOccurrence":
      return unselectOccurrence(view);
    case "addCaretsToLineEnds":
      return addCaretsToLineEnds(view);
    case "extendSelection":
      return selectParentSyntax(view);
    case "shrinkSelection":
      return undoSelection(view);
    case "toggleCase":
      return toggleSelectionCase(view);
    case "joinLines":
      return joinSelectedLines(view);
    case "duplicate":
      return copyLineDown(view);
    case "fillParagraph":
      return replaceSelectedLines(view, (lines) => [lines.map((line) => line.trim()).join(" ")]);
    case "sortLines":
      return replaceSelectedLines(view, (lines) =>
        [...lines].sort((left, right) => left.localeCompare(right)),
      );
    case "reverseLines":
      return replaceSelectedLines(view, (lines) => [...lines].reverse());
    case "transpose":
      return transposeChars(view);
    case "indent":
      return indentMore(view);
    case "unindent":
      return indentLess(view);
    case "convertIndentsToSpaces":
      return convertIndents(view, "spaces");
    case "convertIndentsToTabs":
      return convertIndents(view, "tabs");
    case "expandFold":
      return unfoldCode(view);
    case "expandAllFolds":
      return unfoldAll(view);
    case "collapseFold":
      return foldCode(view);
    case "collapseAllFolds":
      return foldAll(view);
    case "toggleFold":
      return toggleFold(view);
    case "lineComment":
      return toggleLineComment(view);
    case "blockComment":
      return toggleBlockComment(view);
    case "moveStatementDown":
    case "moveLineDown":
      return moveLineDown(view);
    case "moveStatementUp":
    case "moveLineUp":
      return moveLineUp(view);
    case "nextMethod":
      return navigateMethod(view, 1);
    case "previousMethod":
      return navigateMethod(view, -1);
    case "matchingBrace":
      return cursorMatchingBracket(view);
    case "undo":
      return undo(view);
    case "redo":
      return redo(view);
  }
}

export function installCodeMirrorActionBridge(getView: () => EditorView | null): () => void {
  const run = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    const view = getView();
    if (view === null || !isFocusedEditor(view)) return;
    const action = event.detail?.action as EditorAction | undefined;
    if (!action) return;
    event.preventDefault();
    runEditorAction(view, action);
    view.focus();
  };
  window.addEventListener("git-client:editor-action", run);
  return () => window.removeEventListener("git-client:editor-action", run);
}
