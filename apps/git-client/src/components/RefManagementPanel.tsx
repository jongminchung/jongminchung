import { useMemo, useState } from "react";
import { deleteRefOperation } from "../domain/refActions";
import { toVoidHandler } from "../domain/toVoidHandler";
import type { Ref } from "../domain/types";
import type { BranchComparison, GitOperation, RemoteInfo } from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { Icon } from "./Icon";

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
  readonly onCompare: (left: string, right: string) => Promise<BranchComparison>;
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
      setError(operationError instanceof Error ? operationError.message : String(operationError));
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
      setError(compareError instanceof Error ? compareError.message : String(compareError));
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
    <div className={tw.refManagement} aria-busy={busy}>
      <div className={tw.managementToolbar}>
        <strong>Branches & tags</strong>
        <span />
        <button disabled={!currentBranch || busy} onClick={onOpenPush}>
          <Icon name="push" size={13} /> Push…
        </button>
        <button
          disabled={!currentBranch || busy}
          onClick={() =>
            currentBranch &&
            void onLoadMergedBranches(currentBranch).then((branches) =>
              setMergedBranches(
                branches.filter(
                  (branch) => branch !== currentBranch && branch !== "main" && branch !== "master",
                ),
              ),
            )
          }
        >
          Clean merged branches
        </button>
      </div>
      {error && (
        <div className={tw.collectionError} role="alert">
          {error}
        </div>
      )}
      <section className={tw.refActionBar}>
        <label>
          Reference
          <select
            value={selectedName}
            onChange={(event) => {
              setSelectedName(event.target.value);
              setComparison(undefined);
            }}
          >
            {refs.map((ref) => (
              <option key={ref.name} value={ref.name}>
                {ref.kind} · {ref.shortName}
                {ref.current ? " · HEAD" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Remote
          <select value={remote} onChange={(event) => setRemote(event.target.value)}>
            {remotes.map((item) => (
              <option key={item.name}>{item.name}</option>
            ))}
          </select>
        </label>
        <button
          disabled={!selected || busy}
          onClick={() =>
            selected &&
            void run({
              kind: "checkout",
              target: selected.name,
              force: false,
            })
          }
        >
          Checkout
        </button>
        <button
          disabled={!selected || !currentBranch || selected.name === currentBranch || busy}
          onClick={() => void compare()}
        >
          Compare with current
        </button>
        <button disabled={!selected || selected.current || busy} onClick={() => void remove()}>
          Delete…
        </button>
        {selected?.kind === "tag" && (
          <button
            disabled={!remote || busy}
            onClick={() =>
              void run({
                kind: "pushTag",
                remote,
                name: selected.shortName,
              })
            }
          >
            Push tag
          </button>
        )}
      </section>
      <section className={tw.refForms}>
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
          <input
            aria-label="New branch name"
            onChange={(event) => setNewName(event.target.value)}
            placeholder="feat/name"
            value={newName}
          />
          <button disabled={!newName.trim() || busy}>Create & checkout</button>
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
          <input
            aria-label="Renamed branch name"
            onChange={(event) => setRenameName(event.target.value)}
            placeholder="new/name"
            value={renameName}
          />
          <button disabled={selected?.kind !== "local" || !renameName.trim() || busy}>
            Rename
          </button>
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
          <input
            aria-label="Upstream branch"
            onChange={(event) => setUpstream(event.target.value)}
            placeholder="origin/main"
            value={upstream}
          />
          <button disabled={selected?.kind !== "local" || !upstream.trim() || busy}>
            Set upstream
          </button>
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
          <input
            aria-label="New tag name"
            onChange={(event) => setTagName(event.target.value)}
            placeholder="v1.0.0"
            value={tagName}
          />
          <input
            aria-label="Tag message"
            onChange={(event) => setTagMessage(event.target.value)}
            placeholder="Message (optional)"
            value={tagMessage}
          />
          <button disabled={!tagName.trim() || busy}>Create tag</button>
        </form>
      </section>
      <section className={tw.mergeOptions}>
        <strong>Integrate selected reference</strong>
        <label>
          <input
            checked={noFf}
            onChange={(event) => setNoFf(event.target.checked)}
            type="checkbox"
          />{" "}
          Create merge commit (--no-ff)
        </label>
        <label>
          <input
            checked={squashMerge}
            onChange={(event) => setSquashMerge(event.target.checked)}
            type="checkbox"
          />{" "}
          Squash changes without committing
        </label>
        <span />
        <button
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
        >
          Merge selected
        </button>
        <button
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
        >
          Rebase current
        </button>
      </section>
      {comparison && (
        <section className={tw.branchComparison}>
          <strong>
            {currentBranch} ↔ {selected?.shortName}
          </strong>
          <span>
            {comparison.ahead} only on current · {comparison.behind} only on selected
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
        <section className={tw.mergedBranches}>
          <strong>Merged into {currentBranch}</strong>
          {mergedBranches.map((branch) => (
            <span key={branch}>
              <code>{branch}</code>
              <button onClick={() => void deleteMerged(branch)}>Delete</button>
            </span>
          ))}
        </section>
      )}
      {dialog.node}
    </div>
  );
}
