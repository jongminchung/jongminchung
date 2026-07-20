import type { GitActivity } from "../domain/gitActivity";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Button } from "./ui";
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
              label="Cancel Process"
              onClick={() => void onCancelActivity()}
              size="md"
              variant="secondary"
            />
          )}
          <span />
          <Button label="Close" onClick={onClose} size="md" variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
