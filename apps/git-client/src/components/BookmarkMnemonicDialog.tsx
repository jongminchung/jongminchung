import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState, type KeyboardEvent } from "react";
import { isBookmarkMnemonic, type BookmarkMnemonic } from "../domain/bookmarks";
import { Dialog, DialogHeader } from "./ProductDialog";
import { TextInput } from "./ProductFormControls";

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
      <section
        className={`bookmarkMnemonicDialog [display:grid] [gap:12px] [padding-bottom:12px] [&>_*:not(:first-child)]:[margin-left:12px] [&>_*:not(:first-child)]:[margin-right:12px] [&>_p]:[color:var(--muted-foreground)] [&>_p]:[font-size:10px] [&>_p]:[margin-bottom:0] [&>_p]:[margin-top:-3px] [&>_footer]:[display:flex] [&>_footer]:[gap:7px] [&>_footer]:[justify-content:flex-end] bookmarkMnemonicDialog`}
        onKeyDown={onKeyDown}
      >
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        <div
          className={`bookmarkMnemonicGrid [display:grid] [gap:4px] [grid-template-columns:repeat(10,_1fr)] [&>_button]:[background:var(--muted)] [&>_button]:[border:1px_solid_transparent] [&>_button]:rounded-sm [&>_button]:[color:var(--foreground)] [&>_button]:[font-family:var(--font-family-code)] [&>_button]:[font-size:11px] [&>_button]:[height:28px] [&>_button:hover]:[background:var(--overlay-hover)] [&>_button[aria-selected=true]]:[background:var(--accent)] [&>_button[aria-selected=true]]:[border-color:var(--primary)] [&>_button[data-assigned=true]]:[color:var(--disabled-foreground)] [&>_button[data-assigned=true]]:[text-decoration:underline] bookmarkMnemonicGrid [&>_button]:rounded-sm`}
          role="listbox"
          aria-label="Bookmark mnemonics"
        >
          {MNEMONICS.map((mnemonic) => (
            <Button
              aria-label={`Mnemonic ${mnemonic}${assigned.has(mnemonic) && mnemonic !== current ? ", already used" : ""}`}
              aria-selected={selected === mnemonic}
              data-assigned={assigned.has(mnemonic) && mnemonic !== current ? "true" : undefined}
              key={mnemonic}
              onClick={() => setSelected(mnemonic)}
              onDoubleClick={() => onChoose(mnemonic, description)}
              role="option"
              type="button"
              className={cn(
                "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
              )}
              variant="ghost"
              size="default"
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
            onClick={onClose}
            type="button"
            className={cn("h-8 px-3")}
            variant="outline"
            size="default"
          >
            Cancel
          </Button>
          <Button
            onClick={choose}
            type="button"
            disabled={!selected}
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            OK
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
