import type { CommandId } from "../domain/commands";
import { Icon, type IconName } from "./Icon";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

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
            <section
                className={`vcsOperationsPopup [display:grid] [grid-template-rows:auto_minmax(0,_1fr)] [max-height:min(720px,_calc(100vh_-_82px))] [&>_main]:[min-height:0] [&>_main]:[overflow:auto] [&>_main]:[padding:5px] [&>_main>_section]:[padding:2px_0] [&>_main>_section+section]:[border-top:1px_solid_var(--border)] [&>_main_h3]:[color:var(--muted-foreground)] [&>_main_h3]:[font-size:10px] [&>_main_h3]:[font-weight:600] [&>_main_h3]:[margin:4px_8px_2px] [&>_main_kbd]:[color:var(--disabled-foreground)] [&>_main_kbd]:[font-family:var(--font-family-code)] [&>_main_[aria-disabled=true]]:[opacity:.48] vcsOperationsPopup`}
            >
                <DialogHeader
                    hasDivider
                    onOpenChange={(open) => !open && onClose()}
                    title="VCS Operations"
                />
                <main>
                    {groups.map((group, groupIndex) => (
                        <section
                            key={`${group.label ?? "operations"}:${groupIndex}`}
                        >
                            {group.label && <h3>{group.label}</h3>}
                            <List
                                aria-label={group.label ?? "VCS operations"}
                                density="compact"
                                role="listbox"
                            >
                                {group.items.map((item) => (
                                    <ListItem
                                        endContent={
                                            item.shortcut ? (
                                                <kbd>{item.shortcut}</kbd>
                                            ) : undefined
                                        }
                                        description={item.disabledReason}
                                        isDisabled={Boolean(
                                            item.disabledReason,
                                        )}
                                        key={`${item.commandId}:${item.label}`}
                                        label={item.label}
                                        onClick={
                                            item.disabledReason
                                                ? undefined
                                                : () => void activate(item)
                                        }
                                        aria-selected={false}
                                        role="option"
                                        startContent={
                                            <Icon name={item.icon} size={14} />
                                        }
                                        tabIndex={-1}
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
