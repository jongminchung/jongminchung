import { Button } from "@base-ui/react/button";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import type { CommandLineLauncherInfo } from "../shared/contracts/ipc";
import { tw } from "../styles/tailwind";
import { Dialog, DialogHeader } from "./ui";
import { EmptyState } from "./ui";

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
          <Button
            data-slot="button"
            onClick={onClose}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            OK
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
