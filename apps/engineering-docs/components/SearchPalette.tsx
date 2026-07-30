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
import { Dialog, DialogContent, DialogTitle } from "@jongminchung/ui/components/dialog";
import { cn } from "@jongminchung/ui/lib/utils";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DocSection, Locale, SearchDocument } from "@/lib/content-model";
import { isLocale, sections } from "@/lib/content-model";
import { searchDocuments, type SearchHit, type SearchMatchField } from "@/lib/search";
import { Icon } from "./Icon";
import { useDocsNavigation } from "./RouteTransition";
import styles from "./SearchPalette.module.css";

interface SearchItem {
  readonly href: string;
  readonly label: string;
  readonly matchLabel: string;
  readonly matchText: string;
  readonly group: string;
}

type SearchIndexState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly documents: readonly SearchDocument[] }
  | { readonly kind: "error"; readonly message: string };

const searchIndexCache = new Map<Locale, readonly SearchDocument[]>();

const sectionLabels: Readonly<Record<Locale, Readonly<Record<DocSection, string>>>> = {
  ko: { overview: "개요", handbook: "핸드북", packages: "패키지", "deep-dive": "Deep Dive" },
  en: {
    overview: "Overview",
    handbook: "Handbook",
    packages: "Packages",
    "deep-dive": "Deep Dive",
  },
};

const matchLabels: Readonly<Record<Locale, Readonly<Record<SearchMatchField, string>>>> = {
  ko: {
    title: "제목",
    apiSymbol: "API 심볼",
    heading: "문서 제목",
    tag: "태그",
    description: "요약",
    body: "본문",
  },
  en: {
    title: "Title",
    apiSymbol: "API symbol",
    heading: "Heading",
    tag: "Tag",
    description: "Summary",
    body: "Body",
  },
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSection(value: string): value is DocSection {
  return sections.some((section) => section === value);
}

function parseSearchDocument(value: unknown): SearchDocument {
  if (!isRecord(value)) throw new Error("Search index item must be an object.");
  const { id, locale, section, title, description, order, href, headings, tags, apiSymbols, body } =
    value;
  if (
    typeof id !== "string" ||
    typeof locale !== "string" ||
    !isLocale(locale) ||
    typeof section !== "string" ||
    !isSection(section) ||
    typeof title !== "string" ||
    typeof description !== "string" ||
    typeof order !== "number" ||
    typeof href !== "string" ||
    !Array.isArray(headings) ||
    !headings.every((item) => typeof item === "string") ||
    !Array.isArray(tags) ||
    !tags.every((item) => typeof item === "string") ||
    !Array.isArray(apiSymbols) ||
    !apiSymbols.every((item) => typeof item === "string") ||
    typeof body !== "string"
  ) {
    throw new Error("Search index contains an invalid item.");
  }
  return Object.freeze({
    id,
    locale,
    section,
    title,
    description,
    order,
    href,
    headings,
    tags,
    apiSymbols,
    body,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Search index request failed.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function toItem(locale: Locale, hit: SearchHit): SearchItem {
  return {
    href: hit.document.href,
    label: hit.document.title,
    group: sectionLabels[locale][hit.document.section],
    matchLabel: matchLabels[locale][hit.match.field],
    matchText: hit.match.text,
  };
}

interface SearchContextValue {
  readonly locale: Locale;
  readonly open: (trigger: HTMLButtonElement | null) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

function findVisibleTrigger(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("[data-docs-search-trigger]")).find(
      (trigger) => trigger.getClientRects().length > 0,
    ) ?? null
  );
}

export function SearchProvider({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}) {
  const { navigate } = useDocsNavigation();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [indexState, setIndexState] = useState<SearchIndexState>(() => {
    const documents = searchIndexCache.get(locale);
    return documents === undefined ? { kind: "idle" } : { kind: "ready", documents };
  });

  const loadIndex = useCallback(async (): Promise<void> => {
    const cached = searchIndexCache.get(locale);
    if (cached !== undefined) {
      setIndexState({ kind: "ready", documents: cached });
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIndexState({ kind: "loading" });

    try {
      const response = await fetch(`/search/${locale}.json`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Search index request failed with ${response.status}.`);
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Search index must be an array.");
      const documents = Object.freeze(value.map(parseSearchDocument));
      if (controller.signal.aborted) return;
      searchIndexCache.set(locale, documents);
      setIndexState({ kind: "ready", documents });
    } catch (error: unknown) {
      if (!controller.signal.aborted && !isAbortError(error)) {
        setIndexState({ kind: "error", message: errorMessage(error) });
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [locale]);

  const items = useMemo(() => {
    if (indexState.kind !== "ready") return [];
    return searchDocuments(indexState.documents, query, query === "" ? 8 : undefined).map((hit) =>
      toItem(locale, hit),
    );
  }, [indexState, locale, query]);

  const open = useCallback((trigger: HTMLButtonElement | null): void => {
    triggerRef.current = trigger ?? findVisibleTrigger();
    setIsOpen(true);
  }, []);

  useEffect(() => {
    requestRef.current?.abort();
    const documents = searchIndexCache.get(locale);
    setIndexState(documents === undefined ? { kind: "idle" } : { kind: "ready", documents });
    setQuery("");
  }, [locale]);

  useEffect(() => {
    if (isOpen && indexState.kind === "idle") void loadIndex();
  }, [indexState.kind, isOpen, loadIndex]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open(null);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [open]);

  const changeOpen = (nextOpen: boolean): void => {
    setIsOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const select = (item: SearchItem): void => {
    changeOpen(false);
    navigate(item.href);
  };

  return (
    <SearchContext value={{ locale, open }}>
      {children}
      <Dialog open={isOpen} onOpenChange={changeOpen}>
        <DialogContent
          className={cn(styles.dialog, "max-w-xl p-0")}
          aria-describedby={undefined}
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">
            {locale === "ko" ? "문서 검색" : "Search documentation"}
          </DialogTitle>
          <Command key={locale} shouldFilter={false} className="rounded-lg">
            <div className={styles.inputRow}>
              <CommandInput
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={
                  locale === "ko" ? "제목, API, 주제 검색" : "Search titles, APIs, and topics"
                }
              />
              <kbd>Esc</kbd>
            </div>
            <CommandList
              className={styles.list}
              aria-label={locale === "ko" ? "검색 결과" : "Search results"}
            >
              {indexState.kind === "loading" ? (
                <p className={styles.empty} role="status">
                  {locale === "ko" ? "검색 색인을 불러오는 중" : "Loading search index"}
                </p>
              ) : null}
              {indexState.kind === "error" ? (
                <div className={styles.empty} role="alert">
                  <p>
                    {locale === "ko" ? "검색 색인을 불러오지 못했습니다" : "Search index failed"}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void loadIndex()}>
                    {locale === "ko" ? "다시 시도" : "Retry"}
                  </Button>
                </div>
              ) : null}
              {indexState.kind === "ready" ? (
                <>
                  <CommandEmpty>
                    {locale === "ko" ? "검색 결과가 없습니다" : "No matching documents"}
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
                          <span className={styles.matchReason}>
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
    </SearchContext>
  );
}

export function SearchTrigger({
  compact = false,
  showShortcut = true,
}: {
  readonly compact?: boolean;
  readonly showShortcut?: boolean;
}) {
  const context = use(SearchContext);
  if (context === null) throw new Error("SearchTrigger must be rendered inside SearchProvider.");
  const label = context.locale === "ko" ? "문서 검색" : "Search documentation";
  return (
    <Button
      aria-label={label}
      className={cn(
        "[&_kbd]:rounded-xs [&_kbd]:border [&_kbd]:border-border [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:text-[10px] [&_kbd]:text-foreground",
        compact ? "min-h-11 min-w-11 px-[7px]" : "h-8 w-full justify-between px-3 text-xs",
      )}
      data-docs-search-trigger="true"
      onClick={(event) => context.open(event.currentTarget)}
      size={compact ? "icon" : "default"}
      variant="ghost"
    >
      <span className="inline-flex items-center gap-[7px]">
        <Icon icon="search" />
        {compact ? null : <span>{context.locale === "ko" ? "검색" : "Search"}</span>}
      </span>
      {showShortcut && !compact ? <kbd>⌘K</kbd> : null}
    </Button>
  );
}
