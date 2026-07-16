import { MergeView } from "@codemirror/merge";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";

function splitPatch(patch: string): { before: string; after: string } {
  const before: string[] = [];
  const after: string[] = [];
  for (const line of patch.split("\n")) {
    if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("@@")
    )
      continue;
    if (!line.startsWith("+"))
      before.push(line.startsWith("-") || line.startsWith(" ") ? line.slice(1) : line);
    if (!line.startsWith("-"))
      after.push(line.startsWith("+") || line.startsWith(" ") ? line.slice(1) : line);
  }
  return { before: before.join("\n"), after: after.join("\n") };
}

export default function CodeMirrorDiff({ patch }: { readonly patch: string }) {
  const parent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!parent.current) return;
    const { before, after } = splitPatch(patch);
    const theme = EditorView.theme({
      "&": { height: "100%", fontSize: "12px" },
      ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.55" },
    });
    const view = new MergeView({
      a: { doc: before, extensions: [theme, EditorView.editable.of(false)] },
      b: { doc: after, extensions: [theme] },
      parent: parent.current,
      highlightChanges: true,
      gutter: true,
    });
    return () => view.destroy();
  }, [patch]);
  return <div ref={parent} style={{ height: "100%", minHeight: 0 }} />;
}
