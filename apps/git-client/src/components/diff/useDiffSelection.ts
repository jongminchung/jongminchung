import { useCallback, useEffect, useMemo, useState } from "react";
import { parseDiffDocument } from "../../domain/parsers";
import type { SelectableDiffLine } from "../CodeMirrorDiff";
import type { DiffActionMode } from "../DiffViewer";

export function useDiffSelection({
    filePath,
    mode,
    patch,
}: {
    readonly filePath: string | undefined;
    readonly mode: DiffActionMode;
    readonly patch: string;
}) {
    const [hunkIndex, setHunkIndex] = useState(0);
    const [selectedLines, setSelectedLines] = useState<ReadonlySet<number>>(
        new Set(),
    );
    const document = useMemo(() => parseDiffDocument(patch), [patch]);
    const hunk = document.hunks[hunkIndex] ?? null;
    const selectableLines = useMemo<readonly SelectableDiffLine[]>(() => {
        if (!hunk || mode === "readOnly") return [];
        const range = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(
            hunk.header,
        );
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
    const toggleSelectedLine = useCallback(
        (patchLineIndexes: readonly number[]): void => {
            setSelectedLines((current) => {
                const next = new Set(current);
                const shouldSelect = patchLineIndexes.some(
                    (patchLineIndex) => !next.has(patchLineIndex),
                );
                for (const patchLineIndex of patchLineIndexes) {
                    if (shouldSelect) next.add(patchLineIndex);
                    else next.delete(patchLineIndex);
                }
                return next;
            });
        },
        [],
    );

    useEffect(() => {
        setHunkIndex(0);
        setSelectedLines(new Set());
    }, [filePath, mode, patch]);

    useEffect(() => setSelectedLines(new Set()), [hunkIndex]);

    return {
        document,
        hunk,
        hunkIndex,
        selectableLines,
        selectedLines,
        setHunkIndex,
        toggleSelectedLine,
    };
}
