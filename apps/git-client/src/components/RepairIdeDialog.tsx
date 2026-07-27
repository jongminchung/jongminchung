import { Button } from "@base-ui/react/button";
import { useState } from "react";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Dialog, DialogHeader } from "./ui";

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
                data-slot="button"
                onClick={onClose}
                type="button"
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
                )}
              >
                Stop
              </Button>
              <Button
                data-slot="button"
                onClick={onContinueToInvalidate}
                type="button"
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
                )}
              >
                Invalidate Caches and Restart
              </Button>
            </>
          ) : (
            <>
              <Button
                data-slot="button"
                onClick={onClose}
                type="button"
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
                )}
              >
                Cancel
              </Button>
              <Button
                data-slot="button"
                onClick={() => void repair()}
                type="button"
                disabled={state.kind === "running"}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
                )}
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
