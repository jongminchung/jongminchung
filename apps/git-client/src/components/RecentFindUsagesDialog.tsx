import { tw } from "../styles/tailwind";
import type { FindResultsSession } from "./FindResultsPanel";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { EmptyState } from "./ui";
import { List, ListItem } from "./ui";

export function RecentFindUsagesDialog({
  history,
  onChoose,
  onClose,
}: {
  readonly history: readonly FindResultsSession[];
  readonly onChoose: (session: FindResultsSession) => void;
  readonly onClose: () => void;
}) {
  return (
    <Dialog
      aria-label="Recent Find Usages"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={480}
    >
      <section className={tw.recentFindUsagesDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Recent Find Usages"
        />
        {history.length === 0 ? (
          <EmptyState title="No Recent Find Usages Entries" />
        ) : (
          <List aria-label="Recent Find Usages" density="compact" role="listbox">
            {history.map((session, index) => (
              <ListItem
                description={`${session.results.length.toLocaleString()} usages`}
                key={`${session.query}:${index}`}
                label={session.query}
                onClick={() => onChoose(session)}
                role="option"
                startContent={<Icon name="search" size={14} />}
              />
            ))}
          </List>
        )}
      </section>
    </Dialog>
  );
}
