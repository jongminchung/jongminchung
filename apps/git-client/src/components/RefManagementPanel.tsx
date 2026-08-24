import { Button } from "@jongminchung/ui/components/button";
import { Checkbox } from "@jongminchung/ui/components/checkbox";
import { Input } from "@jongminchung/ui/components/input";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useState } from "react";
import { deleteRefOperation } from "../domain/refActions";
import { toVoidHandler } from "../domain/toVoidHandler";
import type { Ref } from "../domain/types";
import type {
  BranchComparison,
  GitOperation,
  RemoteInfo,
} from "../shared/contracts/model/index";
import { useAppDialog } from "./AppDialog";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
import { Selector } from "./ProductFormControls";

export function RefManagementPanel({
  refs,
  remotes,
  currentBranch,
  onCompare,
  onOperation,
  onLoadMergedBranches,
  onOpenPush,
}: {
  readonly refs: readonly Ref[];
  readonly remotes: readonly RemoteInfo[];
  readonly currentBranch?: string;
  readonly onCompare: (
    left: string,
    right: string,
  ) => Promise<BranchComparison>;
  readonly onOperation: (operation: GitOperation) => Promise<void>;
  readonly onLoadMergedBranches: (target: string) => Promise<readonly string[]>;
  readonly onOpenPush: () => void;
}) {
  const [selectedName, setSelectedName] = useState(
    refs.find((ref) => ref.current)?.name ?? refs[0]?.name ?? "",
  );
  const [newName, setNewName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [upstream, setUpstream] = useState("");
  const [remote, setRemote] = useState(remotes[0]?.name ?? "origin");
  const [comparison, setComparison] = useState<BranchComparison>();
  const [mergedBranches, setMergedBranches] = useState<readonly string[]>([]);
  const [noFf, setNoFf] = useState(false);
  const [squashMerge, setSquashMerge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const dialog = useAppDialog();
  const selected = useMemo(
    () => refs.find((ref) => ref.name === selectedName),
    [refs, selectedName],
  );

  const run = async (operation: GitOperation): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      await onOperation(operation);
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : String(operationError),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!selected) return;
    const accepted = await dialog.confirm({
      title: `Delete ${selected.shortName}?`,
      description:
        selected.kind === "remote"
          ? "Deletes the branch from its remote."
          : `Deletes the selected ${selected.kind}.`,
      impact: selected.subject,
      confirmLabel: `Delete ${selected.kind}`,
      dangerous: true,
    });
    if (!accepted) return;
    const operation = deleteRefOperation(selected);
    if (operation) await run(operation);
  };

  const compare = async (): Promise<void> => {
    if (!currentBranch || !selected) return;
    setBusy(true);
    setError(undefined);
    try {
      setComparison(await onCompare(currentBranch, selected.name));
    } catch (compareError) {
      setError(
        compareError instanceof Error
          ? compareError.message
          : String(compareError),
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteMerged = async (branch: string): Promise<void> => {
    const accepted = await dialog.confirm({
      title: `Delete merged branch ${branch}?`,
      description: `Git verified that this branch is merged into ${currentBranch ?? "the target"}.`,
      confirmLabel: "Delete branch",
      dangerous: true,
    });
    if (!accepted) return;
    await run({ kind: "deleteBranch", name: branch, force: false });
    setMergedBranches((current) => current.filter((item) => item !== branch));
  };

  return (
    <div
      className={`refManagement [height:100%] [overflow:auto] [&_input]:[background:var(--secondary)] [&_input]:[border:1px_solid_var(--border)] [&_input]:[min-height:29px] [&_input]:[padding:0_9px] [&_select]:[background:var(--secondary)] [&_select]:[border:1px_solid_var(--border)] [&_select]:[min-height:29px] [&_select]:[padding:0_9px] [&_button]:[background:var(--secondary)] [&_button]:[border:1px_solid_var(--border)] [&_button]:[min-height:29px] [&_button]:[padding:0_9px] refManagement`}
      aria-busy={busy}
    >
      <div
        className={`managementToolbar [&>_span]:[flex:1] [align-items:center] [background:var(--muted)] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:5px] [height:38px] [padding:0_11px] [&>_button]:[align-items:center] [&>_button]:[background:var(--card)] [&>_button]:[border:1px_solid_var(--border)] [&>_button]:rounded-sm [&>_button]:[display:flex] [&>_button]:[gap:5px] [&>_button]:[min-height:27px] [&>_button]:[padding:0_8px] [background:var(--card)] managementToolbar [&>_button]:rounded-sm`}
      >
        <strong>Branches & tags</strong>
        <span />
        <Button
          disabled={!currentBranch || busy}
          onClick={onOpenPush}
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          <Icon name="push" size={13} /> Push…
        </Button>
        <Button
          disabled={!currentBranch || busy}
          onClick={() =>
            currentBranch &&
            void onLoadMergedBranches(currentBranch).then((branches) =>
              setMergedBranches(
                branches.filter(
                  (branch) =>
                    branch !== currentBranch &&
                    branch !== "main" &&
                    branch !== "master",
                ),
              ),
            )
          }
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          Clean merged branches
        </Button>
      </div>
      {error && (
        <Notice
          className="rounded-none border-x-0 px-3.5 py-1.5"
          role="alert"
          size="sm"
          tone="destructive"
        >
          {error}
        </Notice>
      )}
      <section
        className={`refActionBar [align-items:end] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:8px] [padding:9px_11px] [&>_label]:[color:var(--muted-foreground)] [&>_label]:[display:flex] [&>_label]:[flex:1] [&>_label]:[flex-direction:column] [&>_label]:[font-size:11px] [&>_label]:[gap:4px] [&>_label:nth-child(2)]:[flex:0_0_130px] max-[1120px]:[align-items:stretch] max-[1120px]:[flex-wrap:wrap] refActionBar`}
      >
        <Selector
          className="bg-secondary"
          label="Reference"
          onChange={(value) => {
            setSelectedName(value);
            setComparison(undefined);
          }}
          options={refs.map((ref) => ({
            label: `${ref.kind} · ${ref.shortName}${ref.current ? " · HEAD" : ""}`,
            value: ref.name,
          }))}
          value={selectedName}
        />
        <Selector
          className="bg-secondary"
          label="Remote"
          onChange={setRemote}
          options={remotes.map((item) => ({
            label: item.name,
            value: item.name,
          }))}
          value={remote}
        />
        <Button
          disabled={!selected || busy}
          onClick={() =>
            selected &&
            void run({
              kind: "checkout",
              target: selected.name,
              force: false,
            })
          }
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          Checkout
        </Button>
        <Button
          disabled={
            !selected ||
            !currentBranch ||
            selected.name === currentBranch ||
            busy
          }
          onClick={() => void compare()}
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          Compare with current
        </Button>
        <Button
          disabled={!selected || selected.current || busy}
          onClick={() => void remove()}
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          Delete…
        </Button>
        {selected?.kind === "tag" && (
          <Button
            disabled={!remote || busy}
            onClick={() =>
              void run({
                kind: "pushTag",
                remote,
                name: selected.shortName,
              })
            }
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Push tag
          </Button>
        )}
      </section>
      <section
        className={`refForms [&_form]:[align-items:end] [&_form]:[border-bottom:1px_solid_var(--border)] [&_form]:[display:flex] [&_form]:[gap:8px] [&_form]:[padding:9px_11px] [display:grid] [gap:10px] [grid-template-columns:repeat(2,_minmax(260px,_1fr))] [padding:11px] [&_form]:[align-items:stretch] [&_form]:[background:var(--secondary)] [&_form]:[border:1px_solid_var(--border)] [&_form]:rounded-lg [&_form]:[flex-direction:column] [&_form]:[padding:11px] [&_form_strong]:[min-height:29px] max-[1120px]:[grid-template-columns:1fr] refForms [&_form]:rounded-lg`}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (newName.trim())
              void run({
                kind: "createBranch",
                name: newName.trim(),
                startPoint: selected?.name ?? "HEAD",
                checkout: true,
              }).then(() => setNewName(""));
          }}
        >
          <strong>Create branch</strong>
          <Input
            aria-label="New branch name"
            onChange={(event) => setNewName(event.target.value)}
            placeholder="feat/name"
            value={newName}
          />
          <Button
            disabled={!newName.trim() || busy}
            type="submit"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Create & checkout
          </Button>
        </form>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (selected?.kind === "local" && renameName.trim())
              void run({
                kind: "renameBranch",
                oldName: selected.shortName,
                newName: renameName.trim(),
              }).then(() => setRenameName(""));
          }}
        >
          <strong>Rename selected local branch</strong>
          <Input
            aria-label="Renamed branch name"
            onChange={(event) => setRenameName(event.target.value)}
            placeholder="new/name"
            value={renameName}
          />
          <Button
            disabled={selected?.kind !== "local" || !renameName.trim() || busy}
            type="submit"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Rename
          </Button>
        </form>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (selected?.kind === "local" && upstream.trim())
              void run({
                kind: "setUpstream",
                branch: selected.shortName,
                upstream: upstream.trim(),
              });
          }}
        >
          <strong>Tracking branch</strong>
          <Input
            aria-label="Upstream branch"
            onChange={(event) => setUpstream(event.target.value)}
            placeholder="origin/main"
            value={upstream}
          />
          <Button
            disabled={selected?.kind !== "local" || !upstream.trim() || busy}
            type="submit"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Set upstream
          </Button>
        </form>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (tagName.trim())
              void run({
                kind: "createTag",
                name: tagName.trim(),
                revision: selected?.name ?? "HEAD",
                message: tagMessage.trim() || null,
              }).then(() => {
                setTagName("");
                setTagMessage("");
              });
          }}
        >
          <strong>Create tag at selected reference</strong>
          <Input
            aria-label="New tag name"
            onChange={(event) => setTagName(event.target.value)}
            placeholder="v1.0.0"
            value={tagName}
          />
          <Input
            aria-label="Tag message"
            onChange={(event) => setTagMessage(event.target.value)}
            placeholder="Message (optional)"
            value={tagMessage}
          />
          <Button
            disabled={!tagName.trim() || busy}
            type="submit"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Create tag
          </Button>
        </form>
      </section>
      <section
        className={`mergeOptions [align-items:center] [border-top:1px_solid_var(--border)] [display:flex] [gap:10px] [padding:10px_11px] [&_label]:[align-items:center] [&_label]:[color:var(--muted-foreground)] [&_label]:[display:inline-flex] [&_label]:[gap:4px] [&>_span]:[flex:1] mergeOptions`}
      >
        <strong>Integrate selected reference</strong>
        <label>
          <Checkbox checked={noFf} onCheckedChange={setNoFf} /> Create merge
          commit (--no-ff)
        </label>
        <label>
          <Checkbox checked={squashMerge} onCheckedChange={setSquashMerge} />{" "}
          Squash changes without committing
        </label>
        <span />
        <Button
          disabled={!selected || busy}
          onClick={() =>
            selected &&
            void run({
              kind: "merge",
              revision: selected.name,
              noFf,
              squash: squashMerge,
            })
          }
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          Merge selected
        </Button>
        <Button
          disabled={!selected || !currentBranch || busy}
          onClick={toVoidHandler(async () => {
            if (!selected || !currentBranch) return;
            const accepted = await dialog.confirm({
              title: `Rebase ${currentBranch} onto ${selected.shortName}?`,
              description:
                "Rewrites commits unique to the current branch and autostashes working-tree changes when required.",
              confirmLabel: "Start rebase",
              dangerous: true,
            });
            if (accepted)
              void run({
                kind: "rebase",
                onto: selected.name,
                branch: currentBranch,
              });
          })}
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          Rebase current
        </Button>
      </section>
      {comparison && (
        <section
          className={`branchComparison [display:flex] [flex-direction:column] [gap:6px] [padding:12px] [&>_span]:[color:var(--muted-foreground)] [&_pre]:[background:var(--muted)] [&_pre]:[border:1px_solid_var(--border)] [&_pre]:rounded-lg [&_pre]:[max-height:220px] [&_pre]:[overflow:auto] [&_pre]:[padding:8px] branchComparison [&_pre]:rounded-lg`}
        >
          <strong>
            {currentBranch} ↔ {selected?.shortName}
          </strong>
          <span>
            {comparison.ahead} only on current · {comparison.behind} only on
            selected
          </span>
          <details>
            <summary>Commit IDs</summary>
            <pre>
              {[
                ...comparison.leftOnly.map((oid) => `< ${oid}`),
                ...comparison.rightOnly.map((oid) => `> ${oid}`),
              ].join("\n")}
            </pre>
          </details>
        </section>
      )}
      {mergedBranches.length > 0 && (
        <section
          className={`mergedBranches [border-top:1px_solid_var(--border)] [display:flex] [flex-direction:column] [gap:6px] [padding:11px] [&>_span]:[align-items:center] [&>_span]:[display:flex] [&>_span]:[gap:8px] [&_code]:[flex:1] mergedBranches`}
        >
          <strong>Merged into {currentBranch}</strong>
          {mergedBranches.map((branch) => (
            <span key={branch}>
              <code>{branch}</code>
              <Button
                onClick={() => void deleteMerged(branch)}
                type="button"
                className={cn("h-7 px-2.5")}
                variant="outline"
                size="sm"
              >
                Delete
              </Button>
            </span>
          ))}
        </section>
      )}
      {dialog.node}
    </div>
  );
}
