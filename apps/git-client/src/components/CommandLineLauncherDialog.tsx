import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useState } from "react";
import type { CommandLineLauncherInfo } from "../shared/contracts/ipc";
import { EmptyState } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

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
                if (active)
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : String(reason),
                    );
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
            <section
                className={`commandLineLauncherDialog [display:grid] [grid-template-rows:auto_minmax(180px,_auto)_auto] [&>_main]:[align-content:center] [&>_main]:[display:grid] [&>_main]:[gap:10px] [&>_main]:[padding:18px] [&>_main_p]:[color:var(--muted-foreground)] [&>_main_p]:[line-height:1.5] [&>_main_p]:[margin:0] [&>_main_code]:[color:var(--foreground)] [&>_main_pre]:[background:var(--muted)] [&>_main_pre]:[border:1px_solid_var(--border)] [&>_main_pre]:rounded-md [&>_main_pre]:[font-family:var(--font-family-code)] [&>_main_pre]:[margin:0] [&>_main_pre]:[overflow:auto] [&>_main_pre]:[padding:9px_11px] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:8px_10px] commandLineLauncherDialog [&>_main_pre]:rounded-md`}
            >
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
                                To make Git Client accessible from the command
                                line, add this directory to your
                                <code>$PATH</code>:
                            </p>
                            <pre>{info.directory}</pre>
                            <p>
                                Then use <code>{info.command}</code> to launch
                                Git Client.
                            </p>
                        </>
                    )}
                </main>
                <footer>
                    <Button
                        onClick={onClose}
                        type="button"
                        className={cn("h-8 px-3")}
                        variant="default"
                        size="default"
                    >
                        OK
                    </Button>
                </footer>
            </section>
        </Dialog>
    );
}
