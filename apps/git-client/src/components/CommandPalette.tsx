import { useEffect, useId, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { sortPaletteItems } from "../domain/commands";
import type { PaletteItem, PaletteScope } from "../domain/commands";
import { CommandPaletteInput, CommandPaletteItem, CommandPaletteList } from "./ui";
import { Dialog } from "./ui";

const PALETTE_COPY = {
  all: {
    label: "Search Everywhere",
    placeholder: "Type a command, repository, ref, commit, file, or change",
  },
  files: { label: "Go to File", placeholder: "Enter file name" },
  recentFiles: { label: "Recent Files", placeholder: "Search recent files" },
  recentLocations: { label: "Recent Locations", placeholder: "Search recent locations" },
  recentlyChangedFiles: { label: "Recently Changed Files", placeholder: "Search changed files" },
  classes: { label: "Go to Class", placeholder: "Enter class name" },
  symbols: { label: "Go to Symbol", placeholder: "Enter symbol name" },
  text: { label: "Go to Text", placeholder: "Enter text to search" },
} as const satisfies Readonly<
  Record<PaletteScope, Readonly<{ label: string; placeholder: string }>>
>;

export function CommandPalette({
  items,
  onClose,
  onExecute,
  onAnnounce,
  scope,
}: {
  readonly items: readonly PaletteItem[];
  readonly onClose: () => void;
  readonly onExecute: (item: PaletteItem) => Promise<void>;
  readonly onAnnounce: (message: string) => void;
  readonly scope: PaletteScope;
}): ReactNode {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const scopedItems = useMemo(
    () => (scope === "all" ? items : items.filter((item) => item.scopes?.includes(scope))),
    [items, scope],
  );
  const results = useMemo(() => sortPaletteItems(scopedItems, query), [query, scopedItems]);
  const copy = PALETTE_COPY[scope];

  useEffect(() => setActiveIndex(0), [query]);

  const activate = async (item: PaletteItem): Promise<void> => {
    if (item.availability.status === "disabled") {
      onAnnounce(item.availability.reason);
      return;
    }
    onClose();
    await onExecute(item);
  };

  const navigate = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "ArrowDown") {
      setActiveIndex((current) => Math.min(results.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      setActiveIndex((current) => Math.max(0, current - 1));
    } else if (event.key === "Home") {
      setActiveIndex(0);
    } else if (event.key === "End") {
      setActiveIndex(Math.max(0, results.length - 1));
    } else if (event.key === "Enter") {
      const item = results[activeIndex];
      if (item) void activate(item);
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <Dialog
      aria-label={copy.label}
      isOpen
      maxHeight={540}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      padding={0}
      purpose="info"
      width={680}
    >
      <div className="flex min-h-0 flex-col" onKeyDown={navigate}>
        <CommandPaletteInput
          aria-activedescendant={results[activeIndex] ? `palette-option-${activeIndex}` : undefined}
          aria-controls={listId}
          endContent={<kbd>Esc</kbd>}
          onValueChange={setQuery}
          placeholder={copy.placeholder}
          value={query}
        />
        <CommandPaletteList
          className="min-h-0 overflow-auto"
          id={listId}
          label={copy.label}
          tabIndex={0}
        >
          {results.length === 0 ? (
            <p className="m-0 p-6 text-center text-secondary">
              No commands or loaded items match “{query}”.
            </p>
          ) : (
            results.map((item, index) => (
              <CommandPaletteItem
                id={`palette-option-${index}`}
                isDisabled={item.availability.status === "disabled"}
                isHighlighted={index === activeIndex}
                key={item.id}
                onSelect={() => void activate(item)}
                value={item.id}
              >
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <strong className="truncate">{item.label}</strong>
                  <small className="truncate text-secondary">
                    {item.availability.status === "disabled"
                      ? item.availability.reason
                      : item.detail}
                  </small>
                </span>
                <em className="not-italic text-secondary">{item.category}</em>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </CommandPaletteItem>
            ))
          )}
        </CommandPaletteList>
      </div>
    </Dialog>
  );
}
