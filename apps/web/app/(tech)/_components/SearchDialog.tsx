"use client";

import { Button } from "@jongminchung/ui/components/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@jongminchung/ui/components/command";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@jongminchung/ui/components/dialog";
import { cn } from "@jongminchung/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "#lib/content-model";
import { searchMatchLabels, techSectionLabels } from "#lib/tech/copy";
import { searchIndexQueryOptions } from "#lib/tech/queries";
import { searchDocuments, type SearchHit } from "#lib/tech/search";
import styles from "./SearchPalette.module.css";

interface SearchItem {
    readonly href: string;
    readonly label: string;
    readonly matchLabel: string;
    readonly matchText: string;
    readonly group: string;
}

function toItem(locale: Locale, hit: SearchHit): SearchItem {
    return {
        href: hit.document.href,
        label: hit.document.title,
        group: techSectionLabels[locale][hit.document.section],
        matchLabel: searchMatchLabels[locale][hit.match.field],
        matchText: hit.match.text,
    };
}

/** `SearchDialog` UI 컴포넌트를 렌더링함 */
export function SearchDialog({
    locale,
    open,
    onOpenChange,
}: {
    readonly locale: Locale;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const [query, setQuery] = useState("");
    const searchIndex = useQuery(searchIndexQueryOptions(locale));

    const items = useMemo(() => {
        if (searchIndex.data === undefined) return [];
        return searchDocuments(
            searchIndex.data,
            query,
            query === "" ? 8 : undefined,
        ).map((hit) => toItem(locale, hit));
    }, [locale, query, searchIndex.data]);

    useEffect(() => setQuery(""), [locale]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const changeOpen = (nextOpen: boolean): void => {
        if (!nextOpen) setQuery("");
        onOpenChange(nextOpen);
    };

    const select = (item: SearchItem): void => {
        changeOpen(false);
        router.push(item.href);
    };

    return (
        <Dialog open={open} onOpenChange={changeOpen}>
            <DialogContent
                className={cn(styles.dialog, "max-w-xl p-0")}
                aria-describedby={undefined}
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">
                    {locale === "ko" ? "문서 검색" : "Search documentation"}
                </DialogTitle>
                <Command
                    key={locale}
                    className="rounded-lg"
                    shouldFilter={false}
                >
                    <div className={styles.inputRow}>
                        <CommandInput
                            ref={inputRef}
                            value={query}
                            onValueChange={setQuery}
                            placeholder={
                                locale === "ko"
                                    ? "제목, API, 주제 검색"
                                    : "Search titles, APIs, and topics"
                            }
                        />
                        <kbd>Esc</kbd>
                    </div>
                    <CommandList
                        className={styles.list}
                        aria-label={
                            locale === "ko" ? "검색 결과" : "Search results"
                        }
                    >
                        {searchIndex.isPending ? (
                            <p className={styles.empty} role="status">
                                {locale === "ko"
                                    ? "검색 색인을 불러오는 중"
                                    : "Loading search index"}
                            </p>
                        ) : null}
                        {searchIndex.isError ? (
                            <div className={styles.empty} role="alert">
                                <p>
                                    {locale === "ko"
                                        ? "검색 색인을 불러오지 못했습니다"
                                        : "Search index failed"}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void searchIndex.refetch()}
                                >
                                    {locale === "ko" ? "다시 시도" : "Retry"}
                                </Button>
                            </div>
                        ) : null}
                        {searchIndex.isSuccess ? (
                            <>
                                <CommandEmpty>
                                    {locale === "ko"
                                        ? "검색 결과가 없습니다"
                                        : "No matching documents"}
                                </CommandEmpty>
                                <CommandGroup>
                                    {items.map((item) => (
                                        <CommandItem
                                            className="min-h-[58px] justify-between gap-4"
                                            key={item.href}
                                            value={`${item.href} ${item.label} ${item.matchText}`}
                                            onSelect={() => select(item)}
                                        >
                                            <span className={styles.result}>
                                                <strong>{item.label}</strong>
                                                <span
                                                    className={
                                                        styles.matchReason
                                                    }
                                                >
                                                    <span>
                                                        {item.matchLabel}
                                                    </span>
                                                    {item.matchText}
                                                </span>
                                            </span>
                                            <small>{item.group}</small>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        ) : null}
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
