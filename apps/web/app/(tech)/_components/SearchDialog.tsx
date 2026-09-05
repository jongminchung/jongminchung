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
import type { Locale } from "#lib/content-model";
import { documentKindLabel } from "#lib/tech/document-kind";

interface SearchItem {
  readonly href: string;
  readonly label: string;
  readonly matchLabel: string;
  readonly matchText: string;
  readonly group: string;
  readonly badge: string;
}

interface SearchCopy {
  readonly body: string;
  readonly heading: string;
  readonly resultGroupBlog: string;
  readonly title: string;
}

const emptyResults: readonly SortedResult[] = [];

function plainText(value: string): string {
  return value.replace(/<\/?mark>/gu, "");
}

function toItems(
  locale: Locale,
  results: readonly SortedResult[],
  copy: SearchCopy,
): SearchItem[] {
  const groups: SortedResult[][] = [];
  for (const result of results) {
    if (result.type === "page") groups.push([result]);
    else groups.at(-1)?.push(result);
  }
  return groups.map((resultsForPage) => {
    const page = resultsForPage[0];
    if (page === undefined) throw new Error("Search result group is empty");
    const match =
      resultsForPage.find(({ type }) => type === "heading") ??
      resultsForPage.find(({ type }) => type === "text") ??
      page;
    const pageTitle = plainText(page.content);
    const [type = "Blog", ...breadcrumbs] = page.breadcrumbs ?? [];
    const badge =
      type === "Blog"
        ? "Blog"
        : type === "Docs"
          ? "Docs"
          : documentKindLabel(
              locale,
              type as "tutorial" | "how-to" | "reference" | "explanation",
            );
    const group =
      breadcrumbs.length === 0 ? copy.resultGroupBlog : breadcrumbs.join(" · ");
    const matchLabel =
      match.type === "page"
        ? copy.title
        : match.type === "heading"
          ? copy.heading
          : copy.body;
    return {
      href: match.url,
      label: pageTitle,
      group,
      badge,
      matchLabel,
      matchText: plainText(match.content),
    };
  });
}

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

  const items = useMemo(
    () =>
      toItems(locale, results, {
        body: t("body"),
        heading: t("heading"),
        resultGroupBlog: t("resultGroupBlog"),
        title: t("title"),
      }).slice(0, query === "" ? 8 : 32),
    [locale, query, results, t],
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
      <DialogContent
        initialFocus={inputRef}
        finalFocus={finalFocus}
        className="max-w-xl overflow-hidden p-0"
        aria-describedby={undefined}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t("dialogTitle")}</DialogTitle>
        <Command
          key={`${locale}:${String(open)}`}
          className="rounded-lg"
          shouldFilter={false}
        >
          <div className="flex min-h-[54px] items-center gap-2.5 border-b px-4 [&_[data-slot=command-input-wrapper]]:min-w-0 [&_[data-slot=command-input-wrapper]]:flex-1 [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-0 [&_input]:bg-transparent [&_input]:outline-none [&_kbd]:rounded-[var(--radius-xs)] [&_kbd]:border [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:text-[10px] [&_kbd]:text-muted-foreground">
            <CommandInput
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder={t("placeholder")}
            />
            <kbd>Esc</kbd>
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
                      <span className="grid min-w-0 gap-1 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap">
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge className="shrink-0" variant="secondary">
                            {item.badge}
                          </Badge>
                          <strong>{item.label}</strong>
                        </span>
                        <span className="flex gap-1.5 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted-foreground [&>span]:shrink-0 [&>span]:font-semibold [&>span]:text-primary">
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
