import { lazy, Suspense } from "react";
import type { ScratchFile } from "../domain/scratchFiles";
import { tw } from "../styles/tailwind";

const CodeMirrorFile = lazy(() => import("./CodeMirrorFile"));

export function ScratchEditor({
  bookmarkedLines = [],
  file,
  initialColumn,
  initialLine,
  onChange,
  onToggleBookmark,
}: {
  readonly bookmarkedLines?: readonly number[];
  readonly file: ScratchFile;
  readonly initialColumn?: number;
  readonly initialLine?: number;
  readonly onChange: (content: string) => void;
  readonly onToggleBookmark?: (line: number, column: number) => void;
}) {
  return (
    <section aria-label={`Scratch file: ${file.name}`} className={tw.scratchEditor}>
      <Suspense fallback={<div className={tw.emptyState}>Loading editor…</div>}>
        <CodeMirrorFile
          bookmarkedLines={bookmarkedLines}
          editable
          initialColumn={initialColumn}
          initialLine={initialLine}
          onChange={onChange}
          onToggleBookmark={onToggleBookmark}
          path={`Scratches/${file.name}`}
          value={file.content}
        />
      </Suspense>
    </section>
  );
}
