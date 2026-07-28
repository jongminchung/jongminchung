"use client";

import { Button } from "@base-ui/react/button";
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { DocSection, Locale, SearchDocument } from "@/lib/content-model";
import { isLocale, sections } from "@/lib/content-model";
import { searchDocuments, type SearchHit, type SearchMatchField } from "@/lib/search";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { TransitionLink, useDocsNavigation } from "./RouteTransition";
import styles from "./SearchPalette.module.css";

interface SearchItem {
  readonly href: string;
  readonly label: string;
  readonly matchLabel: string;
  readonly matchText: string;
  readonly group: string;
}

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
  )
    throw new Error("Search index contains an invalid item.");
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
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<readonly SearchDocument[]>([]);
  const [selected, setSelected] = useState(-1);
  const items = useMemo(
    () =>
      searchDocuments(documents, query, query === "" ? 8 : undefined).map((hit) =>
        toItem(locale, hit),
      ),
    [documents, locale, query],
  );
  const open = useCallback((trigger: HTMLButtonElement | null): void => {
    triggerRef.current = trigger ?? findVisibleTrigger();
    setIsOpen(true);
  }, []);

  useEffect(() => {
    void fetch(`/search/${locale}.json`).then(async (response) => {
      if (!response.ok) throw new Error(`Search index request failed with ${response.status}.`);
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Search index must be an array.");
      setDocuments(Object.freeze(value.map(parseSearchDocument)));
    });
  }, [locale]);

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
      setSelected(-1);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };
  const select = (item: SearchItem): void => {
    changeOpen(false);
    navigate(item.href);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((current) => Math.min(current + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && items.length > 0) {
      event.preventDefault();
      const item = items[selected < 0 ? 0 : selected];
      if (item !== undefined) select(item);
    }
  };

  return (
    <SearchContext value={{ locale, open }}>
      {children}
      <Dialog open={isOpen} onOpenChange={changeOpen}>
        <DialogContent className={styles.dialog} aria-describedby={undefined}>
          <DialogTitle className="sr-only">
            {locale === "ko" ? "문서 검색" : "Search documentation"}
          </DialogTitle>
          <label className={styles.inputRow}>
            <Icon icon="search" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                locale === "ko" ? "제목, API, 주제 검색" : "Search titles, APIs, and topics"
              }
            />
            <kbd>Esc</kbd>
          </label>
          <div
            className={styles.list}
            role="list"
            aria-label={locale === "ko" ? "검색 결과" : "Search results"}
          >
            {items.length === 0 ? (
              <p className={styles.empty}>
                {locale === "ko" ? "검색 결과가 없습니다" : "No matching documents"}
              </p>
            ) : (
              items.map((item, index) => (
                <TransitionLink
                  className={cn(
                    "flex min-h-[58px] w-full items-center justify-between gap-4 rounded-sm border-0 bg-transparent px-2.5 py-2 text-left font-[inherit] text-foreground outline-none transition-colors disabled:pointer-events-none disabled:opacity-50",
                    "hover:bg-muted data-active:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60",
                    "[&_small]:shrink-0 [&_small]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
                  )}
                  data-active={selected === index ? "" : undefined}
                  href={item.href}
                  key={item.href}
                  onMouseMove={() => setSelected(index)}
                  onNavigate={() => changeOpen(false)}
                >
                  <span className={styles.result}>
                    <strong>{item.label}</strong>
                    <span className={styles.matchReason}>
                      <span>{item.matchLabel}</span>
                      {item.matchText}
                    </span>
                  </span>
                  <small>{item.group}</small>
                </TransitionLink>
              ))
            )}
          </div>
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
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-transparent font-medium outline-none transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "[&_kbd]:rounded-xs [&_kbd]:border [&_kbd]:border-border [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:text-[10px] [&_kbd]:text-foreground",
        compact ? "min-h-11 min-w-11 px-[7px] text-sm" : "h-8 w-full justify-between px-3 text-xs",
      )}
      data-docs-search-trigger="true"
      data-slot="button"
      onClick={(event) => context.open(event.currentTarget)}
    >
      <span className="inline-flex items-center gap-[7px]">
        <Icon icon="search" />
        {compact ? null : <span>{context.locale === "ko" ? "검색" : "Search"}</span>}
      </span>
      {showShortcut && !compact ? <kbd>⌘K</kbd> : null}
    </Button>
  );
}
