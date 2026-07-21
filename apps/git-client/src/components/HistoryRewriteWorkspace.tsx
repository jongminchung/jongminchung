import { useEffect, useMemo, useState } from "react";
import { sanitizeGitError } from "../domain/gitActivity";
import {
  historyPlanError,
  moveHistoryPlanEntry,
  prepareHistoryPlan,
} from "../domain/historyRewrite";
import type {
  GitOperation,
  HistoryRewritePreview,
  RebasePlanAction,
  RebasePlanEntry,
} from "../shared/contracts/model";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { Dialog, DialogHeader } from "./ui";

const ACTIONS: readonly RebasePlanAction[] = ["pick", "reword", "edit", "squash", "fixup", "drop"];

const EMPTY_SQUASH_OIDS: readonly string[] = [];

export function HistoryRewriteWorkspace({
  fromRevision,
  squashOids = EMPTY_SQUASH_OIDS,
  onClose,
  onExecute,
  onLoadPreview,
  onOpenPush,
  operationInProgress,
  currentHeadOid,
}: {
  readonly fromRevision: string;
  readonly squashOids?: readonly string[];
  readonly onClose: () => void;
  readonly onExecute: (operation: GitOperation) => Promise<void>;
  readonly onLoadPreview: (fromRevision: string) => Promise<HistoryRewritePreview>;
  readonly onOpenPush: () => void;
  readonly operationInProgress: boolean;
  readonly currentHeadOid: string | null;
}) {
  const [preview, setPreview] = useState<HistoryRewritePreview | null>(null);
  const [entries, setEntries] = useState<readonly RebasePlanEntry[]>([]);
  const [autostash, setAutostash] = useState(true);
  const [updateRefs, setUpdateRefs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedOid, setDraggedOid] = useState<string | null>(null);
  const selectedForSquash = useMemo(() => new Set(squashOids), [squashOids]);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const next = await onLoadPreview(fromRevision);
        if (!active) return;
        setPreview(next);
        setEntries(prepareHistoryPlan(next, selectedForSquash));
      } catch (reason) {
        if (active) setError(sanitizeGitError(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [fromRevision, onLoadPreview, selectedForSquash]);

  useDismissLayer(
    useMemo(
      () => ({
        id: "history-rewrite-workspace",
        priority: 132,
        active: true,
        dismiss: () => {
          if (!running) onClose();
        },
      }),
      [onClose, running],
    ),
  );

  useEffect(() => {
    if (operationInProgress && !running) onClose();
  }, [onClose, operationInProgress, running]);

  const validation = historyPlanError(entries);
  const changedCount = preview
    ? entries.filter((entry, index) => {
        const original = preview.entries[index];
        return (
          !original ||
          original.oid !== entry.oid ||
          original.action !== entry.action ||
          original.message !== entry.message
        );
      }).length
    : 0;

  const changeAction = (oid: string, action: RebasePlanAction): void => {
    setEntries((current) =>
      current.map((entry) =>
        entry.oid === oid
          ? {
              ...entry,
              action,
              message: action === "reword" ? (entry.message ?? entry.subject) : null,
            }
          : entry,
      ),
    );
  };

  const dropOn = (targetOid: string): void => {
    if (!draggedOid || draggedOid === targetOid || preview?.hasMerges) return;
    setEntries((current) => moveHistoryPlanEntry(current, draggedOid, targetOid));
    setDraggedOid(null);
  };

  const execute = async (): Promise<void> => {
    if (!preview || validation) return;
    setRunning(true);
    setError(null);
    try {
      await onExecute({
        kind: "interactiveRebase",
        base: preview.base,
        entries: [...entries],
        options: { autostash, updateRefs, preserveMerges: true },
      });
      setCompleted(true);
    } catch (reason) {
      setError(sanitizeGitError(reason));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog
      aria-label="History Rewrite"
      isOpen
      maxHeight="calc(100vh - 24px)"
      onOpenChange={(isOpen) => {
        if (!isOpen && !running) onClose();
      }}
      padding={0}
      purpose="form"
      width="calc(100vw - 24px)"
    >
      <section className="grid h-[calc(100vh-24px)] min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader
          hasDivider
          onOpenChange={(isOpen) => {
            if (!isOpen && !running) onClose();
          }}
          subtitle={
            preview
              ? `${preview.branch} · ${preview.entries.length} commits · oldest to newest`
              : "Loading rewrite range…"
          }
          title="History Rewrite"
        />
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-secondary" role="status">
            <span className="activitySpinner" />
            Inspecting branch history…
          </div>
        ) : completed && preview ? (
          <div className="m-auto grid max-w-xl gap-4 rounded-xl border border-border bg-card p-6 text-center">
            <Icon name="check" size={32} />
            <h2 className="m-0">History rewrite completed</h2>
            <p className="m-0 text-secondary">
              {preview.branch} was rewritten locally. A Recovery entry was recorded before the
              operation.
            </p>
            <code className="rounded-lg bg-muted p-2 text-xs">
              {preview.headOid.slice(0, 10)} → {(currentHeadOid ?? "Refreshing…").slice(0, 10)}
            </code>
            {preview.publishedCommitCount > 0 && (
              <p className="m-0 rounded-lg border border-warning bg-warning/10 p-3">
                {preview.publishedCommitCount} published commit(s) changed. Review the destination
                before pushing.
              </p>
            )}
            <div className="flex justify-center gap-2">
              <Button label="Back to history" onClick={onClose} size="sm" variant="secondary" />
              <Button label="Push…" onClick={onOpenPush} size="sm" variant="primary" />
            </div>
          </div>
        ) : preview ? (
          <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[minmax(0,1fr)_auto]">
            <div className="min-h-0 overflow-auto border-r border-border max-[900px]:border-b max-[900px]:border-r-0">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-card text-secondary">
                  <tr>
                    <th className="w-8 p-2" />
                    <th className="w-28 p-2">Action</th>
                    <th className="p-2">Commit</th>
                    <th className="w-52 p-2">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      className="border-t border-border hover:bg-muted"
                      data-rebase-oid={entry.oid}
                      draggable={!preview.hasMerges && !entry.mergeCommit}
                      key={entry.oid}
                      onDragOver={(event) => {
                        if (!preview.hasMerges) event.preventDefault();
                      }}
                      onDragStart={() => setDraggedOid(entry.oid)}
                      onDrop={() => dropOn(entry.oid)}
                    >
                      <td className="cursor-grab p-2 text-secondary">
                        <Icon name="more" size={14} />
                      </td>
                      <td className="p-2">
                        <select
                          aria-label={`Action for ${entry.subject}`}
                          className="min-h-7 rounded-md border border-border bg-card px-2"
                          disabled={entry.mergeCommit}
                          onChange={(event) =>
                            changeAction(entry.oid, event.target.value as RebasePlanAction)
                          }
                          value={entry.action}
                        >
                          {ACTIONS.map((action) => (
                            <option key={action} value={action}>
                              {action}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="min-w-0 p-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <code>{entry.oid.slice(0, 8)}</code>
                          <strong className="truncate">{entry.subject}</strong>
                        </div>
                        {entry.action === "reword" && (
                          <input
                            aria-label={`New message for ${entry.subject}`}
                            className="mt-2 min-h-8 w-full rounded-md border border-border bg-card px-2"
                            onChange={(event) =>
                              setEntries((current) =>
                                current.map((candidate) =>
                                  candidate.oid === entry.oid
                                    ? {
                                        ...candidate,
                                        message: event.target.value,
                                      }
                                    : candidate,
                                ),
                              )
                            }
                            value={entry.message ?? ""}
                          />
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {entry.published && (
                            <span className="rounded bg-warning/15 px-1.5 py-0.5 text-warning">
                              Published
                            </span>
                          )}
                          {entry.mergeCommit && (
                            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">
                              Merge · preserved
                            </span>
                          )}
                          {entry.oid === preview.headOid && (
                            <span className="rounded bg-accent px-1.5 py-0.5 text-accent-foreground">
                              HEAD
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <aside className="grid content-start gap-4 overflow-auto bg-card p-4">
              <section className="grid gap-2">
                <strong>Preview</strong>
                <span>{preview.descendantCount} commit(s) rewritten</span>
                <span>{preview.publishedCommitCount} published commit(s)</span>
                <span>{preview.dependentRefs.length} dependent local ref(s)</span>
                <span>
                  {preview.root
                    ? "Includes root commit (--root)"
                    : `Base ${preview.base?.slice(0, 10)}`}
                </span>
                {preview.protectedBranch && (
                  <span className="rounded bg-warning/15 px-2 py-1 text-warning">
                    Protected branch
                  </span>
                )}
              </section>
              {preview.warnings.map((warning) => (
                <p
                  className="m-0 rounded-lg border border-warning bg-warning/10 p-3 text-xs"
                  key={warning}
                >
                  {warning}
                </p>
              ))}
              <section className="grid gap-2">
                <strong>Options</strong>
                <label>
                  <input
                    checked={autostash}
                    onChange={(event) => setAutostash(event.target.checked)}
                    type="checkbox"
                  />{" "}
                  Autostash local changes
                </label>
                {preview.dependentRefs.length > 0 && (
                  <label>
                    <input
                      checked={updateRefs}
                      onChange={(event) => setUpdateRefs(event.target.checked)}
                      type="checkbox"
                    />{" "}
                    Update dependent refs
                  </label>
                )}
                <label>
                  <input checked disabled type="checkbox" /> Preserve merge topology
                </label>
              </section>
              {preview.dependentRefs.length > 0 && (
                <section className="grid gap-1">
                  <strong>Dependent refs</strong>
                  {preview.dependentRefs.map((reference) => (
                    <code key={reference.name}>
                      {reference.name} · {reference.oid.slice(0, 8)}
                    </code>
                  ))}
                </section>
              )}
              <small className="text-secondary">
                Conflicts and edit stops continue in Changes / Recovery with Continue, Skip, or
                Abort.
              </small>
            </aside>
          </div>
        ) : (
          <div
            className="m-auto max-w-lg rounded-lg border border-destructive bg-destructive-muted p-4"
            role="alert"
          >
            {error ?? "History rewrite preview is unavailable."}
          </div>
        )}
        <footer className="flex items-center gap-2 border-t border-border p-3">
          {preview && !completed && (
            <small className="text-secondary">{changedCount} plan change(s)</small>
          )}
          {validation && <small className="text-destructive">{validation}</small>}
          {error && preview && <small className="text-destructive">{error}</small>}
          <span className="flex-1" />
          <Button isDisabled={running} label="Cancel" onClick={onClose} size="sm" variant="ghost" />
          {!completed && (
            <Button
              isDisabled={!preview || Boolean(validation) || running}
              label={running ? "Rewriting…" : "Start Rebase"}
              onClick={() => void execute()}
              size="sm"
              variant="destructive"
            />
          )}
        </footer>
      </section>
    </Dialog>
  );
}
