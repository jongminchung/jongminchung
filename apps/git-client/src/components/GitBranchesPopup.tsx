import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkoutTarget, deleteRefOperation, mergeRefOperation } from "../domain/refActions";
import type { Ref } from "../domain/types";
import type { BranchComparison, GitOperation, RemoteInfo } from "../shared/contracts/model";
import { useAppDialog } from "./AppDialog";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { Notice } from "./Notice";

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
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const selectedActions = useRef<HTMLDivElement>(null);
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

  const mergeActive = async (): Promise<void> => {
    if (!activeRef || activeRef.current || !currentBranch) return;
    const accepted = await dialog.confirm({
      title: `Merge ${activeRef.shortName} into ${currentBranch}?`,
      description: "Integrates the selected reference into the current branch.",
      impact: activeRef.subject,
      confirmLabel: "Merge",
      dangerous: true,
    });
    if (!accepted) return;
    await run(mergeRefOperation(activeRef));
  };

  const moveFocusWithinPopup = (backward: boolean): void => {
    const elements = popup.current?.querySelectorAll<HTMLElement>(
      'input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    if (!elements || elements.length === 0) return;
    const current = Array.from(elements).findIndex((element) => element === document.activeElement);
    const next =
      current < 0 ? 0 : (current + (backward ? -1 : 1) + elements.length) % elements.length;
    elements[next]?.focus();
  };

  return (
    <div
      aria-busy={busy || undefined}
      aria-label="Git Branches"
      className={`gitBranchesPopup [background:var(--popover)] [border:1px_solid_var(--input)] rounded-lg [box-shadow:var(--shadow-lg)] [display:grid] [grid-template-rows:36px_minmax(120px,_auto)] [left:0] [max-height:min(520px,_calc(100vh_-_70px))] [min-width:368px] [overflow:hidden] [position:absolute] [top:31px] [z-index:100] gitBranchesPopup rounded-lg`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "Tab") {
          event.preventDefault();
          moveFocusWithinPopup(event.shiftKey);
        } else if (event.key === "ArrowLeft" && detailsOpen) {
          event.preventDefault();
          setDetailsOpen(false);
          search.current?.focus();
        } else if (event.target instanceof HTMLElement && event.target.closest("button") !== null) {
          return;
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
          window.requestAnimationFrame(() =>
            selectedActions.current
              ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
              ?.focus(),
          );
        }
      }}
      ref={popup}
      role="dialog"
    >
      <div
        className={`gitBranchesSearch [align-items:center] [border-bottom:1px_solid_var(--border)] [display:grid] [gap:5px] [grid-template-columns:minmax(0,_1fr)_auto] [padding:4px_5px] [&>_label]:[align-items:center] [&>_label]:[background:var(--secondary)] [&>_label]:[border:1px_solid_var(--border)] [&>_label]:rounded-sm [&>_label]:[display:flex] [&>_label]:[gap:5px] [&>_label]:[padding:0_6px] [&>_label:focus-within]:[border-color:var(--primary)] [&_input]:[background:transparent] [&_input]:[border:0] [&_input]:[height:25px] [&_input]:[min-width:0] [&_input]:[outline:0] [&_input]:[width:100%] [&_[role=toolbar]]:[display:flex] [&_[role=toolbar]_button]:[align-items:center] [&_[role=toolbar]_button]:[background:transparent] [&_[role=toolbar]_button]:[display:flex] [&_[role=toolbar]_button]:[height:26px] [&_[role=toolbar]_button]:[justify-content:center] [&_[role=toolbar]_button]:[width:26px] gitBranchesSearch [&>_label]:rounded-sm`}
      >
        <label>
          <Icon name="search" size={14} />
          <Input
            aria-activedescendant={rows[activeIndex] ? `branch-${activeIndex}` : undefined}
            aria-controls="git-branches-list"
            aria-label="Search"
            autoFocus
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
                  aria-label="Fetch"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      {
                        kind: "fetch",
                        remote: null,
                        prune: false,
                      },
                      false,
                    )
                  }
                  type="button"
                  className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
                  variant="ghost"
                  size="default"
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
                  aria-label="Settings"
                  onClick={onOpenSettings}
                  type="button"
                  className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
                  variant="ghost"
                  size="default"
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
        className={`gitBranchesList [min-height:0] [overflow:auto] [padding:4px] [&_[role=separator]]:[border-top:1px_solid_var(--border)] [&_[role=separator]]:[height:5px] [&_[role=separator]]:[margin-top:4px] [&_[role=treeitem]]:[align-items:center] [&_[role=treeitem]]:[background:transparent] [&_[role=treeitem]]:rounded-sm [&_[role=treeitem]]:[display:grid] [&_[role=treeitem]]:[gap:6px] [&_[role=treeitem]]:[grid-template-columns:17px_minmax(0,_1fr)_auto_auto] [&_[role=treeitem]]:[height:27px] [&_[role=treeitem]]:[padding:0_7px] [&_[role=treeitem]]:[text-align:left] [&_[role=treeitem]]:[width:100%] [&_[role=treeitem]:hover]:[background:var(--muted)] [&_[role=treeitem][aria-selected=true]]:[background:var(--accent)] [&_[role=group]_[role=treeitem]]:[padding-left:25px] [&_[data-branch-group=true]]:[font-weight:600] [&_kbd]:[color:var(--disabled-foreground)] [&_kbd]:[font:inherit] [&_small]:[color:var(--disabled-foreground)] [&_small]:[font-size:10px] [&>_p]:[color:var(--muted-foreground)] [&>_p]:[padding:20px] [&>_p]:[text-align:center] gitBranchesList [&_[role=treeitem]]:rounded-sm`}
        id="git-branches-list"
        role="tree"
      >
        {actionMatches("Commit…") && (
          <Button
            data-branch-action="true"
            disabled={busy}
            onClick={() => {
              onClose();
              onCommit?.();
            }}
            role="treeitem"
            type="button"
            className={cn(
              "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
            )}
            variant="ghost"
            size="default"
          >
            <Icon name="commit" size={14} />
            <span>Commit…</span>
            <kbd>⌘K</kbd>
          </Button>
        )}
        <div role="separator" />
        {actionMatches("New Branch…") && (
          <Button
            data-branch-action="true"
            disabled={busy}
            onClick={() => void createBranch()}
            role="treeitem"
            type="button"
            className={cn(
              "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
            )}
            variant="ghost"
            size="default"
          >
            <Icon name="plus" size={14} />
            <span>New Branch…</span>
            <kbd>⌥⌘N</kbd>
          </Button>
        )}
        {actionMatches("Checkout Tag or Revision…") && (
          <Button
            data-branch-action="true"
            disabled={busy}
            onClick={() => void checkoutRevision()}
            role="treeitem"
            type="button"
            className={cn(
              "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
            )}
            variant="ghost"
            size="default"
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
                <Icon
                  className={`rotated [transform:rotate(90deg)] rotated`}
                  name="chevron"
                  size={11}
                />
                <span>{label}</span>
              </div>
              <div role="group">
                {group.map(({ row, index }) => (
                  <Tooltip key={row.ref.name}>
                    <TooltipTrigger
                      render={
                        <Button
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
                            "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
                            index === activeIndex
                              ? `selected [background:var(--accent)] [color:var(--foreground)] selected`
                              : undefined,
                          )}
                          variant="ghost"
                          size="default"
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
                            <Icon
                              className={`favorite [color:var(--bookmark)] [fill:var(--bookmark)] favorite`}
                              name="star"
                              size={12}
                            />
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
        <Notice
          className="w-auto rounded-none border-x-0 p-1.5 px-2 text-[11px]"
          role="alert"
          size="sm"
          tone="destructive"
        >
          {error}
        </Notice>
      )}
      {detailsOpen && activeRef && (
        <div
          className={`gitBranchSelectedActions [border-top:1px_solid_var(--border)] [display:flex] [flex-wrap:wrap] [gap:3px] [padding:4px_5px] [&_button]:[background:transparent] [&_button]:[font-size:10px] [&_button]:[height:25px] [&_button]:[padding:0_6px] gitBranchSelectedActions`}
          aria-label={`Actions for ${activeRef.shortName}`}
          ref={selectedActions}
        >
          <Button
            disabled={activeRef.current || busy}
            onClick={() => void checkoutActive()}
            type="button"
            className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
            variant="ghost"
            size="default"
          >
            Checkout
          </Button>
          <Button
            disabled={busy}
            onClick={() => void createBranch()}
            type="button"
            className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
            variant="ghost"
            size="default"
          >
            New Branch from…
          </Button>
          <Button
            disabled={!onCompare || !currentBranch || activeRef.current || busy}
            onClick={() => void compareActive()}
            type="button"
            className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
            variant="ghost"
            size="default"
          >
            Compare
          </Button>
          <Button
            disabled={!currentBranch || activeRef.current || busy || !onOperation}
            onClick={() => void mergeActive()}
            type="button"
            className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
            variant="ghost"
            size="default"
          >
            Merge into {currentBranch ?? "current branch"}…
          </Button>
          {activeRef.kind === "local" && (
            <Button
              disabled={busy}
              onClick={() => void renameActive()}
              type="button"
              className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
              variant="ghost"
              size="default"
            >
              Rename…
            </Button>
          )}
          {activeRef.kind === "local" && (
            <Button
              disabled={busy}
              onClick={() => void setUpstream()}
              type="button"
              className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
              variant="ghost"
              size="default"
            >
              Set Upstream…
            </Button>
          )}
          <Button
            disabled={busy || !onOperation}
            onClick={() => void createTag()}
            type="button"
            className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
            variant="ghost"
            size="default"
          >
            New Tag…
          </Button>
          {activeRef.kind === "tag" && (
            <Button
              disabled={busy || remotes.length === 0}
              onClick={() => void pushActiveTag()}
              type="button"
              className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
              variant="ghost"
              size="default"
            >
              Push Tag
            </Button>
          )}
          <Button
            disabled={busy || !onOperation}
            onClick={() => void addWorktree()}
            type="button"
            className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
            variant="ghost"
            size="default"
          >
            New Worktree…
          </Button>
          <Button
            disabled={activeRef.current || busy || !onOperation}
            onClick={() => void deleteActive()}
            type="button"
            className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
            variant="ghost"
            size="default"
          >
            Delete…
          </Button>
        </div>
      )}
      {comparison && activeRef && (
        <div
          className={`gitBranchComparison [align-items:center] [background:var(--muted)] [border-top:1px_solid_var(--border)] [display:flex] [font-size:10px] [gap:8px] [padding:5px_8px] [&_span]:[color:var(--muted-foreground)] gitBranchComparison`}
          role="status"
        >
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
