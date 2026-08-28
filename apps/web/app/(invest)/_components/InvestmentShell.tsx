import type { TOCItemType } from "fumadocs-core/toc";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandWordmark } from "#components/BrandWordmark";
import {
  EditorialArticle,
  EditorialCard,
  EditorialFooter,
  EditorialHeader,
  EditorialIndex,
  type EditorialCopy,
} from "#components/Editorial";
import { StructuredData } from "#components/StructuredData";
import { ThemeControl } from "#components/ThemeControl";
import {
  parseEditorialQuery,
  rankRelatedEditorialItems,
  type EditorialSearchParams,
} from "#lib/editorial";
import { toInvestmentEditorialItem } from "#lib/editorial-adapters";
import type { InvestmentNoteManifestEntry } from "#lib/invest/content";
import {
  createInvestmentSeriesHref,
  createInvestmentTagHref,
} from "#lib/invest/routing";
import type { Locale } from "#lib/site-routing";
import {
  createInvestmentArticleStructuredData,
  createInvestmentCollectionStructuredData,
} from "#lib/structured-data";
import { DocumentOutline } from "#tech-components/DocumentOutline";

const copy = {
  ko: {
    label: "INVESTMENT NOTES",
    nav: ["노트", "책"],
    intro: "공시와 원문에서 투자 아이디어를 읽고 기록합니다",
    description:
      "13F 공시, 책과 인터뷰를 바탕으로 투자자의 선택과 시장의 구조를 분석합니다",
    empty: "첫 리서치 노트를 준비하고 있습니다",
    emptyBody: "투자 아이디어와 분석을 한국어와 영어로 함께 제공합니다",
    sources: "참고 자료",
    updated: "업데이트",
  },
  en: {
    label: "INVESTMENT NOTES",
    nav: ["Notes", "Books"],
    intro: "Read filings and original sources to develop investment ideas",
    description:
      "Essays on investor decisions and market structure grounded in 13F filings, books, and interviews",
    empty: "The first research note is in preparation",
    emptyBody:
      "Investment ideas and analysis are published in both Korean and English",
    sources: "Sources",
    updated: "Updated",
  },
} as const;

const indexCopy: Record<Locale, EditorialCopy> = {
  ko: {
    eyebrow: "INVESTMENT NOTES",
    title: "공시와 원문에서 출발한 투자 리서치",
    description: copy.ko.description,
    all: "모든 노트",
    newest: "최신순",
    oldest: "오래된순",
    grid: "그리드",
    list: "목록",
    loadMore: "더 보기",
    empty: "선택한 조건과 일치하는 노트가 없습니다",
    related: "관련 노트",
  },
  en: {
    eyebrow: "INVESTMENT NOTES",
    title: "Investment research grounded in filings and primary sources",
    description: copy.en.description,
    all: "All notes",
    newest: "Newest",
    oldest: "Oldest",
    grid: "Grid",
    list: "List",
    loadMore: "Load more",
    empty: "No notes match the selected filters.",
    related: "Related notes",
  },
};

/** `InvestmentLayout` 페이지 UI를 렌더링함 */
export function InvestmentLayout({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}): React.JSX.Element {
  const text = copy[locale];
  const otherLocale = locale === "ko" ? "en" : "ko";
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <EditorialHeader
        actions={<ThemeControl locale={locale} />}
        brand={<BrandWordmark suffix="invest" />}
        brandLabel="jongminchung invest"
        homeHref={`/${locale}`}
        localeHref={`/${otherLocale}`}
        localeLabel={otherLocale.toUpperCase()}
        navigation={[
          { href: `/${locale}/notes`, label: text.nav[0] },
          { href: `/${locale}/sources/book`, label: text.nav[1] },
        ]}
      />
      {children}
      <EditorialFooter
        groups={[
          {
            label: locale === "ko" ? "탐색" : "Explore",
            links: [
              { href: `/${locale}`, label: "Home" },
              { href: `/${locale}/notes`, label: text.nav[0] },
            ],
          },
          {
            label: locale === "ko" ? "출처" : "Sources",
            links: [
              { href: `/${locale}/sources/book`, label: text.nav[1] },
              { href: `/${locale}/rss.xml`, label: "RSS" },
            ],
          },
          {
            label: "Elsewhere",
            links: [{ href: "https://www.jamie.kr", label: "jamie.kr ↗" }],
          },
        ]}
        note="Independent investment research · Not investment advice"
      />
    </div>
  );
}

/** `InvestmentHome` UI 컴포넌트를 렌더링함 */
export function InvestmentHome({
  locale,
  notes,
  searchParams = {},
}: {
  readonly locale: Locale;
  readonly notes: readonly InvestmentNoteManifestEntry[];
  readonly searchParams?: EditorialSearchParams;
}): React.JSX.Element {
  const description = indexCopy[locale].description;
  return (
    <>
      <StructuredData
        value={createInvestmentCollectionStructuredData({
          locale,
          pathname: `/${locale}`,
          title: indexCopy[locale].title,
          description,
          notes,
        })}
      />
      <EditorialIndex
        copy={indexCopy[locale]}
        items={notes.map(toInvestmentEditorialItem)}
        pathname={`/${locale}`}
        query={parseEditorialQuery(
          searchParams,
          notes.flatMap((note) => toInvestmentEditorialItem(note).tags),
        )}
      />
    </>
  );
}

/** `NoteCollection` UI 컴포넌트를 렌더링함 */
export function NoteCollection({
  locale,
  notes,
  title,
  description,
  pathname = `/${locale}/notes`,
  searchParams = {},
}: {
  readonly locale: Locale;
  readonly notes: readonly InvestmentNoteManifestEntry[];
  readonly title?: string;
  readonly description?: string;
  readonly pathname?: string;
  readonly searchParams?: EditorialSearchParams;
}): React.JSX.Element {
  const collectionTitle = title ?? indexCopy[locale].title;
  const collectionDescription = description ?? indexCopy[locale].description;
  return (
    <>
      <StructuredData
        value={createInvestmentCollectionStructuredData({
          locale,
          pathname,
          title: collectionTitle,
          description: collectionDescription,
          notes,
        })}
      />
      <EditorialIndex
        copy={{
          ...indexCopy[locale],
          title: collectionTitle,
          description: collectionDescription,
        }}
        items={notes.map(toInvestmentEditorialItem)}
        pathname={pathname}
        query={parseEditorialQuery(
          searchParams,
          notes.flatMap((note) => toInvestmentEditorialItem(note).tags),
        )}
      />
    </>
  );
}

/** `InvestmentNotePage` 페이지 UI를 렌더링함 */
export function InvestmentNotePage({
  locale,
  note,
  children,
  related = [],
  toc,
}: {
  readonly locale: Locale;
  readonly note: InvestmentNoteManifestEntry;
  readonly children: ReactNode;
  readonly related?: readonly InvestmentNoteManifestEntry[];
  readonly toc: readonly TOCItemType[];
}): React.JSX.Element {
  const text = copy[locale];
  const relatedItems = rankRelatedEditorialItems(
    toInvestmentEditorialItem(note),
    related.map(toInvestmentEditorialItem),
  );
  return (
    <>
      <StructuredData value={createInvestmentArticleStructuredData(note)} />
      <EditorialArticle
        footer={
          <>
            <section
              className="mt-16 border-t pt-7"
              aria-labelledby="investment-sources"
            >
              <h2
                className="mt-0 mb-5 text-[22px] font-medium"
                id="investment-sources"
              >
                {text.sources}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {note.sources.map((source) => (
                  <SourceCard
                    key={`${source.kind}:${source.title}`}
                    source={source}
                  />
                ))}
              </div>
            </section>
            {relatedItems.length === 0 ? null : (
              <section
                className="mt-16 border-t pt-7"
                aria-labelledby="related-notes"
              >
                <h2
                  className="mt-0 mb-5 text-[22px] font-medium"
                  id="related-notes"
                >
                  {locale === "ko" ? "관련 노트" : "Related notes"}
                </h2>
                <div className="grid grid-cols-3 gap-4 max-[760px]:grid-cols-1">
                  {relatedItems.map((item) => (
                    <EditorialCard item={item} key={item.id} />
                  ))}
                </div>
              </section>
            )}
            <p className="mt-10 border-t pt-6 text-xs text-muted-foreground">
              {locale === "ko"
                ? "이 글은 출처를 이해하기 위한 개인 기록이며 투자 권유가 아닙니다"
                : "This is a personal research note, not investment advice"}
            </p>
          </>
        }
        header={
          <>
            {note.series === undefined ? (
              <p className="m-0 font-mono text-[11px] text-primary uppercase">
                Research note
              </p>
            ) : (
              <Link
                className="font-mono text-[11px] text-primary uppercase underline-offset-4 hover:underline"
                href={createInvestmentSeriesHref(locale, note.series)}
              >
                {note.series}
              </Link>
            )}
            <h1 className="my-4 text-[clamp(44px,6vw,72px)] leading-none font-medium tracking-[-.05em]">
              {note.title}
            </h1>
            <p className="m-0 max-w-[680px] text-[18px] leading-[1.6] text-muted-foreground">
              {note.description}
            </p>
            <time
              className="mt-5 block font-mono text-[11px] text-muted-foreground"
              dateTime={note.updatedAt}
            >
              {text.updated} · {note.updatedAt}
            </time>
            <nav
              aria-label={locale === "ko" ? "노트 주제" : "Note topics"}
              className="mt-4 flex flex-wrap gap-2"
            >
              {note.tags.map((tag) => (
                <Link
                  className="rounded-full border px-2.5 py-1 font-mono text-[10px] text-muted-foreground hover:border-input hover:text-foreground"
                  href={createInvestmentTagHref(locale, tag)}
                  key={tag}
                >
                  #{tag}
                </Link>
              ))}
            </nav>
          </>
        }
        rail={<DocumentOutline items={toc} />}
        variant="engineering"
      >
        <figure className="mt-0 mb-10">
          <Image
            alt={note.imageAlt}
            className="aspect-[1.6] w-full rounded-[var(--radius)] border object-cover"
            data-investment-hero="true"
            height={1000}
            preload
            sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 960px) calc(100vw - 64px), 760px"
            src={note.image}
            width={1600}
          />
          <figcaption className="mt-2 text-center text-xs leading-5 text-muted-foreground">
            {locale === "ko"
              ? "글의 주제를 바탕으로 OpenAI로 생성한 이미지"
              : "Image generated with OpenAI from the article topic"}
          </figcaption>
        </figure>
        {children}
      </EditorialArticle>
    </>
  );
}

function SourceCard({
  source,
}: {
  readonly source: InvestmentNoteManifestEntry["sources"][number];
}): React.JSX.Element {
  const body = (
    <>
      <span>{source.kind}</span>
      <strong>{source.title}</strong>
      <small>{source.creator}</small>
    </>
  );
  return source.url === undefined ? (
    <div className="flex flex-col gap-[5px] border bg-card p-[18px] [&_small]:font-mono [&_small]:text-[10px] [&_small]:text-muted-foreground [&_span]:font-mono [&_span]:text-[10px] [&_span]:text-muted-foreground">
      {body}
    </div>
  ) : (
    <a
      className="flex flex-col gap-[5px] border bg-card p-[18px] [&_small]:font-mono [&_small]:text-[10px] [&_small]:text-muted-foreground [&_span]:font-mono [&_span]:text-[10px] [&_span]:text-muted-foreground"
      href={source.url}
      rel="noreferrer"
      target="_blank"
    >
      {body}
    </a>
  );
}
