"use client";

import { Badge } from "@jongminchung/ui/components/badge";
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
import type { SortedResult } from "fumadocs-core/search";
import { useDocsSearch } from "fumadocs-core/search/client";
import { fetchClient } from "fumadocs-core/search/client/fetch";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { Locale } from "#lib/content-contracts";
import { toSearchItems, type SearchItem } from "#lib/tech/search-results";

const emptyResults: readonly SortedResult[] = [];

/** `SearchDialog` UI 컴포넌트를 렌더링함 */
export function SearchDialog({
  locale,
  open,
  onOpenChange,
  finalFocus,
}: {
  readonly locale: Locale;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly finalFocus: () => HTMLElement | null;
}) {
  "use memo";

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const t = useTranslations("tech.search");
  const [retryNonce, setRetryNonce] = useState(0);
  const searchClient = useMemo(
    () =>
      fetchClient({
        api: `/${locale}/search`,
        locale,
        cache: new Map(),
      }),
    [locale],
  );
  const searchDependencies = useMemo(
    () => [locale, retryNonce] as const,
    [locale, retryNonce],
  );
  const search = useDocsSearch(
    { client: searchClient, allowEmpty: true },
    searchDependencies,
  );
  const query = search.search;
  const setQuery = search.setSearch;
  const results = Array.isArray(search.query.data)
    ? search.query.data
    : emptyResults;

  // 응답이 그대로인 입력·debounce 구간에는 결과 배열을 재사용함.
  const resultLimit = query === "" ? 8 : 32;
  const items = useMemo(
    () =>
      toSearchItems(locale, results, {
        body: t("body"),
        heading: t("heading"),
        resultGroupBlog: t("resultGroupBlog"),
        title: t("title"),
      }).slice(0, resultLimit),
    [locale, resultLimit, results, t],
  );

  const changeOpen = (nextOpen: boolean): void => {
    if (!nextOpen) setQuery("");
    onOpenChange(nextOpen);
  };

  const select = (item: SearchItem): void => {
    router.push(item.href);
    changeOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {/* Preserve the existing compact desktop width and mobile full-width search. */}
      <DialogContent
        initialFocus={inputRef}
        finalFocus={finalFocus}
        className="max-w-xl overflow-hidden p-0 sm:max-w-sm"
        aria-describedby={undefined}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t("dialogTitle")}</DialogTitle>
        <Command key={`${locale}:${String(open)}`} shouldFilter={false}>
          <div className="flex min-h-[54px] items-center gap-2.5 border-b px-4">
            <CommandInput
              ref={inputRef}
              wrapperClassName="min-w-0 flex-1"
              className="min-w-0 flex-1 border-0 bg-transparent outline-none"
              value={query}
              onValueChange={setQuery}
              placeholder={t("placeholder")}
            />
            <kbd className="rounded-xs border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              Esc
            </kbd>
          </div>
          <CommandList
            className="grid max-h-[min(460px,60dvh)] gap-0.5 overflow-y-auto p-1.5"
            aria-label={t("results")}
          >
            {search.query.isLoading ? (
              <p
                className="m-0 px-4 py-[30px] text-center text-muted-foreground"
                role="status"
              >
                {t("searching")}
              </p>
            ) : null}
            {search.query.error !== undefined ? (
              <div
                className="m-0 px-4 py-[30px] text-center text-muted-foreground"
                role="alert"
              >
                <p>{t("failed")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRetryNonce((value) => value + 1)}
                >
                  {t("retry")}
                </Button>
              </div>
            ) : null}
            {!search.query.isLoading && search.query.error === undefined ? (
              <>
                <CommandEmpty>{t("noResults")}</CommandEmpty>
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      className="min-h-[58px] justify-between gap-4"
                      data-href={item.href}
                      key={item.href}
                      value={`${item.href} ${item.label} ${item.matchText}`}
                      onSelect={() => select(item)}
                    >
                      <span className="grid min-w-0 gap-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge className="shrink-0" variant="secondary">
                            {item.badge}
                          </Badge>
                          <strong className="overflow-hidden text-ellipsis whitespace-nowrap">
                            {item.label}
                          </strong>
                        </span>
                        <span className="flex gap-1.5 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted-foreground">
                          <span className="shrink-0 font-semibold text-primary">
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
