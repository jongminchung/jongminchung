import type { NamedToolWindowLayout } from "../domain/toolWindowLayouts";
import { Icon } from "./Icon";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

export function ToolWindowLayoutsDialog({
  layouts,
  onChoose,
  onClose,
  title,
}: {
  readonly layouts: readonly NamedToolWindowLayout[];
  readonly onChoose: (layout: NamedToolWindowLayout) => void;
  readonly onClose: () => void;
  readonly title: string;
}) {
  return (
    <Dialog
      aria-label={title}
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={420}
    >
      <section
        className={`toolWindowLayoutsDialog [display:grid] [grid-template-rows:auto_minmax(180px,_1fr)] [max-height:min(520px,_calc(100vh_-_80px))] [&>_div[role=listbox]]:[min-height:0] [&>_div[role=listbox]]:[overflow:auto] [&>_div[role=listbox]]:[padding:6px] toolWindowLayoutsDialog`}
      >
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        <List aria-label="Saved layouts" density="compact" role="listbox">
          {layouts.map((layout) => (
            <ListItem
              key={layout.id}
              label={layout.name}
              onClick={() => onChoose(layout)}
              role="option"
              startContent={<Icon name="split" size={14} />}
            />
          ))}
        </List>
      </section>
    </Dialog>
  );
}
