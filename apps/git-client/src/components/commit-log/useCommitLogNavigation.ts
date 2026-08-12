import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { listenWorkbenchEvent } from "../../application/workbench-events/WorkbenchEventPort";
import type { Commit } from "../../domain/types";

export function useCommitLogNavigation({
    commits,
    filtered,
    normalizedQuery,
    onSelectionChange,
    selectedOids,
}: {
    readonly commits: readonly Commit[];
    readonly filtered: readonly Commit[];
    readonly normalizedQuery: string;
    readonly onSelectionChange: (oids: readonly string[]) => void;
    readonly selectedOids: readonly string[];
}) {
    const tableRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return listenWorkbenchEvent("git-client:find", ({ direction }) => {
            if (!normalizedQuery || filtered.length === 0) return;
            const ownsSearch =
                searchInputRef.current === document.activeElement ||
                tableRef.current?.contains(document.activeElement);
            if (!ownsSearch) return;
            const current = filtered.findIndex(
                (commit) => commit.oid === selectedOids[0],
            );
            const index =
                ((current < 0 ? 0 : current) + direction + filtered.length) %
                filtered.length;
            const commit = filtered[index];
            if (commit) onSelectionChange([commit.oid]);
        });
    }, [filtered, normalizedQuery, onSelectionChange, selectedOids]);

    const select = useCallback(
        (event: MouseEvent, commit: Commit): void => {
            if (event.metaKey || event.ctrlKey) {
                onSelectionChange(
                    selectedOids.includes(commit.oid)
                        ? selectedOids.filter((oid) => oid !== commit.oid)
                        : [...selectedOids, commit.oid],
                );
            } else if (event.shiftKey && selectedOids[0]) {
                const from = filtered.findIndex(
                    (item) => item.oid === selectedOids[0],
                );
                const to = filtered.findIndex(
                    (item) => item.oid === commit.oid,
                );
                onSelectionChange(
                    filtered
                        .slice(Math.min(from, to), Math.max(from, to) + 1)
                        .map((item) => item.oid),
                );
            } else onSelectionChange([commit.oid]);
        },
        [filtered, onSelectionChange, selectedOids],
    );

    const navigateCommit = useCallback(
        (direction: "parent" | "child"): void => {
            const selected = commits.find(
                (commit) => commit.oid === selectedOids[0],
            );
            if (!selected) return;
            const oid =
                direction === "parent"
                    ? selected.parents[0]
                    : commits.find((commit) =>
                          commit.parents.includes(selected.oid),
                      )?.oid;
            if (oid) onSelectionChange([oid]);
        },
        [commits, onSelectionChange, selectedOids],
    );

    const navigateRow = useCallback(
        (offset: number): void => {
            if (filtered.length === 0) return;
            const current = filtered.findIndex(
                (commit) => commit.oid === selectedOids[0],
            );
            const nextIndex = Math.max(
                0,
                Math.min(
                    filtered.length - 1,
                    (current < 0 ? 0 : current) + offset,
                ),
            );
            const next = filtered[nextIndex];
            if (!next) return;
            onSelectionChange([next.oid]);
            window.requestAnimationFrame(() => {
                tableRef.current
                    ?.querySelector<HTMLElement>(`[data-oid="${next.oid}"]`)
                    ?.scrollIntoView({ block: "nearest" });
            });
        },
        [filtered, onSelectionChange, selectedOids],
    );

    const onKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>): void => {
            if (event.key === "ArrowDown") navigateRow(1);
            else if (event.key === "ArrowUp") navigateRow(-1);
            else if (event.key === "ArrowRight") navigateCommit("parent");
            else if (event.key === "ArrowLeft") navigateCommit("child");
            else return;
            event.preventDefault();
        },
        [navigateCommit, navigateRow],
    );

    return { onKeyDown, searchInputRef, select, tableRef };
}
