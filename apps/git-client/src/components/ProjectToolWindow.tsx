import { Button } from "@jongminchung/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  mergeProjectTreeEntries,
  type ProjectTreeEntry,
} from "../domain/projectTree";
import type { ScratchFile } from "../domain/scratchFiles";
import type { FileChange, TreeEntry } from "../domain/types";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
import { CheckboxInput, Selector } from "./ProductFormControls";
import { Popover } from "./ProductOverlays";
import { VerticalResizeHandle } from "./VerticalResizeHandle";

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
      const leftExtension =
        left.kind === "tree" ? "" : (left.name.split(".").at(-1) ?? "");
      const rightExtension =
        right.kind === "tree" ? "" : (right.name.split(".").at(-1) ?? "");
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
  width,
  onWidthChange,
}: {
  readonly activePath?: string;
  readonly repositoryName: string;
  readonly repositoryPath: string;
  readonly hasCommits: boolean;
  readonly changes: readonly FileChange[];
  readonly loadTree: (
    revision: string,
    path?: string,
  ) => Promise<readonly TreeEntry[]>;
  readonly onOpenFile: (path: string, keepOpen?: boolean) => void;
  readonly onNew: () => void;
  readonly onNewScratch: () => void;
  readonly onOpenScratch: (scratch: ScratchFile) => void;
  readonly onClose: () => void;
  readonly scratches: readonly ScratchFile[];
  readonly width: number;
  readonly onWidthChange: (width: number) => void;
}) {
  const [children, setChildren] = useState<
    ReadonlyMap<string, readonly ProjectTreeEntry[]>
  >(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set([""]));
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState("");
  const [error, setError] = useState<string>();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [openFilesWithSingleClick, setOpenFilesWithSingleClick] =
    useState(false);
  const [alwaysSelectOpenedFile, setAlwaysSelectOpenedFile] = useState(false);
  const [showScratches, setShowScratches] = useState(true);
  const [scratchesExpanded, setScratchesExpanded] = useState(false);
  const [compactDirectories, setCompactDirectories] = useState(true);
  const [foldersAlwaysOnTop, setFoldersAlwaysOnTop] = useState(true);
  const [sortKey, setSortKey] = useState<ProjectSortKey>("name");
  const loadGenerationRef = useRef(0);

  const loadDirectory = useCallback(
    async (path: string): Promise<void> => {
      if (children.has(path) || loading.has(path)) return;
      const generation = loadGenerationRef.current;
      setLoading((current) => new Set(current).add(path));
      setError(undefined);
      try {
        const tracked = hasCommits
          ? await loadTree("HEAD", path || undefined)
          : [];
        if (generation !== loadGenerationRef.current) return;
        const entries = mergeProjectTreeEntries(path, tracked, changes);
        setChildren((current) => new Map(current).set(path, entries));
      } catch (reason) {
        if (generation !== loadGenerationRef.current) return;
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        if (generation === loadGenerationRef.current) {
          setLoading((current) => {
            const next = new Set(current);
            next.delete(path);
            return next;
          });
        }
      }
    },
    [changes, children, hasCommits, loadTree, loading],
  );

  const changeFingerprint = useMemo(
    () =>
      changes
        .map(
          (change) =>
            `${change.path}:${change.status}:${change.staged}:${change.worktree}`,
        )
        .join("\0"),
    [changes],
  );

  useEffect(() => {
    loadGenerationRef.current += 1;
    setChildren(new Map());
    setLoading(new Set());
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
        if (entry.kind === "tree" && expanded.has(entry.path))
          append(entry.path, depth + 1);
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

  const revealActiveFile = useCallback(async (): Promise<void> => {
    if (!activePath) {
      setExpanded((current) => new Set(current).add(""));
      setSelectedPath("");
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[data-project-path=""]')?.focus(),
      );
      return;
    }
    const segments = activePath.split("/");
    const parents = segments
      .slice(0, -1)
      .map((_, index) => segments.slice(0, index + 1).join("/"));
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
  }, [activePath, loadDirectory]);

  useEffect(() => {
    if (!alwaysSelectOpenedFile || !activePath || selectedPath === activePath)
      return;
    void revealActiveFile();
  }, [activePath, alwaysSelectOpenedFile, selectedPath, revealActiveFile]);

  const focusRelative = (path: string, offset: number): void => {
    const paths = ["", ...rows.map((row) => row.entry.path)];
    const current = paths.indexOf(path);
    const nextPath =
      paths[Math.min(paths.length - 1, Math.max(0, current + offset))];
    if (nextPath === undefined) return;
    setSelectedPath(nextPath);
    document
      .querySelector<HTMLElement>(
        `[data-project-path="${CSS.escape(nextPath)}"]`,
      )
      ?.focus();
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
      focusRelative(
        path,
        event.key === "Home"
          ? -Number.MAX_SAFE_INTEGER
          : Number.MAX_SAFE_INTEGER,
      );
    } else if (
      event.key === "ArrowRight" &&
      (entry?.kind === "tree" || !entry)
    ) {
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
    <section
      aria-label="Project Tool Window"
      className={`projectToolWindow projectToolWindow [position:relative] [display:grid] [min-height:0] [min-width:0] [grid-template-rows:34px_minmax(0,_1fr)] [overflow:hidden] rounded-lg [background:var(--card)] [&>_.verticalResizeHandle]:[right:0] [html[data-distraction-free-mode=true]_&]:hidden! [html[data-presentation-mode=true]_&]:hidden!`}
    >
      <VerticalResizeHandle
        direction={1}
        label="Resize Project tool window"
        onChange={onWidthChange}
        value={width}
      />
      <header
        className={`projectToolHeader projectToolHeader [display:flex] [align-items:center] [padding:0_3px_0_6px] [border-bottom:1px_solid_var(--border)] [&>_button]:[display:flex] [&>_button]:[height:24px] [&>_button]:[width:24px] [&>_button]:[align-items:center] [&>_button]:[justify-content:center] [&>_button]:rounded-sm [&>_button]:[color:var(--muted-foreground)] [&>_button]:[background:transparent] [&>_button:first-child]:[width:auto] [&>_button:first-child]:[padding:0_4px] [&>_button:first-child]:[font-size:12px] [&>_button:first-child]:[color:var(--foreground)] [&>_button:hover]:[color:var(--foreground)] [&>_button:hover]:[background:var(--muted)] [&>_span]:[flex:1]`}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Project"
                type="button"
                className={cn(
                  "min-h-[26px] min-w-[26px] gap-1.5 p-1 text-xs text-muted-foreground",
                )}
                variant="ghost"
                size="xs"
              >
                <strong>Project</strong>
              </Button>
            }
          />
          <TooltipContent>Project</TooltipContent>
        </Tooltip>
        <span />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="New File or Directory…"
                onClick={onNew}
                type="button"
                className={cn(
                  "min-h-[26px] min-w-[26px] gap-1.5 p-1 text-xs text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
              >
                <Icon name="plus" size={14} />
              </Button>
            }
          />
          <TooltipContent>New File or Directory…</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Select Opened File (⌥F1, 1)"
                disabled={!activePath}
                onClick={() => void revealActiveFile()}
                type="button"
                className={cn(
                  "min-h-[26px] min-w-[26px] gap-1.5 p-1 text-xs text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
              >
                <Icon name="checkout" size={14} />
              </Button>
            }
          />
          <TooltipContent>Select Opened File (⌥F1, 1)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Expand Selected"
                onClick={() => {
                  if (selectedPath === "") {
                    if (!expanded.has("")) toggle("");
                    return;
                  }
                  const selected = rows.find(
                    (row) => row.entry.path === selectedPath,
                  )?.entry;
                  if (selected?.kind === "tree" && !expanded.has(selectedPath))
                    toggle(selectedPath);
                }}
                type="button"
                className={cn(
                  "min-h-[26px] min-w-[26px] gap-1.5 p-1 text-xs text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
              >
                <Icon name="chevron" size={14} />
              </Button>
            }
          />
          <TooltipContent>Expand Selected</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Collapse All"
                onClick={() => setExpanded(new Set())}
                type="button"
                className={cn(
                  "min-h-[26px] min-w-[26px] gap-1.5 p-1 text-xs text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
              >
                <Icon name="minus" size={14} />
              </Button>
            }
          />
          <TooltipContent>Collapse All</TooltipContent>
        </Tooltip>
        <Tooltip>
          <Popover
            alignment="end"
            hasAutoFocus
            isOpen={optionsOpen}
            label="Project View Options"
            onOpenChange={setOptionsOpen}
            placement="below"
            width={286}
            content={
              <div
                className={`projectViewOptions projectViewOptions [display:grid] [gap:3px] [padding:5px] [&>_strong]:[margin:5px_6px_2px] [&>_strong]:[font-size:10px] [&>_strong]:[font-weight:600] [&>_strong]:[color:var(--muted-foreground)] [&>_strong:not(:first-child)]:[padding-top:7px] [&>_strong:not(:first-child)]:[border-top:1px_solid_var(--border)]`}
              >
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
            <TooltipTrigger
              render={
                <Button
                  aria-label="Options"
                  type="button"
                  className={cn(
                    "min-h-[26px] min-w-[26px] gap-1.5 p-1 text-xs text-muted-foreground",
                  )}
                  variant="ghost"
                  size="icon-sm"
                >
                  <Icon name="more" size={14} />
                </Button>
              }
            />
          </Popover>
          <TooltipContent>Options</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Hide"
                onClick={onClose}
                type="button"
                className={cn(
                  "min-h-[26px] min-w-[26px] gap-1.5 p-1 text-xs text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
              >
                <Icon name="close" size={13} />
              </Button>
            }
          />
          <TooltipContent>Hide</TooltipContent>
        </Tooltip>
      </header>
      <div
        aria-label="Project structure tree"
        className={`projectTree projectTree [min-height:0] [overflow:auto] [padding:3px_0]`}
        role="tree"
      >
        <Button
          aria-label={`${repositoryName}  ${repositoryPath}`}
          aria-expanded={expanded.has("")}
          aria-level={1}
          aria-selected={selectedPath === ""}
          data-project-path=""
          onClick={() => {
            setSelectedPath("");
            toggle("");
          }}
          onKeyDown={(event) => onRowKeyDown(event)}
          role="treeitem"
          style={{ "--tree-depth": 0 } as React.CSSProperties}
          type="button"
          className={cn(
            "grid min-h-0 text-left text-xs whitespace-normal aria-current:bg-muted! aria-selected:bg-muted!",
            `projectTreeRow projectTreeRow [display:grid] [height:20px] [width:100%] [grid-template-columns:14px_16px_minmax(0,_1fr)_auto] [align-items:center] [gap:4px] [padding:0_7px_0_calc(7px_+_var(--tree-depth)_*_14px)] [text-align:left] [font-size:12px] [color:var(--foreground)] [background:transparent] [border:0] [&_em]:[font-size:10px] [&_em]:[color:var(--primary)] [&_em]:[font-style:normal] [&_em[data-status=conflicted]]:[color:var(--destructive)] [&_em[data-status=deleted]]:[color:var(--destructive)] [&_em[data-status=untracked]]:[color:var(--success)] [&_small]:[font-size:9px] [&_small]:[color:var(--disabled-foreground)] [&:hover]:[background:var(--overlay-hover)] [&>_span:nth-child(3)]:[overflow:hidden] [&>_span:nth-child(3)]:[text-overflow:ellipsis] [&>_span:nth-child(3)]:[white-space:nowrap] [&[aria-selected=true]]:[background:var(--accent)] [html[data-compact=true]_&]:h-[22px]!`,
          )}
          variant="ghost"
          size="default"
          tabIndex={-1}
        >
          <Icon
            className={
              expanded.has("")
                ? `rotated rotated [transform:rotate(90deg)]`
                : undefined
            }
            name="chevron"
            size={12}
          />
          <Icon
            className={`projectFolderIcon projectFolderIcon [color:var(--project-folder)]`}
            name="folder"
            size={15}
          />
          <span
            className={`projectRootLabel projectRootLabel [display:flex]! [align-items:center] [gap:5px] [&_small]:[overflow:hidden] [&_small]:[font-size:10px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&_small]:[color:var(--disabled-foreground)] [&_strong]:[font-weight:600]`}
          >
            <strong>{repositoryName}</strong>
            <small>{repositoryPath}</small>
          </span>
          <small>{loading.has("") ? "Loading…" : ""}</small>
        </Button>
        {rows.map(({ entry, depth }) => {
          const directory = entry.kind === "tree";
          const label = statusLabel(entry.status);
          return (
            <Tooltip key={entry.path}>
              <TooltipTrigger
                render={
                  <Button
                    aria-expanded={
                      directory ? expanded.has(entry.path) : undefined
                    }
                    aria-level={depth + 1}
                    aria-selected={selectedPath === entry.path}
                    data-project-path={entry.path}
                    onClick={() => {
                      setSelectedPath(entry.path);
                      if (directory) toggle(entry.path);
                      else if (openFilesWithSingleClick)
                        onOpenFile(entry.path, false);
                    }}
                    onDoubleClick={() =>
                      !directory && onOpenFile(entry.path, true)
                    }
                    onKeyDown={(event) => onRowKeyDown(event, entry)}
                    role="treeitem"
                    style={
                      {
                        "--tree-depth": depth,
                      } as React.CSSProperties
                    }
                    type="button"
                    className={cn(
                      "grid min-h-0 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
                      `projectTreeRow projectTreeRow [display:grid] [height:20px] [width:100%] [grid-template-columns:14px_16px_minmax(0,_1fr)_auto] [align-items:center] [gap:4px] [padding:0_7px_0_calc(7px_+_var(--tree-depth)_*_14px)] [text-align:left] [font-size:12px] [color:var(--foreground)] [background:transparent] [border:0] [&_em]:[font-size:10px] [&_em]:[color:var(--primary)] [&_em]:[font-style:normal] [&_em[data-status=conflicted]]:[color:var(--destructive)] [&_em[data-status=deleted]]:[color:var(--destructive)] [&_em[data-status=untracked]]:[color:var(--success)] [&_small]:[font-size:9px] [&_small]:[color:var(--disabled-foreground)] [&:hover]:[background:var(--overlay-hover)] [&>_span:nth-child(3)]:[overflow:hidden] [&>_span:nth-child(3)]:[text-overflow:ellipsis] [&>_span:nth-child(3)]:[white-space:nowrap] [&[aria-selected=true]]:[background:var(--accent)] [html[data-compact=true]_&]:h-[22px]!`,
                    )}
                    variant="ghost"
                    size="default"
                    tabIndex={-1}
                  >
                    {directory ? (
                      <Icon
                        className={
                          expanded.has(entry.path)
                            ? `rotated rotated [transform:rotate(90deg)]`
                            : undefined
                        }
                        name="chevron"
                        size={12}
                      />
                    ) : (
                      <span
                        className={`projectTreeIndent projectTreeIndent [display:block] [height:12px] [width:12px]`}
                      />
                    )}
                    <Icon
                      className={
                        directory
                          ? `projectFolderIcon projectFolderIcon [color:var(--project-folder)]`
                          : `projectFileIcon projectFileIcon [color:var(--muted-foreground)]`
                      }
                      name={directory ? "folder" : "file"}
                      size={15}
                    />
                    <span>{entry.name}</span>
                    {loading.has(entry.path) && <small>Loading…</small>}
                    {label && (
                      <em aria-hidden data-status={entry.status}>
                        {label}
                      </em>
                    )}
                  </Button>
                }
              />
              <TooltipContent>{entry.path}</TooltipContent>
            </Tooltip>
          );
        })}
        {error && (
          <Notice
            className="m-1.5 mx-2.5 w-auto"
            role="alert"
            size="sm"
            tone="destructive"
          >
            {error}
          </Notice>
        )}
        {showScratches && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-expanded={scratchesExpanded}
                  aria-level={1}
                  aria-selected="false"
                  onClick={() => setScratchesExpanded((value) => !value)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onNewScratch();
                  }}
                  role="treeitem"
                  type="button"
                  className={cn(
                    "flex min-h-0 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
                    `projectScratches projectScratches [display:flex] [height:22px] [align-items:center] [gap:4px] [padding:0_8px] [text-align:left] [color:var(--muted-foreground)] [background:transparent]`,
                  )}
                  variant="ghost"
                  size="default"
                  tabIndex={-1}
                >
                  <Icon
                    className={
                      scratchesExpanded
                        ? `rotated rotated [transform:rotate(90deg)]`
                        : undefined
                    }
                    name="chevron"
                    size={12}
                  />
                  <Icon name="folder" size={14} />
                  <span>Scratches and Consoles</span>
                </Button>
              }
            />
            <TooltipContent>Scratches and Consoles</TooltipContent>
          </Tooltip>
        )}
        {showScratches &&
          scratchesExpanded &&
          scratches.map((scratch) => (
            <Tooltip key={scratch.id}>
              <TooltipTrigger
                render={
                  <Button
                    aria-level={2}
                    onDoubleClick={() => onOpenScratch(scratch)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onOpenScratch(scratch);
                    }}
                    role="treeitem"
                    type="button"
                    className={cn(
                      "grid min-h-0 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
                      `projectScratchFile projectScratchFile [display:grid] [height:22px] [width:100%] [grid-template-columns:12px_16px_minmax(0,_1fr)] [align-items:center] [gap:4px] [padding:0_8px] [text-align:left] [background:transparent] [&:focus]:[background:var(--accent)] [&:hover]:[background:var(--muted)] [&>_span:last-child]:[overflow:hidden] [&>_span:last-child]:[text-overflow:ellipsis] [&>_span:last-child]:[white-space:nowrap]`,
                    )}
                    variant="ghost"
                    size="default"
                    tabIndex={-1}
                  >
                    <span />
                    <Icon name="file" size={14} />
                    <span>{scratch.name}</span>
                  </Button>
                }
              />
              <TooltipContent>{scratch.name}</TooltipContent>
            </Tooltip>
          ))}
      </div>
    </section>
  );
}
