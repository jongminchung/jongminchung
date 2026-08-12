import { Button } from "@jongminchung/ui/components/button";
import { Checkbox } from "@jongminchung/ui/components/checkbox";
import { Input } from "@jongminchung/ui/components/input";
import { ScrollArea } from "@jongminchung/ui/components/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jongminchung/ui/components/table";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { sanitizeGitError } from "../domain/gitActivity";
import {
  historyPlanError,
  moveHistoryPlanEntry,
  prepareHistoryPlan,
} from "../domain/historyRewrite";
import { protectedRewriteConfirmation } from "../domain/recoveryFlow";
import type {
  GitOperation,
  HistoryRewritePreview,
  RebasePlanAction,
  RebasePlanEntry,
} from "../shared/contracts/model";
import { useAppDialog } from "./AppDialog";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
import { Spinner } from "./ProductCollections";
import { Dialog, DialogFooter, DialogHeader } from "./ProductDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ProductSelect";

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
  const { confirm, node: confirmationNode } = useAppDialog();
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
    if (!preview || validation || running) return;
    if (preview.protectedBranch) {
      const accepted = await confirm(protectedRewriteConfirmation(preview));
      if (!accepted) return;
    }
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
    <>
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
        <form
          className="grid h-[calc(100vh-24px)] min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            void execute();
          }}
        >
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
            <Spinner className="w-full justify-center" label="Inspecting branch history…" />
          ) : completed && preview ? (
            <div className="m-auto grid max-w-xl gap-4 rounded-lg border border-border bg-card p-6 text-center">
              <Icon name="check" size={32} />
              <h2 className="m-0">History rewrite completed</h2>
              <p className="m-0 text-muted-foreground">
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
                <Button
                  onClick={onClose}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Back to history
                </Button>
                <Button
                  onClick={onOpenPush}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="default"
                  size="sm"
                >
                  Push…
                </Button>
              </div>
            </div>
          ) : preview ? (
            <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[minmax(0,1fr)_auto]">
              <ScrollArea className="min-h-0 border-r border-border max-[900px]:border-b max-[900px]:border-r-0">
                <Table className="border-collapse text-left text-xs">
                  <TableHeader className="sticky top-0 z-10 bg-card text-muted-foreground">
                    <TableRow>
                      <TableHead className="h-8 w-8 p-2" />
                      <TableHead className="h-8 w-28 p-2">Action</TableHead>
                      <TableHead className="h-8 p-2">Commit</TableHead>
                      <TableHead className="h-8 w-52 p-2">Impact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry, index) => (
                      <TableRow
                        data-rebase-oid={entry.oid}
                        draggable={!preview.hasMerges && !entry.mergeCommit}
                        key={entry.oid}
                        onDragOver={(event) => {
                          if (!preview.hasMerges) event.preventDefault();
                        }}
                        onDragStart={() => setDraggedOid(entry.oid)}
                        onDrop={() => dropOn(entry.oid)}
                      >
                        <TableCell className="cursor-grab p-2 text-muted-foreground">
                          <Icon name="more" size={14} />
                        </TableCell>
                        <TableCell className="p-2">
                          <Select
                            disabled={entry.mergeCommit}
                            onValueChange={(value) =>
                              value && changeAction(entry.oid, value as RebasePlanAction)
                            }
                            value={entry.action}
                          >
                            <SelectTrigger
                              aria-label={`Action for ${entry.subject}`}
                              autoFocus={index === 0}
                              className="w-full bg-card"
                              size="sm"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start">
                              {ACTIONS.map((action) => (
                                <SelectItem key={action} value={action}>
                                  {action}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-0 p-2 whitespace-normal">
                          <div className="flex min-w-0 items-center gap-2">
                            <code>{entry.oid.slice(0, 8)}</code>
                            <strong className="truncate">{entry.subject}</strong>
                          </div>
                          {entry.action === "reword" && (
                            <Input
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
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {entry.published && (
                              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-warning">
                                Published
                              </span>
                            )}
                            {entry.mergeCommit && (
                              <span className="rounded bg-accent/10 px-1.5 py-0.5 text-primary">
                                Merge · preserved
                              </span>
                            )}
                            {entry.oid === preview.headOid && (
                              <span className="rounded bg-accent px-1.5 py-0.5 text-accent-foreground">
                                HEAD
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
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
                    <Checkbox checked={autostash} onCheckedChange={setAutostash} /> Autostash local
                    changes
                  </label>
                  {preview.dependentRefs.length > 0 && (
                    <label>
                      <Checkbox checked={updateRefs} onCheckedChange={setUpdateRefs} /> Update
                      dependent refs
                    </label>
                  )}
                  <label>
                    <Checkbox checked disabled /> Preserve merge topology
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
                <small className="text-muted-foreground">
                  Conflicts and edit stops continue in Changes / Recovery with Continue, Skip, or
                  Abort.
                </small>
              </aside>
            </div>
          ) : (
            <Notice className="m-auto max-w-lg" role="alert" tone="destructive">
              {error ?? "History rewrite preview is unavailable."}
            </Notice>
          )}
          <DialogFooter alignment="start">
            {preview && !completed && (
              <small className="text-muted-foreground">{changedCount} plan change(s)</small>
            )}
            {validation && <small className="text-destructive">{validation}</small>}
            {error && preview && <small className="text-destructive">{error}</small>}
            <span className="flex-1" />
            <Button
              onClick={onClose}
              type="button"
              disabled={running}
              className={cn("h-7 px-2.5")}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
            {!completed && (
              <Button
                type="submit"
                disabled={!preview || Boolean(validation) || running}
                className={cn("h-7 px-2.5")}
                variant="destructive"
                size="sm"
              >
                {running ? "Rewriting…" : "Start Rebase"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </Dialog>
      {confirmationNode}
    </>
  );
}
