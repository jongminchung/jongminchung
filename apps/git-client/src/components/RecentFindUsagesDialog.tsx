import type { FindResultsSession } from "./FindResultsPanel";
import { Icon } from "./Icon";
import { EmptyState } from "./ProductCollections";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

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
      <section
        className={`recentFindUsagesDialog [display:grid] [grid-template-rows:auto_minmax(190px,_1fr)] [max-height:min(480px,_calc(100vh_-_90px))] [&>_[data-slot=empty-state]]:[min-height:190px] [&>_div[role=listbox]]:[min-height:0] [&>_div[role=listbox]]:[overflow:auto] [&>_div[role=listbox]]:[padding:6px] recentFindUsagesDialog`}
      >
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
