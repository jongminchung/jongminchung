import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import type { GitActivity } from "../domain/gitActivity";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { EmptyState } from "./ProductCollections";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

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
              onClick={() => void onCancelActivity()}
              type="button"
              className={cn("h-8 px-3")}
              variant="outline"
              size="default"
            >
              Cancel Process
            </Button>
          )}
          <span />
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
