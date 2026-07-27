import { Button } from "@base-ui/react/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkoutTarget, deleteRefOperation } from "../domain/refActions";
import type { Ref } from "../domain/types";
import { cn } from "../lib/utils";
import type { BranchComparison, GitOperation, RemoteInfo } from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui";

interface BranchPopupRow {
  readonly ref: Ref;
  readonly label: string;
}

export function GitBranchesPopup({
  refs,
  currentBranch,
  onCheckout,
  onOperation,
  onCompare,
  onCommit,
  remotes = [],
  onOpenSettings,
  onClose,
}: {
  readonly refs: readonly Ref[];
  readonly currentBranch?: string | null;
  readonly onCheckout: (target: string) => Promise<void>;
  readonly onOperation?: (operation: GitOperation) => Promise<void>;
  readonly onCompare?: (left: string, right: string) => Promise<BranchComparison>;
  readonly onCommit?: () => void;
  readonly remotes?: readonly RemoteInfo[];
  readonly onOpenSettings: () => void;
  readonly onClose: () => void;
}) {
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [comparison, setComparison] = useState<BranchComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const dialog = useAppDialog();
  const normalizedQuery = query.trim().toLowerCase();
  const rows = useMemo<readonly BranchPopupRow[]>(
    () =>
      refs
        .filter((ref) => !normalizedQuery || ref.shortName.toLowerCase().includes(normalizedQuery))
        .sort((left, right) => {
          if (left.current !== right.current) return left.current ? -1 : 1;
          if (left.kind !== right.kind) {
            const order = { local: 0, remote: 1, tag: 2 } as const;
            return order[left.kind] - order[right.kind];
          }
          return left.shortName.localeCompare(right.shortName, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        })
        .map((ref) => ({ ref, label: ref.shortName })),
    [normalizedQuery, refs],
  );

  useDismissLayer(
    useMemo(
      () => ({
        id: "git-branches-popup",
        priority: 115,
        active: true,
        dismiss: onClose,
      }),
      [onClose],
    ),
  );

  useEffect(() => {
    search.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const checkoutActive = async (): Promise<void> => {
    const row = rows[activeIndex];
    if (!row || row.ref.current) return;
    setBusy(true);
    setError(null);
    try {
      await onCheckout(checkoutTarget(row.ref));
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const activeRef = rows[activeIndex]?.ref ?? null;
  const actionMatches = (label: string): boolean =>
    !normalizedQuery || label.toLowerCase().includes(normalizedQuery);

  const run = async (operation: GitOperation, close = true): Promise<void> => {
    if (!onOperation) {
      onClose();
      onOpenSettings();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onOperation(operation);
      if (close) onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const createBranch = async (): Promise<void> => {
    const name = await dialog.input({
      title: "New Branch",
      label: "Branch name",
      description: `Start point: ${activeRef?.shortName ?? "HEAD"}`,
      placeholder: "feature/name",
      confirmLabel: "Create",
    });
    if (!name) return;
    await run({
      kind: "createBranch",
      name,
      startPoint: activeRef?.name ?? "HEAD",
      checkout: true,
    });
  };

  const checkoutRevision = async (): Promise<void> => {
    const target = await dialog.input({
      title: "Checkout Tag or Revision",
      label: "Tag or revision",
      initialValue: activeRef?.shortName ?? "",
      confirmLabel: "Checkout",
    });
    if (!target) return;
    await onCheckout(target);
    onClose();
  };

  const renameActive = async (): Promise<void> => {
    if (activeRef?.kind !== "local") return;
    const name = await dialog.input({
      title: `Rename ${activeRef.shortName}`,
      label: "New branch name",
      initialValue: activeRef.shortName,
      confirmLabel: "Rename",
    });
    if (!name || name === activeRef.shortName) return;
    await run({
      kind: "renameBranch",
      oldName: activeRef.shortName,
      newName: name,
    });
  };

  const createTag = async (): Promise<void> => {
    const name = await dialog.input({
      title: "New Tag",
      label: "Tag name",
      description: `Revision: ${activeRef?.shortName ?? "HEAD"}`,
      placeholder: "v1.0.0",
      confirmLabel: "Create",
    });
    if (!name) return;
    const message = await dialog.input({
      title: `Tag ${name}`,
      label: "Annotation (optional)",
      allowEmpty: true,
      confirmLabel: "Create Tag",
    });
    if (message === null) return;
    await run({
      kind: "createTag",
      name,
      revision: activeRef?.name ?? "HEAD",
      message: message || null,
    });
  };

  const setUpstream = async (): Promise<void> => {
    if (activeRef?.kind !== "local") return;
    const upstream = await dialog.input({
      title: `Set Upstream for ${activeRef.shortName}`,
      label: "Upstream branch",
      initialValue: activeRef.upstream?.replace(/^refs\/remotes\//, "") ?? "origin/",
      placeholder: "origin/main",
      confirmLabel: "Set Upstream",
    });
    if (!upstream) return;
    await run({
      kind: "setUpstream",
      branch: activeRef.shortName,
      upstream,
    });
  };

  const addWorktree = async (): Promise<void> => {
    const path = await dialog.input({
      title: "New Worktree",
      label: "Absolute worktree path",
      confirmLabel: "Next",
    });
    if (!path) return;
    const branch = await dialog.input({
      title: "New Worktree",
      label: "New branch (optional)",
      allowEmpty: true,
      description: "Leave empty to check out the selected reference in detached mode.",
      confirmLabel: "Add Worktree",
    });
    if (branch === null) return;
    await run({
      kind: "worktreeAdd",
      path,
      branch: branch || null,
      startPoint: activeRef?.name ?? "HEAD",
    });
  };

  const pushActiveTag = async (): Promise<void> => {
    if (activeRef?.kind !== "tag" || !remotes[0]) return;
    await run({
      kind: "pushTag",
      remote: remotes[0].name,
      name: activeRef.shortName,
    });
  };

  const deleteActive = async (): Promise<void> => {
    if (!activeRef || activeRef.current) return;
    const accepted = await dialog.confirm({
      title: `Delete ${activeRef.shortName}?`,
      description:
        activeRef.kind === "remote"
          ? "Deletes the branch from its remote."
          : `Deletes the selected ${activeRef.kind}.`,
      impact: activeRef.subject,
      confirmLabel: "Delete",
      dangerous: true,
    });
    if (!accepted) return;
    const operation = deleteRefOperation(activeRef);
    if (operation) await run(operation);
  };

  const compareActive = async (): Promise<void> => {
    if (!onCompare || !currentBranch || !activeRef) return;
    setBusy(true);
    setError(null);
    try {
      setComparison(await onCompare(currentBranch, activeRef.name));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      aria-label="Git Branches"
      className={tw.gitBranchesPopup}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex((current) => {
            const offset = event.key === "ArrowDown" ? 1 : -1;
            return (current + offset + rows.length) % Math.max(1, rows.length);
          });
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          setActiveIndex(event.key === "Home" ? 0 : Math.max(0, rows.length - 1));
        } else if (event.key === "Enter") {
          event.preventDefault();
          void checkoutActive();
        } else if (event.key === " ") {
          event.preventDefault();
          void checkoutActive();
        } else if (event.key === "ArrowRight" && activeRef) {
          event.preventDefault();
          setDetailsOpen(true);
        } else if (event.key === "ArrowLeft" && detailsOpen) {
          event.preventDefault();
          setDetailsOpen(false);
        }
      }}
      role="dialog"
    >
      <div className={tw.gitBranchesSearch}>
        <label>
          <Icon name="search" size={14} />
          <input
            aria-activedescendant={rows[activeIndex] ? `branch-${activeIndex}` : undefined}
            aria-controls="git-branches-list"
            aria-label="Search"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setDetailsOpen(false);
            }}
            placeholder="Search for branches and actions"
            ref={search}
            role="textbox"
            value={query}
          />
        </label>
        <div aria-label="Action Toolbar" data-branch-toolbar="true" role="toolbar">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  data-slot="button"
                  aria-label="Fetch"
                  disabled={busy}
                  onClick={() => void run({ kind: "fetch", remote: null, prune: false }, false)}
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon name="fetch" size={14} />
                </Button>
              }
            />
            <TooltipContent>Fetch</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  data-slot="button"
                  aria-label="Settings"
                  onClick={onOpenSettings}
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon name="settings" size={14} />
                </Button>
              }
            />
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div
        aria-label="Branches Tree"
        className={tw.gitBranchesList}
        id="git-branches-list"
        role="tree"
      >
        {actionMatches("Commit…") && (
          <Button
            data-slot="button"
            data-branch-action="true"
            disabled={busy}
            onClick={() => {
              onClose();
              onCommit?.();
            }}
            role="treeitem"
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[29px] w-full justify-start whitespace-normal rounded-sm px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent aria-expanded:text-foreground",
            )}
          >
            <Icon name="commit" size={14} />
            <span>Commit…</span>
            <kbd>⌘K</kbd>
          </Button>
        )}
        <div role="separator" />
        {actionMatches("New Branch…") && (
          <Button
            data-slot="button"
            data-branch-action="true"
            disabled={busy}
            onClick={() => void createBranch()}
            role="treeitem"
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[29px] w-full justify-start whitespace-normal rounded-sm px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent aria-expanded:text-foreground",
            )}
          >
            <Icon name="plus" size={14} />
            <span>New Branch…</span>
            <kbd>⌥⌘N</kbd>
          </Button>
        )}
        {actionMatches("Checkout Tag or Revision…") && (
          <Button
            data-slot="button"
            data-branch-action="true"
            disabled={busy}
            onClick={() => void checkoutRevision()}
            role="treeitem"
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[29px] w-full justify-start whitespace-normal rounded-sm px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent aria-expanded:text-foreground",
            )}
          >
            <Icon name="checkout" size={14} />
            <span>Checkout Tag or Revision…</span>
          </Button>
        )}
        <div role="separator" />
        {(["local", "remote", "tag"] as const).map((kind) => {
          const group = rows
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => row.ref.kind === kind);
          if (group.length === 0) return null;
          const label = kind === "local" ? "Local" : kind === "remote" ? "Remote" : "Tags";
          return (
            <div key={kind} role="none">
              <div aria-expanded="true" data-branch-group="true" role="treeitem">
                <Icon className={tw.rotated} name="chevron" size={11} />
                <span>{label}</span>
              </div>
              <div role="group">
                {group.map(({ row, index }) => (
                  <Tooltip key={row.ref.name}>
                    <TooltipTrigger
                      render={
                        <Button
                          data-slot="button"
                          aria-selected={index === activeIndex}
                          id={`branch-${index}`}
                          onClick={() => {
                            if (index === activeIndex) setDetailsOpen(true);
                            else {
                              setActiveIndex(index);
                              setDetailsOpen(false);
                            }
                          }}
                          onDoubleClick={() => void checkoutActive()}
                          onMouseEnter={() => setActiveIndex(index)}
                          role="treeitem"
                          type="button"
                          className={cn(
                            "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[29px] w-full justify-start whitespace-normal rounded-sm px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent aria-expanded:text-foreground",
                            index === activeIndex ? tw.selected : undefined,
                          )}
                        >
                          <Icon
                            name={
                              row.ref.kind === "remote"
                                ? "remote"
                                : row.ref.kind === "tag"
                                  ? "tag"
                                  : "branch"
                            }
                            size={14}
                          />
                          <span>{row.label}</span>
                          {row.ref.favorite && (
                            <Icon className={tw.favorite} name="star" size={12} />
                          )}
                          {(row.ref.current || row.ref.shortName === currentBranch) && (
                            <small>
                              {row.ref.upstream?.replace(/^refs\/remotes\//, "") ?? "Current"}
                            </small>
                          )}
                          <Icon name="chevron" size={10} />
                        </Button>
                      }
                    />
                    <TooltipContent>{row.ref.subject}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p>No branches found</p>}
      </div>
      {error && (
        <p className={tw.gitBranchesError} role="alert">
          {error}
        </p>
      )}
      {detailsOpen && activeRef && (
        <div
          className={tw.gitBranchSelectedActions}
          aria-label={`Actions for ${activeRef.shortName}`}
        >
          <Button
            data-slot="button"
            disabled={activeRef.current || busy}
            onClick={() => void checkoutActive()}
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
            )}
          >
            Checkout
          </Button>
          <Button
            data-slot="button"
            disabled={busy}
            onClick={() => void createBranch()}
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
            )}
          >
            New Branch from…
          </Button>
          <Button
            data-slot="button"
            disabled={!onCompare || !currentBranch || activeRef.current || busy}
            onClick={() => void compareActive()}
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
            )}
          >
            Compare
          </Button>
          {activeRef.kind === "local" && (
            <Button
              data-slot="button"
              disabled={busy}
              onClick={() => void renameActive()}
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
              )}
            >
              Rename…
            </Button>
          )}
          {activeRef.kind === "local" && (
            <Button
              data-slot="button"
              disabled={busy}
              onClick={() => void setUpstream()}
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
              )}
            >
              Set Upstream…
            </Button>
          )}
          <Button
            data-slot="button"
            disabled={busy || !onOperation}
            onClick={() => void createTag()}
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
            )}
          >
            New Tag…
          </Button>
          {activeRef.kind === "tag" && (
            <Button
              data-slot="button"
              disabled={busy || remotes.length === 0}
              onClick={() => void pushActiveTag()}
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
              )}
            >
              Push Tag
            </Button>
          )}
          <Button
            data-slot="button"
            disabled={busy || !onOperation}
            onClick={() => void addWorktree()}
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
            )}
          >
            New Worktree…
          </Button>
          <Button
            data-slot="button"
            disabled={activeRef.current || busy || !onOperation}
            onClick={() => void deleteActive()}
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[25px] px-1.5 text-muted-foreground hover:text-foreground",
            )}
          >
            Delete…
          </Button>
        </div>
      )}
      {comparison && activeRef && (
        <div className={tw.gitBranchComparison} role="status">
          <strong>
            {currentBranch} ↔ {activeRef.shortName}
          </strong>
          <span>
            {comparison.ahead} ahead · {comparison.behind} behind
          </span>
        </div>
      )}
      {dialog.node}
    </div>
  );
}
