import { lazy, Suspense } from "react";
import type { ScratchFile } from "../domain/scratchFiles";
import { Spinner } from "./ProductCollections";

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
        <section
            aria-label={`Scratch file: ${file.name}`}
            className={`scratchEditor [background:var(--card)] [height:100%] [min-height:0] [min-width:0] [overflow:hidden] scratchEditor`}
        >
            <Suspense
                fallback={
                    <Spinner
                        className="h-full w-full justify-center"
                        label="Loading editor…"
                    />
                }
            >
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
