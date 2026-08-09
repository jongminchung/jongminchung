import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { Dialog, DialogHeader } from "./ProductDialog";

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
      <section
        className={`invalidateCachesDialog [display:grid] [grid-template-rows:auto_minmax(0,_1fr)_auto] [min-height:220px] [&>_main]:[display:flex] [&>_main]:[flex-direction:column] [&>_main]:[gap:10px] [&>_main]:[padding:18px_20px] [&>_main_p]:[color:var(--muted-foreground)] [&>_main_p]:[line-height:1.5] [&>_main_p]:[margin:0] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[gap:8px] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:10px_12px] invalidateCachesDialog`}
      >
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
            onClick={() => void onRestart()}
            type="button"
            className={cn("h-8 px-3")}
            variant="outline"
            size="default"
          >
            Just Restart
          </Button>
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
            onClick={() => void onInvalidateAndRestart()}
            type="button"
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            Invalidate and Restart
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
