import { Button } from "@base-ui/react/button";
import { useState } from "react";
import type { BookmarkGroup } from "../domain/bookmarks";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { CheckboxInput } from "./ui";
import { Dialog, DialogHeader } from "./ui";
import { List, ListItem } from "./ui";

export function BookmarkGroupSelectDialog({
  groups,
  onClose,
  onSelect,
}: {
  readonly groups: readonly BookmarkGroup[];
  readonly onClose: () => void;
  readonly onSelect: (groupId: string, useAsDefault: boolean) => void;
}) {
  const [selectedId, setSelectedId] = useState(groups[0]?.id ?? "");
  const [useAsDefault, setUseAsDefault] = useState(false);
  const submit = (): void => {
    if (selectedId) onSelect(selectedId, useAsDefault);
  };
  return (
    <Dialog
      aria-label="Select Bookmark List"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={430}
    >
      <section className={tw.bookmarkGroupSelectDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Select Bookmark List"
        />
        <List aria-label="Bookmark list" density="compact" role="listbox">
          {groups.map((group) => (
            <ListItem
              description={group.isDefault ? "Default" : `${group.bookmarks.length} bookmarks`}
              isSelected={group.id === selectedId}
              key={group.id}
              label={group.name}
              onClick={() => setSelectedId(group.id)}
              role="option"
              startContent={<Icon name="bookmarksList" size={13} />}
            />
          ))}
        </List>
        <CheckboxInput
          label="Use as default list"
          onChange={setUseAsDefault}
          size="sm"
          value={useAsDefault}
        />
        <p>
          New bookmarks will be added here automatically. You can change the default list at any
          time in the Bookmarks tool window.
        </p>
        <footer>
          <Button
            data-slot="button"
            onClick={onClose}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
            )}
          >
            Cancel
          </Button>
          <Button
            data-slot="button"
            onClick={submit}
            type="button"
            disabled={!selectedId}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            Select
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
