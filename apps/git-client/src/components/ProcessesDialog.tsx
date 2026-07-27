import { Button } from "@base-ui/react/button";
import type { GitActivity } from "../domain/gitActivity";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { EmptyState } from "./ui";
import { List, ListItem } from "./ui";

export function ProcessesDialog({
  activity,
  onCancelActivity,
  onClose,
}: {
  readonly activity: GitActivity | null;
  readonly onCancelActivity: () => Promise<void>;
  readonly onClose: () => void;
}) {
  const runningActivity = activity?.status === "running" ? activity : null;
  return (
    <Dialog
      aria-label="Processes"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={520}
    >
      <section className={tw.processesDialog}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title="Processes" />
        <main>
          {runningActivity === null ? (
            <EmptyState title="No processes are running" />
          ) : (
            <List aria-label="Processes" density="compact" role="list">
              <ListItem
                description={`${runningActivity.requestIds.length} operation(s)`}
                label={runningActivity.label}
                role="listitem"
                startContent={<Icon name="refresh" size={14} />}
              />
            </List>
          )}
        </main>
        <footer>
          {runningActivity !== null && (
            <Button
              data-slot="button"
              onClick={() => void onCancelActivity()}
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
              )}
            >
              Cancel Process
            </Button>
          )}
          <span />
          <Button
            data-slot="button"
            onClick={onClose}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            Close
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
