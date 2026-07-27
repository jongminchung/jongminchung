import { Button } from "@base-ui/react/button";
import { useState, type KeyboardEvent } from "react";
import { isBookmarkMnemonic, type BookmarkMnemonic } from "../domain/bookmarks";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Dialog, DialogHeader } from "./ui";
import { TextInput } from "./ui";

const MNEMONICS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as BookmarkMnemonic[];

export function BookmarkMnemonicDialog({
  assigned,
  current,
  description: initialDescription,
  creating,
  onClose,
  onChoose,
}: {
  readonly assigned: ReadonlySet<BookmarkMnemonic>;
  readonly current: BookmarkMnemonic | null;
  readonly description: string;
  readonly creating: boolean;
  readonly onClose: () => void;
  readonly onChoose: (mnemonic: BookmarkMnemonic, description: string) => void;
}) {
  const [selected, setSelected] = useState<BookmarkMnemonic | null>(current);
  const [description, setDescription] = useState(initialDescription);
  const choose = (): void => {
    if (selected) onChoose(selected, description);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "Enter" && selected) {
      choose();
      event.preventDefault();
      return;
    }
    if (event.target instanceof HTMLInputElement) return;
    const mnemonic = event.key.toLocaleUpperCase();
    if (!isBookmarkMnemonic(mnemonic)) return;
    setSelected(mnemonic);
    event.preventDefault();
  };
  const title = creating
    ? "Add Mnemonic Bookmark"
    : current === null
      ? "Assign Mnemonic"
      : "Change Mnemonic";

  return (
    <Dialog
      aria-label={title}
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={430}
    >
      <section className={tw.bookmarkMnemonicDialog} onKeyDown={onKeyDown}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        <div className={tw.bookmarkMnemonicGrid} role="listbox" aria-label="Bookmark mnemonics">
          {MNEMONICS.map((mnemonic) => (
            <Button
              data-slot="button"
              aria-label={`Mnemonic ${mnemonic}${assigned.has(mnemonic) && mnemonic !== current ? ", already used" : ""}`}
              aria-selected={selected === mnemonic}
              data-assigned={assigned.has(mnemonic) && mnemonic !== current ? "true" : undefined}
              key={mnemonic}
              onClick={() => setSelected(mnemonic)}
              onDoubleClick={() => onChoose(mnemonic, description)}
              role="option"
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[29px] w-full justify-start whitespace-normal rounded-sm px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
              )}
            >
              {mnemonic}
            </Button>
          ))}
        </div>
        <TextInput
          hasAutoFocus
          label="Description (Optional)"
          onChange={setDescription}
          size="md"
          value={description}
          width="100%"
        />
        <p>Type or double-click a mnemonic to set it. Already used mnemonics are marked.</p>
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
            onClick={choose}
            type="button"
            disabled={!selected}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            OK
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
