import { useState } from "react";
import { tw } from "../styles/tailwind";
import { Button } from "./ui";
import { CheckboxInput } from "./ui";
import { Dialog, DialogHeader } from "./ui";
import { TextInput } from "./ui";

export function BookmarkGroupCreateDialog({
  existingNames,
  onClose,
  onCreate,
}: {
  readonly existingNames: ReadonlySet<string>;
  readonly onClose: () => void;
  readonly onCreate: (name: string, isDefault: boolean) => void;
}) {
  const [name, setName] = useState("New List");
  const [isDefault, setIsDefault] = useState(false);
  const normalized = name.trim();
  const error =
    normalized === ""
      ? "Enter a bookmark list name."
      : existingNames.has(normalized)
        ? "A list with the specified name already exists"
        : null;
  const submit = (): void => {
    if (error) return;
    onCreate(normalized, isDefault);
  };
  return (
    <Dialog
      aria-label="Create Bookmark List"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={410}
    >
      <form
        className={tw.bookmarkGroupCreateDialog}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Create Bookmark List"
        />
        <TextInput
          hasAutoFocus
          label="Bookmark list:"
          onChange={setName}
          size="md"
          status={error ? { type: "error", message: error } : undefined}
          value={name}
          width="100%"
        />
        <CheckboxInput
          label="Use as default list"
          onChange={setIsDefault}
          size="sm"
          value={isDefault}
        />
        <p>
          New bookmarks will be added here automatically. You can change the default list at any
          time in the Bookmarks tool window.
        </p>
        <footer>
          <Button label="Cancel" onClick={onClose} size="md" type="button" variant="secondary" />
          <Button
            isDisabled={error !== null}
            label="Create"
            size="md"
            type="submit"
            variant="primary"
          />
        </footer>
      </form>
    </Dialog>
  );
}
