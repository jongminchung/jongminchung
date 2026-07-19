import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useEffect, useState } from "react";
import type { CommandLineLauncherInfo } from "../shared/contracts/ipc";
import { tw } from "../styles/tailwind";

export function CommandLineLauncherDialog({
  loadInfo,
  onClose,
}: {
  readonly loadInfo: () => Promise<CommandLineLauncherInfo>;
  readonly onClose: () => void;
}) {
  const [info, setInfo] = useState<CommandLineLauncherInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadInfo().then(
      (value) => active && setInfo(value),
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
    return () => {
      active = false;
    };
  }, [loadInfo]);

  return (
    <Dialog
      aria-label="Configuring Command-Line Launcher"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={560}
    >
      <section className={tw.commandLineLauncherDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Configuring Command-Line Launcher"
        />
        <main>
          {error ? (
            <EmptyState title={error} />
          ) : info === null ? (
            <EmptyState title="Locating the application launcher…" />
          ) : (
            <>
              <p>
                To make Git Client accessible from the command line, add this directory to your
                <code>$PATH</code>:
              </p>
              <pre>{info.directory}</pre>
              <p>
                Then use <code>{info.command}</code> to launch Git Client.
              </p>
            </>
          )}
        </main>
        <footer>
          <Button label="OK" onClick={onClose} variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
