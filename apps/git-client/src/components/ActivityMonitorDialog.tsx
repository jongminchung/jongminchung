import { useEffect, useState } from "react";
import type { DiagnosticSnapshot } from "../shared/contracts/ipc";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { Dialog, DialogHeader } from "./ui";
import { EmptyState } from "./ui";
import { List, ListItem } from "./ui";

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
      <section className={tw.activityMonitorDialog}>
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
                    <span className={tw.activityMonitorMetrics}>
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
          <Button label="Close" onClick={onClose} variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
