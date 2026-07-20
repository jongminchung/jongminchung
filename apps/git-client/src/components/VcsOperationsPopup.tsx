import type { CommandId } from "../domain/commands";
import { tw } from "../styles/tailwind";
import { Icon, type IconName } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { List, ListItem } from "./ui";

export interface VcsOperationItem {
  readonly commandId: CommandId;
  readonly disabledReason?: string;
  readonly icon: IconName;
  readonly label: string;
  readonly shortcut?: string;
}

export interface VcsOperationGroup {
  readonly label?: string;
  readonly items: readonly VcsOperationItem[];
}

export function VcsOperationsPopup({
  groups,
  onClose,
  onExecute,
}: {
  readonly groups: readonly VcsOperationGroup[];
  readonly onClose: () => void;
  readonly onExecute: (commandId: CommandId) => Promise<void>;
}) {
  const activate = async (item: VcsOperationItem): Promise<void> => {
    if (item.disabledReason) return;
    onClose();
    await onExecute(item.commandId);
  };

  return (
    <Dialog
      aria-label="VCS Operations"
      isOpen
      maxHeight="min(720px, calc(100vh - 82px))"
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={440}
    >
      <section className={tw.vcsOperationsPopup}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="VCS Operations"
        />
        <main>
          {groups.map((group, groupIndex) => (
            <section key={`${group.label ?? "operations"}:${groupIndex}`}>
              {group.label && <h3>{group.label}</h3>}
              <List aria-label={group.label ?? "VCS operations"} density="compact" role="listbox">
                {group.items.map((item) => (
                  <ListItem
                    endContent={item.shortcut ? <kbd>{item.shortcut}</kbd> : undefined}
                    description={item.disabledReason}
                    isDisabled={Boolean(item.disabledReason)}
                    key={`${item.commandId}:${item.label}`}
                    label={item.label}
                    onClick={item.disabledReason ? undefined : () => void activate(item)}
                    role="option"
                    startContent={<Icon name={item.icon} size={14} />}
                  />
                ))}
              </List>
            </section>
          ))}
        </main>
      </section>
    </Dialog>
  );
}
