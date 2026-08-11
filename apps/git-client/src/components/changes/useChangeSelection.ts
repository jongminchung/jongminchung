import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from "react";
import type { ChangeEntry, ChangeSelection } from "../../domain/changeReview";
import { hasSameChangeSelection, uniqueChangePaths } from "../../domain/changeReview";
import type { GitOperation } from "../../shared/contracts/model";
import type { useAppDialog } from "../AppDialog";

export function selectionKey(selection: ChangeSelection): string {
  return `${selection.layer}:${selection.path}`;
}

interface ChangeSelectionOptions {
  readonly dialog: ReturnType<typeof useAppDialog>;
  readonly diffPreviewVisible: boolean;
  readonly entries: readonly ChangeEntry[];
  readonly navigator: RefObject<HTMLElement | null>;
  readonly onFocusDiff: () => void;
  readonly onOpenConflict: (entry: ChangeEntry) => void;
  readonly onOperation: (operation: GitOperation) => Promise<void>;
  readonly onSelectionChange: (selection: ChangeSelection) => void;
  readonly searchInput: RefObject<HTMLInputElement | null>;
  readonly selection: ChangeSelection | null;
}

export function useChangeSelection({
  dialog,
  diffPreviewVisible,
  entries,
  navigator,
  onFocusDiff,
  onOpenConflict,
  onOperation,
  onSelectionChange,
  searchInput,
  selection,
}: ChangeSelectionOptions) {
  const [query, setQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          !normalizedQuery || entry.file.path.toLocaleLowerCase().includes(normalizedQuery),
      ),
    [entries, normalizedQuery],
  );
  const selectedEntry =
    entries.find((entry) => selection && hasSameChangeSelection(entry.selection, selection)) ??
    null;
  const selectedEntries = entries.filter((entry) =>
    selectedKeys.has(selectionKey(entry.selection)),
  );
  const effectiveSelectedEntries =
    selectedEntries.length > 0 ? selectedEntries : selectedEntry ? [selectedEntry] : [];
  const selectedIndex = selectedEntry ? filteredEntries.indexOf(selectedEntry) : -1;

  const moveSelection = (offset: number): void => {
    if (filteredEntries.length === 0) return;
    const nextIndex = Math.min(
      filteredEntries.length - 1,
      Math.max(0, (selectedIndex < 0 ? 0 : selectedIndex) + offset),
    );
    const next = filteredEntries[nextIndex];
    if (!next) return;
    const key = selectionKey(next.selection);
    onSelectionChange(next.selection);
    setSelectedKeys(new Set([key]));
    setSelectionAnchor(key);
  };

  const runFileAction = async (): Promise<void> => {
    if (!selectedEntry) return;
    if (selectedEntry.file.status === "conflicted") {
      onOpenConflict(selectedEntry);
      return;
    }
    await onOperation({
      kind: selectedEntry.selection.layer === "index" ? "unstage" : "stage",
      paths: [selectedEntry.file.path],
    });
  };

  const selectEntry = (event: ReactMouseEvent, entry: ChangeEntry): void => {
    if (diffPreviewVisible) onSelectionChange(entry.selection);
    const key = selectionKey(entry.selection);
    if (event.shiftKey) {
      const anchor = selectionAnchor ?? (selection ? selectionKey(selection) : key);
      const anchorIndex = filteredEntries.findIndex(
        (candidate) => selectionKey(candidate.selection) === anchor,
      );
      const targetIndex = filteredEntries.findIndex(
        (candidate) => selectionKey(candidate.selection) === key,
      );
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] =
          anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        setSelectedKeys(
          new Set(
            filteredEntries
              .slice(start, end + 1)
              .map((candidate) => selectionKey(candidate.selection)),
          ),
        );
        setSelectionAnchor(anchor);
        return;
      }
    }
    if (!event.metaKey && !event.ctrlKey) {
      setSelectedKeys(new Set([key]));
      setSelectionAnchor(key);
      return;
    }
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.size === 0 && selection) next.add(selectionKey(selection));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSelectionAnchor(key);
  };

  const handleNavigatorKeyboard = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.key === "Enter" && selectedEntry) {
      event.preventDefault();
      onFocusDiff();
      return;
    }
    if (event.key === " " && selectedEntry) {
      event.preventDefault();
      void runFileAction();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "a") {
      event.preventDefault();
      setSelectedKeys(new Set(filteredEntries.map((entry) => selectionKey(entry.selection))));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? filteredEntries[0] : filteredEntries.at(-1);
      if (next) {
        const key = selectionKey(next.selection);
        onSelectionChange(next.selection);
        setSelectedKeys(new Set([key]));
        setSelectionAnchor(key);
      }
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    moveSelection(event.key === "ArrowUp" ? -1 : 1);
  };

  const discardSelectedChanges = async (): Promise<void> => {
    const discardable = effectiveSelectedEntries.filter(
      (entry) => entry.selection.layer === "worktree" && entry.file.status !== "conflicted",
    );
    const paths = uniqueChangePaths(discardable, "worktree");
    if (paths.length === 0) return;
    const accepted = await dialog.confirm({
      title:
        paths.length === 1 ? `Discard changes in ${paths[0]}?` : `Discard ${paths.length} files?`,
      description: "Restore each selected working-tree path to its indexed version.",
      impact: "Uncommitted working-tree edits will be lost.",
      confirmLabel: "Discard changes",
      dangerous: true,
    });
    if (accepted) await onOperation({ kind: "discard", paths: [...paths] });
  };

  useEffect(() => {
    const find = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      const ownsSearch =
        searchInput.current === document.activeElement ||
        navigator.current?.contains(document.activeElement);
      if (!ownsSearch || !query || filteredEntries.length === 0) return;
      const direction = event.detail?.direction === -1 ? -1 : 1;
      const nextIndex =
        (Math.max(0, selectedIndex) + direction + filteredEntries.length) % filteredEntries.length;
      const next = filteredEntries[nextIndex];
      if (next) onSelectionChange(next.selection);
    };
    window.addEventListener("git-client:find", find);
    return () => window.removeEventListener("git-client:find", find);
  }, [filteredEntries, navigator, onSelectionChange, query, searchInput, selectedIndex]);

  useEffect(() => {
    if (!selection) {
      setSelectedKeys(new Set());
      setSelectionAnchor(null);
      return;
    }
    const key = selectionKey(selection);
    setSelectedKeys((current) => (current.size > 1 ? current : new Set([key])));
    setSelectionAnchor((current) => current ?? key);
  }, [selection?.layer, selection?.path, selection]);

  const collapseSelection = useCallback(
    () => setSelectedKeys(new Set(selection ? [selectionKey(selection)] : [])),
    [selection],
  );

  return {
    collapseSelection,
    discardSelectedChanges,
    effectiveSelectedEntries,
    filteredEntries,
    handleNavigatorKeyboard,
    moveSelection,
    query,
    runFileAction,
    selectedEntry,
    selectedIndex,
    selectedKeys,
    selectEntry,
    setQuery,
  };
}
