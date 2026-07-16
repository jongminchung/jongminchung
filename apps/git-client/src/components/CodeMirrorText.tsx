import { defaultKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { useEffect, useRef } from "react";

export default function CodeMirrorText({
  value,
  readOnly,
  onChange,
}: {
  readonly value: string;
  readonly readOnly: boolean;
  readonly onChange?: (value: string) => void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!parent.current) return;
    const theme = EditorView.theme({
      "&": { height: "100%", fontSize: "11px", background: "var(--surface)" },
      ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.5" },
      ".cm-gutters": { background: "var(--surface-sunken)", border: "0" },
    });
    const editor = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          keymap.of(defaultKeymap),
          EditorView.lineWrapping,
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
          }),
          theme,
        ],
      }),
      parent: parent.current,
    });
    view.current = editor;
    return () => {
      view.current = null;
      editor.destroy();
    };
  }, [readOnly]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={parent} style={{ height: "100%", minHeight: 0 }} />;
}
