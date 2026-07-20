import { useState, type KeyboardEvent } from "react";
import { isBookmarkMnemonic, type BookmarkMnemonic } from "../domain/bookmarks";
import { tw } from "../styles/tailwind";
import { Button } from "./ui";
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
            <button
              aria-label={`Mnemonic ${mnemonic}${assigned.has(mnemonic) && mnemonic !== current ? ", already used" : ""}`}
              aria-selected={selected === mnemonic}
              data-assigned={assigned.has(mnemonic) && mnemonic !== current ? "true" : undefined}
              key={mnemonic}
              onClick={() => setSelected(mnemonic)}
              onDoubleClick={() => onChoose(mnemonic, description)}
              role="option"
            >
              {mnemonic}
            </button>
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
          <Button label="Cancel" onClick={onClose} size="md" variant="secondary" />
          <Button isDisabled={!selected} label="OK" onClick={choose} size="md" variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
