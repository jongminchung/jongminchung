import { useEffect, useState, type KeyboardEvent } from "react";
import type { LineBookmark, ProjectBookmarks } from "../domain/bookmarks";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { List, ListItem } from "./ui";

export type BookmarksPopupMode = "lines" | "mnemonics";

export function BookmarksPopup({
  mode,
  state,
  onClose,
  onOpenBookmark,
}: {
  readonly mode: BookmarksPopupMode;
  readonly state: ProjectBookmarks;
  readonly onClose: () => void;
  readonly onOpenBookmark: (bookmark: LineBookmark) => void;
}) {
  const bookmarks = state.groups
    .flatMap((group) => group.bookmarks)
    .filter((bookmark) => mode === "lines" || bookmark.mnemonic !== null);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => setActiveIndex(0), [mode]);
  const activate = (bookmark: LineBookmark): void => {
    onClose();
    onOpenBookmark(bookmark);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "ArrowDown") {
      setActiveIndex((index) => Math.min(bookmarks.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Home") setActiveIndex(0);
    else if (event.key === "End") setActiveIndex(Math.max(0, bookmarks.length - 1));
    else if (event.key === "Enter") {
      const bookmark = bookmarks[activeIndex];
      if (bookmark) activate(bookmark);
    } else return;
    event.preventDefault();
  };
  const title = mode === "lines" ? "Bookmarks" : "Go to Mnemonic";

  return (
    <Dialog
      aria-label={title}
      isOpen
      maxHeight="min(640px, calc(100vh - 82px))"
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={mode === "lines" ? "min(760px, calc(100vw - 72px))" : "min(640px, calc(100vw - 72px))"}
    >
      <section className={tw.bookmarksPopup} onKeyDown={onKeyDown}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        {bookmarks.length === 0 ? (
          <div className={tw.bookmarksEmptyState}>
            <strong>No bookmarks added.</strong>
            <span>Add Bookmark (F3) to code lines, symbols, files, and directories.</span>
          </div>
        ) : (
          <List aria-label={title} density="compact" role="listbox">
            {bookmarks.map((bookmark, index) => (
              <ListItem
                aria-selected={index === activeIndex}
                description={`${bookmark.path}, line ${bookmark.line}`}
                endContent={bookmark.mnemonic ? <kbd>{bookmark.mnemonic}</kbd> : undefined}
                isSelected={index === activeIndex}
                key={bookmark.id}
                label={bookmark.description || bookmark.path.split("/").at(-1) || bookmark.path}
                onClick={() => activate(bookmark)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                startContent={<Icon name="bookmarkFilled" size={13} />}
              />
            ))}
          </List>
        )}
      </section>
    </Dialog>
  );
}
