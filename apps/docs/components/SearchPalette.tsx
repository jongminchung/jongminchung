"use client";

import { Button } from "@astryxdesign/core/Button";
import { CommandPalette, CommandPaletteInput } from "@astryxdesign/core/CommandPalette";
import { Icon } from "@astryxdesign/core/Icon";
import { Kbd } from "@astryxdesign/core/Kbd";
import type { SearchSource, SearchableItem } from "@astryxdesign/core/Typeahead";
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
import { useDocsNavigation } from "./RouteTransition";
import styles from "./SearchPalette.module.css";

interface SearchItemData {
  readonly group: string;
  readonly href: string;
  readonly matchLabel: string;
  readonly matchText: string;
  readonly section: DocSection;
}

type SearchItem = SearchableItem<SearchItemData>;

const sectionLabels: Readonly<Record<Locale, Readonly<Record<DocSection, string>>>> = {
  ko: {
    overview: "개요",
    handbook: "핸드북",
    packages: "패키지",
    "deep-dive": "Deep Dive",
  },
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

function parseSearchIndex(value: unknown): readonly SearchDocument[] {
  if (!Array.isArray(value)) throw new Error("Search index must be an array.");
  return Object.freeze(value.map(parseSearchDocument));
}

class DocsSearchSource implements SearchSource<SearchItem> {
  private indexPromise: Promise<readonly SearchDocument[]> | null = null;

  private constructor(private readonly locale: Locale) {}

  static of(locale: Locale): DocsSearchSource {
    return new DocsSearchSource(locale);
  }

  async search(query: string): Promise<SearchItem[]> {
    const documents = await this.load();
    return searchDocuments(documents, query).map((hit) => this.toItem(hit));
  }

  async bootstrap(): Promise<SearchItem[]> {
    const documents = await this.load();
    return searchDocuments(documents, "", 8).map((hit) => this.toItem(hit));
  }

  private async load(): Promise<readonly SearchDocument[]> {
    this.indexPromise ??= this.fetchIndex();
    return this.indexPromise;
  }

  private async fetchIndex(): Promise<readonly SearchDocument[]> {
    const response = await fetch(`/search/${this.locale}.json`);
    if (!response.ok) throw new Error(`Search index request failed with ${response.status}.`);
    const value: unknown = await response.json();
    return parseSearchIndex(value);
  }

  private toItem(hit: SearchHit): SearchItem {
    const { document, match } = hit;
    return Object.freeze({
      id: document.href,
      label: document.title,
      auxiliaryData: {
        group: sectionLabels[this.locale][document.section],
        href: document.href,
        matchLabel: matchLabels[this.locale][match.field],
        matchText: match.text,
        section: document.section,
      },
    });
  }
}

interface SearchContextValue {
  readonly locale: Locale;
  readonly open: (trigger: HTMLButtonElement | null) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

function findVisibleTrigger(): HTMLButtonElement | null {
  const triggers = document.querySelectorAll<HTMLButtonElement>("[data-docs-search-trigger]");
  return Array.from(triggers).find((trigger) => trigger.getClientRects().length > 0) ?? null;
}

export function SearchProvider({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}) {
  const { navigate } = useDocsNavigation();
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const source = useMemo(() => DocsSearchSource.of(locale), [locale]);
  const open = useCallback((trigger: HTMLButtonElement | null): void => {
    lastTriggerRef.current = trigger ?? findVisibleTrigger();
    setIsOpen(true);
  }, []);
  const contextValue = useMemo(() => ({ locale, open }), [locale, open]);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        open(null);
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, [open]);

  const setOpen = (nextOpen: boolean): void => {
    setIsOpen(nextOpen);
    if (!nextOpen) requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const selectItem = (href: string): void => {
    setOpen(false);
    navigate(href);
  };

  return (
    <SearchContext value={contextValue}>
      {children}
      <CommandPalette<SearchItem>
        isOpen={isOpen}
        onOpenChange={setOpen}
        onValueChange={selectItem}
        searchSource={source}
        label={locale === "ko" ? "문서 검색" : "Search documentation"}
        emptySearchText={locale === "ko" ? "검색 결과가 없습니다" : "No matching documents"}
        emptyBootstrapText={locale === "ko" ? "검색어를 입력하세요" : "Type to search"}
        input={
          <CommandPaletteInput
            placeholder={
              locale === "ko" ? "제목, API, 주제 검색" : "Search titles, APIs, and topics"
            }
          />
        }
        renderItem={(item) => (
          <span className={styles.result}>
            <strong>{item.label}</strong>
            <span className={styles.matchReason}>
              <span>{item.auxiliaryData?.matchLabel}</span>
              {item.auxiliaryData?.matchText}
            </span>
          </span>
        )}
      />
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
      data-docs-search-trigger="true"
      label={label}
      variant="ghost"
      size="sm"
      className={compact ? styles.compactTrigger : styles.trigger}
      onClick={(event) => context.open(event.currentTarget)}
      endContent={!compact && showShortcut ? <Kbd keys="mod+k" /> : undefined}
    >
      <span className={styles.triggerLabel}>
        <Icon icon="search" size="sm" />
        {compact ? null : <span>{context.locale === "ko" ? "검색" : "Search"}</span>}
        {compact && showShortcut ? <Kbd keys="mod+k" /> : null}
      </span>
    </Button>
  );
}
