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
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "#lib/content-model";
import { searchMatchLabels } from "#lib/tech/copy";
import { searchIndexQueryOptions } from "#lib/tech/queries";
import { searchDocuments, type SearchHit } from "#lib/tech/search";
import { getSeries } from "#lib/tech/series";

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
    group:
      hit.document.series === undefined
        ? locale === "ko"
          ? "블로그"
          : "Blog"
        : (getSeries(hit.document.series, locale)?.title ??
          hit.document.series),
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
        className="max-w-xl overflow-hidden p-0"
        aria-describedby={undefined}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {locale === "ko" ? "문서 검색" : "Search documentation"}
        </DialogTitle>
        <Command key={locale} className="rounded-lg" shouldFilter={false}>
          <div className="flex min-h-[54px] items-center gap-2.5 border-b px-4 [&_[data-slot=command-input-wrapper]]:min-w-0 [&_[data-slot=command-input-wrapper]]:flex-1 [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-0 [&_input]:bg-transparent [&_input]:outline-none [&_kbd]:rounded-[var(--radius-xs)] [&_kbd]:border [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:text-[10px] [&_kbd]:text-muted-foreground">
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
            className="grid max-h-[min(460px,60dvh)] gap-0.5 overflow-y-auto p-1.5"
            aria-label={locale === "ko" ? "검색 결과" : "Search results"}
          >
            {searchIndex.isPending ? (
              <p
                className="m-0 px-4 py-[30px] text-center text-muted-foreground"
                role="status"
              >
                {locale === "ko"
                  ? "검색 색인을 불러오는 중"
                  : "Loading search index"}
              </p>
            ) : null}
            {searchIndex.isError ? (
              <div
                className="m-0 px-4 py-[30px] text-center text-muted-foreground"
                role="alert"
              >
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
                      <span className="grid min-w-0 gap-0.5 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap">
                        <strong>{item.label}</strong>
                        <span className="flex gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground [&>span]:shrink-0 [&>span]:font-semibold [&>span]:text-primary">
                          <span>{item.matchLabel}</span>
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
