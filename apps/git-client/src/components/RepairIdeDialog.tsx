import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { useState } from "react";
import { tw } from "../styles/tailwind";

type RepairState =
  | { readonly kind: "idle" }
  | { readonly kind: "running" }
  | { readonly kind: "completed" }
  | { readonly kind: "failed"; readonly message: string };

export function RepairIdeDialog({
  onClose,
  onContinueToInvalidate,
  onRepair,
}: {
  readonly onClose: () => void;
  readonly onContinueToInvalidate: () => void;
  readonly onRepair: () => Promise<void>;
}) {
  const [state, setState] = useState<RepairState>({ kind: "idle" });
  const repair = async (): Promise<void> => {
    if (state.kind === "running") return;
    setState({ kind: "running" });
    try {
      await onRepair();
      setState({ kind: "completed" });
    } catch (reason) {
      setState({
        kind: "failed",
        message: reason instanceof Error ? reason.message : String(reason),
      });
    }
  };

  return (
    <Dialog
      aria-label="Repair IDE"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={560}
    >
      <section className={tw.repairIdeDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Repair IDE"
        />
        <main aria-busy={state.kind === "running"}>
          <h3>Rescan project files and indexes</h3>
          <p>Refresh the repository snapshot, file inventory, Git log indexes, and editor metadata without changing project files.</p>
          {state.kind === "running" && <p role="status">Repairing project indexes…</p>}
          {state.kind === "completed" && (
            <p role="status">The recovery step completed. Check whether the problem is resolved before continuing.</p>
          )}
          {state.kind === "failed" && <p role="alert">{state.message}</p>}
        </main>
        <footer>
          {state.kind === "completed" ? (
            <>
              <Button label="Stop" onClick={onClose} variant="secondary" />
              <Button label="Invalidate Caches and Restart" onClick={onContinueToInvalidate} variant="primary" />
            </>
          ) : (
            <>
              <Button label="Cancel" onClick={onClose} variant="secondary" />
              <Button
                isDisabled={state.kind === "running"}
                label={state.kind === "running" ? "Repairing…" : "Repair"}
                onClick={() => void repair()}
                variant="primary"
              />
            </>
          )}
        </footer>
      </section>
    </Dialog>
  );
}
