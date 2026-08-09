import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useState } from "react";
import type { DiagnosticSnapshot } from "../shared/contracts/ipc";
import { Icon } from "./Icon";
import { EmptyState } from "./ProductCollections";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

function bytesLabel(bytes: number): string {
  if (bytes < 1_048_576) return `${Math.round(bytes / 1_024)} KiB`;
  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}

export function ActivityMonitorDialog({
  loadSnapshot,
  onClose,
}: {
  readonly loadSnapshot: () => Promise<DiagnosticSnapshot>;
  readonly onClose: () => void;
}) {
  const [snapshot, setSnapshot] = useState<DiagnosticSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async (): Promise<void> => {
      try {
        const next = await loadSnapshot();
        if (!active) return;
        setSnapshot(next);
        setError(null);
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loadSnapshot]);

  return (
    <Dialog
      aria-label="Activity Monitor"
      isOpen
      maxHeight="min(680px, calc(100vh - 70px))"
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width="min(680px, calc(100vw - 70px))"
    >
      <section
        className={`activityMonitorDialog [display:grid] [grid-template-rows:auto_30px_minmax(300px,_1fr)_auto] [height:min(620px,_calc(100vh_-_80px))] [&>_header]:[align-items:center] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[color:var(--muted-foreground)] [&>_header]:[display:grid] [&>_header]:[grid-template-columns:minmax(0,_1fr)_90px_100px] [&>_header]:[padding:0_12px] [&>_header]:[font-size:11px] [&>_main]:[min-height:0] [&>_main]:[overflow:auto] [&>_main>_div[role=list]]:[padding:5px] [&>_footer]:[align-items:center] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[color:var(--muted-foreground)] [&>_footer]:[display:flex] [&>_footer]:[justify-content:space-between] [&>_footer]:[padding:8px_10px] activityMonitorDialog`}
      >
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Activity Monitor"
        />
        <header>
          <strong>Process</strong>
          <strong>CPU</strong>
          <strong>Memory</strong>
        </header>
        <main>
          {error ? (
            <EmptyState title={error} />
          ) : snapshot === null ? (
            <EmptyState title="Collecting process activity…" />
          ) : (
            <List aria-label="Application processes" density="compact" role="list">
              {snapshot.processes.map((process) => (
                <ListItem
                  description={`PID ${process.pid}`}
                  endContent={
                    <span
                      className={`activityMonitorMetrics [display:grid] [font-variant-numeric:tabular-nums] [grid-template-columns:90px_100px] [text-align:right] activityMonitorMetrics`}
                    >
                      <span>{process.cpuPercent.toFixed(1)}%</span>
                      <span>{bytesLabel(process.memoryBytes)}</span>
                    </span>
                  }
                  key={process.pid}
                  label={process.type}
                  role="listitem"
                  startContent={<Icon name="refresh" size={14} />}
                />
              ))}
            </List>
          )}
        </main>
        <footer>
          <span>Uptime {snapshot ? Math.floor(snapshot.uptimeSeconds) : 0}s</span>
          <Button
            onClick={onClose}
            type="button"
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            Close
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
