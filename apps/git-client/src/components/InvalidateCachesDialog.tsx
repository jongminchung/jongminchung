import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { tw } from "../styles/tailwind";

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
          <p>Remove caches and indexes for all projects. New caches will be built when you reopen the projects.</p>
          <p>Project files, Git history, local settings, accounts, and Local History are not removed.</p>
        </main>
        <footer>
          <Button label="Just Restart" onClick={() => void onRestart()} variant="secondary" />
          <Button label="Cancel" onClick={onClose} variant="secondary" />
          <Button label="Invalidate and Restart" onClick={() => void onInvalidateAndRestart()} variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
