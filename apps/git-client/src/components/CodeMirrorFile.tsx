import { EditorState } from "@codemirror/state";
import {
  EditorView,
  GutterMarker,
  gutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { useEffect, useRef } from "react";
import { languageExtensionForPath } from "./codeMirrorLanguage";
import {
  codeMirrorSearchExtensions,
  codeMirrorEditingExtensions,
  installCodeMirrorActionBridge,
  installCodeMirrorSearchBridge,
} from "./codeMirrorSearch";

class LineBookmarkMarker extends GutterMarker {
  override toDOM(): Node {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    marker.setAttribute("class", "cm-bookmark-marker");
    marker.setAttribute("viewBox", "0 0 14 14");
    marker.setAttribute("width", "12");
    marker.setAttribute("height", "12");
    marker.setAttribute("aria-label", "Bookmark");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M2 2.48828C2 1.65985 2.67157 0.988281 3.5 0.988281H10.5C11.3284 0.988281 12 1.65985 12 2.48828V13.5968C12 13.917 11.6425 14.1075 11.3768 13.9289L7 10.9883L2.62343 13.9322C2.35765 14.111 2 13.9205 2 13.6002V2.48828Z");
    path.setAttribute("fill", "#FFAF0F");
    marker.append(path);
    return marker;
  }
}

const lineBookmarkMarker = new LineBookmarkMarker();

function languageName(path: string): string {
  const extension = path.split(".").at(-1)?.toLocaleLowerCase();
  if (extension === "ts" || extension === "tsx") return "TypeScript";
  if (extension === "js" || extension === "jsx" || extension === "mjs" || extension === "cjs") return "JavaScript";
  if (extension === "json" || extension === "jsonc") return "JSON";
  if (extension === "css" || extension === "scss" || extension === "less") return "CSS";
  if (extension === "html" || extension === "htm") return "HTML";
  if (extension === "md" || extension === "mdx") return "Markdown";
  if (extension === "yaml" || extension === "yml") return "YAML";
  if (extension === "xml" || extension === "svg") return "XML";
  if (extension === "sh" || extension === "zsh" || extension === "bash") return "Shell Script";
  return "Plain Text";
}

function indentationLabel(value: string): string {
  const indentation = value.match(/\n([ \t]+)\S/u)?.[1];
  if (!indentation) return "Spaces: 2";
  if (indentation.startsWith("\t")) return "Tab";
  return `Spaces: ${indentation.length}`;
}

export default function CodeMirrorFile({
  path,
  value,
  editable = false,
  onChange,
  onSave,
  initialLine,
  initialColumn,
  bookmarkedLines = [],
  onToggleBookmark,
}: {
  readonly path: string;
  readonly value: string;
  readonly editable?: boolean;
  readonly onChange?: (value: string) => void;
  readonly onSave?: (value: string) => Promise<void>;
  readonly initialLine?: number;
  readonly initialColumn?: number;
  readonly bookmarkedLines?: readonly number[];
  readonly onToggleBookmark?: (line: number, column: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onToggleBookmarkRef = useRef(onToggleBookmark);
  const valueRef = useRef(value);
  const viewRef = useRef<EditorView | null>(null);
  const columnSelectionRef = useRef(false);
  const editorIdRef = useRef(crypto.randomUUID());
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onToggleBookmarkRef.current = onToggleBookmark;
  valueRef.current = value;
  const bookmarkedLineKey = [...new Set(bookmarkedLines)].sort((left, right) => left - right).join(",");

  useEffect(() => {
    let disposed = false;
    let view: EditorView | null = null;
    let active = false;
    const publishStatus = (editor: EditorView): void => {
      const head = editor.state.selection.main.head;
      const line = editor.state.doc.lineAt(head);
      const word = editor.state.wordAt(head);
      const selection = editor.state.selection.main;
      window.dispatchEvent(new CustomEvent("git-client:editor-status", {
        detail: {
          path,
          line: line.number,
          column: head - line.from + 1,
          readOnly: !editable,
          language: languageName(path),
          lineSeparator: editor.state.doc.toString().includes("\r\n") ? "CRLF" : "LF",
          indentation: indentationLabel(editor.state.doc.toString()),
          columnSelection: columnSelectionRef.current,
          symbol: word
            ? editor.state.doc.sliceString(word.from, word.to)
            : undefined,
          selectedText: selection.empty
            ? undefined
            : editor.state.doc.sliceString(selection.from, selection.to),
        },
      }));
    };
    const goToLine = (event: Event): void => {
      if (!active || !(event instanceof CustomEvent) || view === null) return;
      const requestedLine = Number(event.detail?.line);
      const requestedColumn = Number(event.detail?.column ?? 1);
      if (!Number.isInteger(requestedLine) || !Number.isInteger(requestedColumn)) return;
      const line = view.state.doc.line(
        Math.min(view.state.doc.lines, Math.max(1, requestedLine)),
      );
      const position = Math.min(
        line.to,
        line.from + Math.max(0, requestedColumn - 1),
      );
      view.dispatch({
        selection: { anchor: position },
        effects: EditorView.scrollIntoView(position, { y: "center" }),
      });
      view.focus();
      publishStatus(view);
    };
    const toggleColumnSelection = (): void => {
      if (!active || view === null) return;
      columnSelectionRef.current = !columnSelectionRef.current;
      publishStatus(view);
    };
    const editorActivated = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      if (event.detail !== editorIdRef.current) active = false;
    };
    window.addEventListener("git-client:go-to-line", goToLine);
    window.addEventListener(
      "git-client:toggle-column-selection",
      toggleColumnSelection,
    );
    window.addEventListener("git-client:editor-activated", editorActivated);
    const removeSearchBridge = installCodeMirrorSearchBridge(() => view);
    const removeActionBridge = installCodeMirrorActionBridge(() => view);
    const render = async (): Promise<void> => {
      const language = await languageExtensionForPath(path);
      if (disposed || !container.current) return;
      const theme = EditorView.theme({
        "&": { height: "100%", fontSize: "var(--editor-font-size, 13px)" },
        ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
        ".cm-bookmarks-gutter": { width: "15px" },
        ".cm-bookmarks-gutter .cm-gutterElement": {
          alignItems: "center",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          width: "15px",
        },
        ".cm-bookmark-marker": {
          display: "block",
        },
      });
      const bookmarkedLineSet = new Set(
        bookmarkedLineKey
          .split(",")
          .filter(Boolean)
          .map(Number),
      );
      view = new EditorView({
        parent: container.current,
        state: EditorState.create({
          doc: valueRef.current,
          extensions: [
            lineNumbers(),
            gutter({
              class: "cm-bookmarks-gutter",
              renderEmptyElements: true,
              lineMarker: (editor, line) =>
                bookmarkedLineSet.has(editor.state.doc.lineAt(line.from).number)
                  ? lineBookmarkMarker
                  : null,
              domEventHandlers: {
                mousedown: (editor, block) => {
                  const line = editor.state.doc.lineAt(block.from);
                  const column = editor.state.selection.main.head >= line.from &&
                    editor.state.selection.main.head <= line.to
                    ? editor.state.selection.main.head - line.from + 1
                    : 1;
                  onToggleBookmarkRef.current?.(line.number, column);
                  editor.focus();
                  publishStatus(editor);
                  return true;
                },
              },
            }),
            theme,
            EditorView.editable.of(editable),
            EditorState.readOnly.of(!editable),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
              if (active && (update.docChanged || update.selectionSet)) publishStatus(update.view);
            }),
            EditorView.domEventHandlers({
              focus: (_event, editor) => {
                active = true;
                window.dispatchEvent(
                  new CustomEvent("git-client:editor-activated", {
                    detail: editorIdRef.current,
                  }),
                );
                publishStatus(editor);
              },
            }),
            rectangularSelection({
              eventFilter: (event) => columnSelectionRef.current || event.altKey,
            }),
            keymap.of(
              editable && onSaveRef.current
                ? [{
                    key: "Mod-s",
                    run: (editor) => {
                      void onSaveRef.current?.(editor.state.doc.toString());
                      return true;
                    },
                  }]
                : [],
            ),
            EditorView.contentAttributes.of({ "aria-label": `File contents for ${path}` }),
            ...codeMirrorEditingExtensions,
            ...codeMirrorSearchExtensions,
            ...(language ? [language] : []),
          ],
        }),
      });
      viewRef.current = view;
      if (initialLine !== undefined) {
        const line = view.state.doc.line(
          Math.min(view.state.doc.lines, Math.max(1, initialLine)),
        );
        const position = Math.min(
          line.to,
          line.from + Math.max(0, (initialColumn ?? 1) - 1),
        );
        view.dispatch({
          selection: { anchor: position },
          effects: EditorView.scrollIntoView(position, { y: "center" }),
        });
        view.focus();
        publishStatus(view);
      }
    };
    void render();
    return () => {
      disposed = true;
      window.removeEventListener("git-client:go-to-line", goToLine);
      window.removeEventListener(
        "git-client:toggle-column-selection",
        toggleColumnSelection,
      );
      window.removeEventListener("git-client:editor-activated", editorActivated);
      removeSearchBridge();
      removeActionBridge();
      if (active) {
        window.dispatchEvent(
          new CustomEvent("git-client:editor-status", { detail: null }),
        );
      }
      view?.destroy();
      if (viewRef.current === view) viewRef.current = null;
    };
  }, [bookmarkedLineKey, editable, initialColumn, initialLine, path]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null || view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return <div ref={container} style={{ height: "100%", minHeight: 0 }} />;
}
