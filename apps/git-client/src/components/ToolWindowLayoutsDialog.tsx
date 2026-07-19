import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { List, ListItem } from "@astryxdesign/core/List";
import type { NamedToolWindowLayout } from "../domain/toolWindowLayouts";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

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
      <section className={tw.toolWindowLayoutsDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title={title}
        />
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
