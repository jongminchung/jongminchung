import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { List, ListItem } from "@astryxdesign/core/List";
import { useState } from "react";
import type { BookmarkGroup } from "../domain/bookmarks";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

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
        <p>New bookmarks will be added here automatically. You can change the default list at any time in the Bookmarks tool window.</p>
        <footer>
          <Button label="Cancel" onClick={onClose} size="md" variant="secondary" />
          <Button isDisabled={!selectedId} label="Select" onClick={submit} size="md" variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
