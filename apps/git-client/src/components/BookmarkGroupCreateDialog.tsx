import { Button } from "@base-ui/react/button";
import { useState } from "react";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
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
            type="submit"
            disabled={error !== null}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            Create
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
