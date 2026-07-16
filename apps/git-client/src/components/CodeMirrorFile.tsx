import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { useEffect, useRef } from "react";

async function languageExtension(path: string): Promise<Extension | null> {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "ts" || extension === "tsx" || extension === "js" || extension === "jsx") {
    const { javascript } = await import("@codemirror/lang-javascript");
    return javascript({
      jsx: extension === "tsx" || extension === "jsx",
      typescript: extension === "ts" || extension === "tsx",
    });
  }
  if (extension === "json") return (await import("@codemirror/lang-json")).json();
  if (extension === "css") return (await import("@codemirror/lang-css")).css();
  if (extension === "html" || extension === "htm")
    return (await import("@codemirror/lang-html")).html();
  if (extension === "java") return (await import("@codemirror/lang-java")).java();
  if (extension === "py") return (await import("@codemirror/lang-python")).python();
  return null;
}

export default function CodeMirrorFile({
  path,
  value,
}: {
  readonly path: string;
  readonly value: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let view: EditorView | null = null;
    const render = async (): Promise<void> => {
      const language = await languageExtension(path);
      if (disposed || !container.current) return;
      const theme = EditorView.theme({
        "&": { height: "100%", fontSize: "11px" },
        ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      });
      view = new EditorView({
        parent: container.current,
        state: EditorState.create({
          doc: value,
          extensions: [
            lineNumbers(),
            theme,
            EditorView.editable.of(false),
            EditorState.readOnly.of(true),
            ...(language ? [language] : []),
          ],
        }),
      });
    };
    void render();
    return () => {
      disposed = true;
      view?.destroy();
    };
  }, [path, value]);

  return <div ref={container} style={{ height: "100%", minHeight: 0 }} />;
}
