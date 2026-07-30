import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState } from "react";
import { tw } from "../styles/tailwind";
import { Dialog, DialogHeader } from "./ProductDialog";

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
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title="Repair IDE" />
        <main aria-busy={state.kind === "running"}>
          <h3>Rescan project files and indexes</h3>
          <p>
            Refresh the repository snapshot, file inventory, Git log indexes, and editor metadata
            without changing project files.
          </p>
          {state.kind === "running" && <p role="status">Repairing project indexes…</p>}
          {state.kind === "completed" && (
            <p role="status">
              The recovery step completed. Check whether the problem is resolved before continuing.
            </p>
          )}
          {state.kind === "failed" && <p role="alert">{state.message}</p>}
        </main>
        <footer>
          {state.kind === "completed" ? (
            <>
              <Button
                onClick={onClose}
                type="button"
                className={cn("h-8 px-3")}
                variant="outline"
                size="default"
              >
                Stop
              </Button>
              <Button
                onClick={onContinueToInvalidate}
                type="button"
                className={cn("h-8 px-3")}
                variant="default"
                size="default"
              >
                Invalidate Caches and Restart
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={onClose}
                type="button"
                className={cn("h-8 px-3")}
                variant="outline"
                size="default"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void repair()}
                type="button"
                disabled={state.kind === "running"}
                className={cn("h-8 px-3")}
                variant="default"
                size="default"
              >
                {state.kind === "running" ? "Repairing…" : "Repair"}
              </Button>
            </>
          )}
        </footer>
      </section>
    </Dialog>
  );
}
