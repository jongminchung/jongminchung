import { Button } from "@base-ui/react/button";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Dialog, DialogHeader } from "./ui";

export function InvalidateCachesDialog({
  onClose,
  onInvalidateAndRestart,
  onRestart,
}: {
  readonly onClose: () => void;
  readonly onInvalidateAndRestart: () => Promise<void>;
  readonly onRestart: () => Promise<void>;
}) {
  return (
    <Dialog
      aria-label="Invalidate Caches"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={540}
    >
      <section className={tw.invalidateCachesDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Invalidate Caches"
        />
        <main>
          <p>
            Remove caches and indexes for all projects. New caches will be built when you reopen the
            projects.
          </p>
          <p>
            Project files, Git history, local settings, accounts, and Local History are not removed.
          </p>
        </main>
        <footer>
          <Button
            data-slot="button"
            onClick={() => void onRestart()}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
            )}
          >
            Just Restart
          </Button>
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
            onClick={() => void onInvalidateAndRestart()}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            Invalidate and Restart
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
