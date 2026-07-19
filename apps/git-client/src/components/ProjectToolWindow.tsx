import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Popover } from "@astryxdesign/core/Popover";
import { Selector } from "@astryxdesign/core/Selector";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FileChange, TreeEntry } from "../domain/types";
import type { ScratchFile } from "../domain/scratchFiles";
import {
  mergeProjectTreeEntries,
  type ProjectTreeEntry,
} from "../domain/projectTree";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

interface VisibleProjectRow {
  readonly entry: ProjectTreeEntry;
  readonly depth: number;
}

type ProjectSortKey = "name" | "type";

function isProjectSortKey(value: string): value is ProjectSortKey {
  return value === "name" || value === "type";
}

function sortProjectEntries(
  entries: readonly ProjectTreeEntry[],
  sortKey: ProjectSortKey,
  foldersAlwaysOnTop: boolean,
): readonly ProjectTreeEntry[] {
  return [...entries].sort((left, right) => {
    if (foldersAlwaysOnTop && left.kind !== right.kind) {
      return left.kind === "tree" ? -1 : 1;
    }
    if (sortKey === "type") {
      const leftExtension = left.kind === "tree" ? "" : left.name.split(".").at(-1) ?? "";
      const rightExtension = right.kind === "tree" ? "" : right.name.split(".").at(-1) ?? "";
      const typeOrder = leftExtension.localeCompare(rightExtension, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (typeOrder !== 0) return typeOrder;
    }
    return left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function statusLabel(status: FileChange["status"] | undefined): string | null {
  if (status === "modified") return "M";
  if (status === "added" || status === "untracked") return "A";
  if (status === "deleted") return "D";
  if (status === "renamed") return "R";
  if (status === "conflicted") return "!";
  return null;
}

export function ProjectToolWindow({
  activePath,
  repositoryName,
  repositoryPath,
  hasCommits,
  changes,
  loadTree,
  onOpenFile,
  onNew,
  onNewScratch,
  onOpenScratch,
  onClose,
  scratches,
}: {
  readonly activePath?: string;
  readonly repositoryName: string;
  readonly repositoryPath: string;
  readonly hasCommits: boolean;
  readonly changes: readonly FileChange[];
  readonly loadTree: (revision: string, path?: string) => Promise<readonly TreeEntry[]>;
  readonly onOpenFile: (path: string, keepOpen?: boolean) => void;
  readonly onNew: () => void;
  readonly onNewScratch: () => void;
  readonly onOpenScratch: (scratch: ScratchFile) => void;
  readonly onClose: () => void;
  readonly scratches: readonly ScratchFile[];
}) {
  const [children, setChildren] = useState<ReadonlyMap<string, readonly ProjectTreeEntry[]>>(
    new Map(),
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set([""]));
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState("");
  const [error, setError] = useState<string>();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [openFilesWithSingleClick, setOpenFilesWithSingleClick] = useState(false);
  const [alwaysSelectOpenedFile, setAlwaysSelectOpenedFile] = useState(false);
  const [showScratches, setShowScratches] = useState(true);
  const [scratchesExpanded, setScratchesExpanded] = useState(false);
  const [compactDirectories, setCompactDirectories] = useState(true);
  const [foldersAlwaysOnTop, setFoldersAlwaysOnTop] = useState(true);
  const [sortKey, setSortKey] = useState<ProjectSortKey>("name");

  const loadDirectory = useCallback(
    async (path: string): Promise<void> => {
      if (children.has(path) || loading.has(path)) return;
      setLoading((current) => new Set(current).add(path));
      setError(undefined);
      try {
        const tracked = hasCommits ? await loadTree("HEAD", path || undefined) : [];
        const entries = mergeProjectTreeEntries(path, tracked, changes);
        setChildren((current) => new Map(current).set(path, entries));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setLoading((current) => {
          const next = new Set(current);
          next.delete(path);
          return next;
        });
      }
    },
    [changes, children, hasCommits, loadTree, loading],
  );

  const changeFingerprint = useMemo(
    () => changes.map((change) => `${change.path}:${change.status}:${change.staged}:${change.worktree}`).join("\0"),
    [changes],
  );

  useEffect(() => {
    setChildren(new Map());
  }, [changeFingerprint, hasCommits]);

  useEffect(() => {
    const ordered = [...expanded].sort(
      (left, right) => left.split("/").length - right.split("/").length,
    );
    for (const path of ordered) {
      const parentPath = path.includes("/")
        ? path.slice(0, path.lastIndexOf("/"))
        : "";
      if (path === "" || children.has(parentPath)) void loadDirectory(path);
    }
  }, [children, expanded, loadDirectory]);

  const rows = useMemo(() => {
    const visible: VisibleProjectRow[] = [];
    const append = (path: string, depth: number): void => {
      for (const initialEntry of sortProjectEntries(
        children.get(path) ?? [],
        sortKey,
        foldersAlwaysOnTop,
      )) {
        let entry = initialEntry;
        if (compactDirectories && entry.kind === "tree") {
          const names = [entry.name];
          let nested = children.get(entry.path);
          while (nested?.length === 1 && nested[0]?.kind === "tree") {
            entry = nested[0];
            names.push(entry.name);
            nested = children.get(entry.path);
          }
          if (names.length > 1) entry = { ...entry, name: names.join("/") };
        }
        visible.push({ entry, depth });
        if (entry.kind === "tree" && expanded.has(entry.path)) append(entry.path, depth + 1);
      }
    };
    if (expanded.has("")) append("", 1);
    return visible;
  }, [children, compactDirectories, expanded, foldersAlwaysOnTop, sortKey]);

  const toggle = (path: string): void => {
    const opening = !expanded.has(path);
    setExpanded((current) => {
      const next = new Set(current);
      if (opening) next.add(path);
      else next.delete(path);
      return next;
    });
    if (opening) void loadDirectory(path);
  };

  const revealActiveFile = async (): Promise<void> => {
    if (!activePath) {
      setExpanded((current) => new Set(current).add(""));
      setSelectedPath("");
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[data-project-path=""]')?.focus(),
      );
      return;
    }
    const segments = activePath.split("/");
    const parents = segments.slice(0, -1).map((_, index) =>
      segments.slice(0, index + 1).join("/"),
    );
    await Promise.all([loadDirectory(""), ...parents.map(loadDirectory)]);
    setExpanded((current) => new Set([...current, "", ...parents]));
    setSelectedPath(activePath);
    window.requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          `[data-project-path="${CSS.escape(activePath)}"]`,
        )
        ?.focus(),
    );
  };

  useEffect(() => {
    if (!alwaysSelectOpenedFile || !activePath || selectedPath === activePath) return;
    void revealActiveFile();
  }, [activePath, alwaysSelectOpenedFile, selectedPath]);

  const focusRelative = (path: string, offset: number): void => {
    const paths = ["", ...rows.map((row) => row.entry.path)];
    const current = paths.indexOf(path);
    const nextPath = paths[Math.min(paths.length - 1, Math.max(0, current + offset))];
    if (nextPath === undefined) return;
    setSelectedPath(nextPath);
    document.querySelector<HTMLElement>(`[data-project-path="${CSS.escape(nextPath)}"]`)?.focus();
  };

  const onRowKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    entry?: ProjectTreeEntry,
  ): void => {
    const path = entry?.path ?? "";
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusRelative(path, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusRelative(path, event.key === "Home" ? -Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER);
    } else if (event.key === "ArrowRight" && (entry?.kind === "tree" || !entry)) {
      event.preventDefault();
      if (!expanded.has(path)) toggle(path);
      else focusRelative(path, 1);
    } else if (event.key === "ArrowLeft" && expanded.has(path)) {
      event.preventDefault();
      toggle(path);
    } else if (event.key === "Enter" && entry?.kind !== "tree") {
      onOpenFile(path, true);
    }
  };

  return (
    <section aria-label="Project Tool Window" className={tw.projectToolWindow}>
      <header className={tw.projectToolHeader}>
        <button aria-label="Project" title="Project"><strong>Project</strong></button>
        <span />
        <button aria-label="New File or Directory…" onClick={onNew} title="New File or Directory…">
          <Icon name="plus" size={14} />
        </button>
        <button
          aria-label="Select Opened File (⌥F1, 1)"
          onClick={() => void revealActiveFile()}
          title="Select Opened File"
        >
          <Icon name="checkout" size={14} />
        </button>
        <button
          aria-label="Expand Selected"
          onClick={() => {
            if (selectedPath === "") {
              if (!expanded.has("")) toggle("");
              return;
            }
            const selected = rows.find((row) => row.entry.path === selectedPath)?.entry;
            if (selected?.kind === "tree" && !expanded.has(selectedPath)) toggle(selectedPath);
          }}
          title="Expand Selected"
        >
          <Icon name="chevron" size={14} />
        </button>
        <button
          aria-label="Collapse All"
          onClick={() => setExpanded(new Set())}
          title="Collapse All"
        >
          <Icon name="minus" size={14} />
        </button>
        <Popover
          alignment="end"
          hasAutoFocus
          isOpen={optionsOpen}
          label="Project View Options"
          onOpenChange={setOptionsOpen}
          placement="below"
          width={286}
          content={
            <div className={tw.projectViewOptions}>
              <strong>Behavior</strong>
              <CheckboxInput
                label="Open Files with Single Click"
                onChange={setOpenFilesWithSingleClick}
                size="sm"
                value={openFilesWithSingleClick}
              />
              <CheckboxInput
                label="Always Select Opened File"
                onChange={setAlwaysSelectOpenedFile}
                size="sm"
                value={alwaysSelectOpenedFile}
              />
              <strong>Appearance</strong>
              <CheckboxInput
                label="Scratches and Consoles"
                onChange={setShowScratches}
                size="sm"
                value={showScratches}
              />
              <CheckboxInput
                label="Compact Directories"
                onChange={setCompactDirectories}
                size="sm"
                value={compactDirectories}
              />
              <strong>Sort</strong>
              <Selector
                isLabelHidden
                label="Sort project files"
                onChange={(value) => {
                  if (isProjectSortKey(value)) setSortKey(value);
                }}
                options={[
                  { value: "name", label: "Name" },
                  { value: "type", label: "Type" },
                ]}
                placement="below"
                size="sm"
                value={sortKey}
                width="100%"
              />
              <CheckboxInput
                label="Folders Always on Top"
                onChange={setFoldersAlwaysOnTop}
                size="sm"
                value={foldersAlwaysOnTop}
              />
            </div>
          }
        >
          <button aria-label="Options" title="Options">
            <Icon name="more" size={14} />
          </button>
        </Popover>
        <button aria-label="Hide" onClick={onClose} title="Hide">
          <Icon name="close" size={13} />
        </button>
      </header>
      <div aria-label="Project structure tree" className={tw.projectTree} role="tree">
        <button
          aria-expanded={expanded.has("")}
          aria-level={1}
          aria-selected={selectedPath === ""}
          className={tw.projectTreeRow}
          data-project-path=""
          onClick={() => {
            setSelectedPath("");
            toggle("");
          }}
          onKeyDown={(event) => onRowKeyDown(event)}
          role="treeitem"
          style={{ "--tree-depth": 0 } as React.CSSProperties}
        >
          <Icon className={expanded.has("") ? tw.rotated : undefined} name="chevron" size={12} />
          <Icon className={tw.projectFolderIcon} name="folder" size={15} />
          <span className={tw.projectRootLabel}>
            <strong>{repositoryName}</strong>
            <small>{repositoryPath}</small>
          </span>
          <small>{loading.has("") ? "Loading…" : ""}</small>
        </button>
        {rows.map(({ entry, depth }) => {
          const directory = entry.kind === "tree";
          const label = statusLabel(entry.status);
          return (
            <button
              aria-expanded={directory ? expanded.has(entry.path) : undefined}
              aria-level={depth + 1}
              aria-selected={selectedPath === entry.path}
              className={tw.projectTreeRow}
              data-project-path={entry.path}
              key={entry.path}
              onClick={() => {
                setSelectedPath(entry.path);
                if (directory) toggle(entry.path);
                else if (openFilesWithSingleClick) onOpenFile(entry.path, false);
              }}
              onDoubleClick={() => !directory && onOpenFile(entry.path, true)}
              onKeyDown={(event) => onRowKeyDown(event, entry)}
              role="treeitem"
              style={{ "--tree-depth": depth } as React.CSSProperties}
              title={entry.path}
            >
              {directory ? (
                <Icon
                  className={expanded.has(entry.path) ? tw.rotated : undefined}
                  name="chevron"
                  size={12}
                />
              ) : (
                <span className={tw.projectTreeIndent} />
              )}
              <Icon
                className={directory ? tw.projectFolderIcon : tw.projectFileIcon}
                name={directory ? "folder" : "file"}
                size={15}
              />
              <span>{entry.name}</span>
              {loading.has(entry.path) && <small>Loading…</small>}
              {label && <em data-status={entry.status}>{label}</em>}
            </button>
          );
        })}
        {error && <p className={tw.projectTreeError}>{error}</p>}
        {showScratches && (
          <button
            aria-expanded={scratchesExpanded}
            aria-level={1}
            aria-selected="false"
            className={tw.projectScratches}
            onClick={() => setScratchesExpanded((value) => !value)}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onNewScratch();
            }}
            role="treeitem"
            title="Scratches and Consoles"
          >
            <Icon className={scratchesExpanded ? tw.rotated : undefined} name="chevron" size={12} />
            <Icon name="folder" size={14} />
            <span>Scratches and Consoles</span>
          </button>
        )}
        {showScratches && scratchesExpanded && scratches.map((scratch) => (
          <button
            aria-level={2}
            className={tw.projectScratchFile}
            key={scratch.id}
            onDoubleClick={() => onOpenScratch(scratch)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onOpenScratch(scratch);
            }}
            role="treeitem"
            title={scratch.name}
          >
            <span />
            <Icon name="file" size={14} />
            <span>{scratch.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
