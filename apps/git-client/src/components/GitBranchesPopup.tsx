import { useEffect, useMemo, useRef, useState } from "react";
import { checkoutTarget, deleteRefOperation } from "../domain/refActions";
import type { Ref } from "../domain/types";
import type { BranchComparison, GitOperation, RemoteInfo } from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";

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
          <button
            aria-label="Fetch"
            disabled={busy}
            onClick={() => void run({ kind: "fetch", remote: null, prune: false }, false)}
            title="Fetch"
          >
            <Icon name="fetch" size={14} />
          </button>
          <button aria-label="Settings" onClick={onOpenSettings} title="Settings">
            <Icon name="settings" size={14} />
          </button>
        </div>
      </div>
      <div
        aria-label="Branches Tree"
        className={tw.gitBranchesList}
        id="git-branches-list"
        role="tree"
      >
        {actionMatches("Commit…") && (
          <button
            data-branch-action="true"
            disabled={busy}
            onClick={() => {
              onClose();
              onCommit?.();
            }}
            role="treeitem"
          >
            <Icon name="commit" size={14} />
            <span>Commit…</span>
            <kbd>⌘K</kbd>
          </button>
        )}
        <div role="separator" />
        {actionMatches("New Branch…") && (
          <button
            data-branch-action="true"
            disabled={busy}
            onClick={() => void createBranch()}
            role="treeitem"
          >
            <Icon name="plus" size={14} />
            <span>New Branch…</span>
            <kbd>⌥⌘N</kbd>
          </button>
        )}
        {actionMatches("Checkout Tag or Revision…") && (
          <button
            data-branch-action="true"
            disabled={busy}
            onClick={() => void checkoutRevision()}
            role="treeitem"
          >
            <Icon name="checkout" size={14} />
            <span>Checkout Tag or Revision…</span>
          </button>
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
                  <button
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? tw.selected : undefined}
                    id={`branch-${index}`}
                    key={row.ref.name}
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
                    title={row.ref.subject}
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
                    {row.ref.favorite && <Icon className={tw.favorite} name="star" size={12} />}
                    {(row.ref.current || row.ref.shortName === currentBranch) && (
                      <small>
                        {row.ref.upstream?.replace(/^refs\/remotes\//, "") ?? "Current"}
                      </small>
                    )}
                    <Icon name="chevron" size={10} />
                  </button>
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
          <button disabled={activeRef.current || busy} onClick={() => void checkoutActive()}>
            Checkout
          </button>
          <button disabled={busy} onClick={() => void createBranch()}>
            New Branch from…
          </button>
          <button
            disabled={!onCompare || !currentBranch || activeRef.current || busy}
            onClick={() => void compareActive()}
          >
            Compare
          </button>
          {activeRef.kind === "local" && (
            <button disabled={busy} onClick={() => void renameActive()}>
              Rename…
            </button>
          )}
          {activeRef.kind === "local" && (
            <button disabled={busy} onClick={() => void setUpstream()}>
              Set Upstream…
            </button>
          )}
          <button disabled={busy || !onOperation} onClick={() => void createTag()}>
            New Tag…
          </button>
          {activeRef.kind === "tag" && (
            <button disabled={busy || remotes.length === 0} onClick={() => void pushActiveTag()}>
              Push Tag
            </button>
          )}
          <button disabled={busy || !onOperation} onClick={() => void addWorktree()}>
            New Worktree…
          </button>
          <button
            disabled={activeRef.current || busy || !onOperation}
            onClick={() => void deleteActive()}
          >
            Delete…
          </button>
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
