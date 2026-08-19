"use client";

import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import {
    createContext,
    lazy,
    type ReactNode,
    Suspense,
    use,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from "react";
import { Icon } from "#components/Icon";
import type { Locale } from "#lib/content-model";
import { useTechUiStore } from "./TechUiProvider";

const SearchDialog = lazy(() =>
    import("./SearchDialog").then((module) => ({
        default: module.SearchDialog,
    })),
);

interface SearchContextValue {
    readonly locale: Locale;
    readonly open: (trigger: HTMLButtonElement | null) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

function findVisibleTrigger(): HTMLButtonElement | null {
    return (
        Array.from(
            document.querySelectorAll<HTMLButtonElement>(
                "[data-docs-search-trigger]",
            ),
        ).find((trigger) => trigger.getClientRects().length > 0) ?? null
    );
}

/** `SearchProvider` UI 컴포넌트를 렌더링함 */
export function SearchProvider({
    locale,
    children,
}: {
    readonly locale: Locale;
    readonly children: ReactNode;
}) {
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const isOpen = useTechUiStore((state) => state.searchOpen);
    const hasOpened = useTechUiStore((state) => state.searchHasOpened);
    const openSearch = useTechUiStore((state) => state.openSearch);
    const closeSearch = useTechUiStore((state) => state.closeSearch);

    const open = useCallback(
        (trigger: HTMLButtonElement | null): void => {
            triggerRef.current = trigger ?? findVisibleTrigger();
            openSearch();
        },
        [openSearch],
    );

    useEffect(() => {
        const handleShortcut = (event: globalThis.KeyboardEvent): void => {
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === "k"
            ) {
                event.preventDefault();
                open(null);
            }
        };
        window.addEventListener("keydown", handleShortcut);
        return () => window.removeEventListener("keydown", handleShortcut);
    }, [open]);

    const changeOpen = useCallback(
        (nextOpen: boolean): void => {
            if (nextOpen) openSearch();
            else {
                closeSearch();
                requestAnimationFrame(() => triggerRef.current?.focus());
            }
        },
        [closeSearch, openSearch],
    );

    const context = useMemo(() => ({ locale, open }), [locale, open]);

    return (
        <SearchContext value={context}>
            {children}
            {hasOpened ? (
                <Suspense fallback={null}>
                    <SearchDialog
                        key={locale}
                        locale={locale}
                        open={isOpen}
                        onOpenChange={changeOpen}
                    />
                </Suspense>
            ) : null}
        </SearchContext>
    );
}

/** `SearchTrigger` UI 컴포넌트를 렌더링함 */
export function SearchTrigger({
    compact = false,
    showShortcut = true,
}: {
    readonly compact?: boolean;
    readonly showShortcut?: boolean;
}) {
    const context = use(SearchContext);
    if (context === null)
        throw new Error(
            "SearchTrigger must be rendered inside SearchProvider.",
        );
    const label =
        context.locale === "ko" ? "문서 검색" : "Search documentation";
    return (
        <Button
            aria-label={label}
            className={cn(
                "[&_kbd]:rounded-xs [&_kbd]:border [&_kbd]:border-border [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:text-[10px] [&_kbd]:text-foreground",
                compact
                    ? "min-h-11 min-w-11 px-[7px]"
                    : "h-8 w-full justify-between px-3 text-xs",
            )}
            data-docs-search-trigger="true"
            onClick={(event) => context.open(event.currentTarget)}
            size={compact ? "icon" : "default"}
            variant="ghost"
        >
            <span className="inline-flex items-center gap-[7px]">
                <Icon icon="search" />
                {compact ? null : (
                    <span>{context.locale === "ko" ? "검색" : "Search"}</span>
                )}
            </span>
            {showShortcut && !compact ? <kbd>⌘K</kbd> : null}
        </Button>
    );
}
