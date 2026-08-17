import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from "@jongminchung/ui/components/command";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { sortPaletteItems } from "../domain/commands";
import type { PaletteItem, PaletteScope } from "../domain/commands";
import { Dialog } from "./ProductDialog";

const PALETTE_COPY = {
    all: {
        label: "Search Everywhere",
        placeholder: "Type a command, repository, ref, commit, file, or change",
    },
    files: { label: "Go to File", placeholder: "Enter file name" },
    recentFiles: { label: "Recent Files", placeholder: "Search recent files" },
    recentLocations: {
        label: "Recent Locations",
        placeholder: "Search recent locations",
    },
    recentlyChangedFiles: {
        label: "Recently Changed Files",
        placeholder: "Search changed files",
    },
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
    const [selectedItemId, setSelectedItemId] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const itemElementsRef = useRef(new Map<string, HTMLDivElement>());
    useEffect(() => inputRef.current?.focus(), []);
    const scopedItems = useMemo(
        () =>
            scope === "all"
                ? items
                : items.filter((item) => item.scopes?.includes(scope)),
        [items, scope],
    );
    const results = useMemo(
        () => sortPaletteItems(scopedItems, query),
        [query, scopedItems],
    );
    useEffect(() => {
        setSelectedItemId((current) => {
            const currentItem = results.find((item) => item.id === current);
            if (currentItem?.availability.status !== "disabled") return current;
            return (
                results.find((item) => item.availability.status !== "disabled")
                    ?.id ?? ""
            );
        });
    }, [results]);
    useEffect(() => {
        const input = inputRef.current;
        if (input === null) return;
        const optionId = itemElementsRef.current.get(selectedItemId)?.id;
        if (optionId === undefined) {
            input.removeAttribute("aria-activedescendant");
            return;
        }
        input.setAttribute("aria-activedescendant", optionId);
    }, [results, selectedItemId]);
    const copy = PALETTE_COPY[scope];

    const activate = async (item: PaletteItem): Promise<void> => {
        if (item.availability.status === "disabled") {
            onAnnounce(item.availability.reason);
            return;
        }
        onClose();
        await onExecute(item);
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
            <Command
                className="min-h-0 rounded-lg"
                onValueChange={setSelectedItemId}
                shouldFilter={false}
                value={selectedItemId}
            >
                <div className="relative border-b border-border pr-12">
                    <CommandInput
                        aria-label={copy.label}
                        ref={inputRef}
                        onValueChange={setQuery}
                        placeholder={copy.placeholder}
                        value={query}
                    />
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2">
                        Esc
                    </kbd>
                </div>
                <CommandList
                    aria-label={copy.label}
                    className="min-h-0 max-h-[492px] overflow-auto"
                >
                    <CommandEmpty>
                        No commands or loaded items match “{query}”.
                    </CommandEmpty>
                    {results.map((item) => (
                        <CommandItem
                            className="min-h-11 gap-3 px-2.5 text-xs"
                            disabled={item.availability.status === "disabled"}
                            key={item.id}
                            onSelect={() => void activate(item)}
                            ref={(element) => {
                                if (element === null) {
                                    itemElementsRef.current.delete(item.id);
                                    return;
                                }
                                itemElementsRef.current.set(item.id, element);
                            }}
                            value={item.id}
                        >
                            <span className="grid min-w-0 flex-1 gap-0.5">
                                <strong className="truncate">
                                    {item.label}
                                </strong>
                                <small className="truncate text-muted-foreground">
                                    {item.availability.status === "disabled"
                                        ? item.availability.reason
                                        : item.detail}
                                </small>
                            </span>
                            <em className="not-italic text-muted-foreground">
                                {item.category}
                            </em>
                            {item.shortcut && <kbd>{item.shortcut}</kbd>}
                        </CommandItem>
                    ))}
                </CommandList>
            </Command>
        </Dialog>
    );
}
