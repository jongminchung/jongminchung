import { cn } from "@jongminchung/ui/lib/utils";
import type { TOCItemType } from "fumadocs-core/toc";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { EditorialArticle } from "#components/EditorialArticle";
import { EditorialCard } from "#components/EditorialCard";
import { StructuredData } from "#components/StructuredData";
import { rankRelatedEditorialItems } from "#lib/editorial";
import { toInvestmentEditorialItem } from "#lib/editorial-adapters";
import { documentOutlineLabelsFor } from "#lib/i18n-messages";
import type { InvestmentNoteManifestEntry } from "#lib/invest/content";
import { getInvestmentMessages } from "#lib/invest/copy";
import {
  createInvestmentSeriesHref,
  createInvestmentTagHref,
} from "#lib/invest/routing";
import { articleProseClassName } from "#lib/mdx-styles";
import type { Locale } from "#lib/site-routing";
import { createInvestmentArticleStructuredData } from "#lib/structured-data";
import { DocumentOutline } from "#tech-components/DocumentOutline";

/** 출처가 있으면 외부 링크, 없으면 동일한 정적 card로 렌더링함 */
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
  const className =
    "flex flex-col gap-[5px] border bg-card p-[18px] [&_small]:font-mono [&_small]:text-[10px] [&_small]:text-muted-foreground [&_span]:font-mono [&_span]:text-[10px] [&_span]:text-muted-foreground";
  return source.url === undefined ? (
    <div className={className}>{body}</div>
  ) : (
    <a className={className} href={source.url} rel="noreferrer" target="_blank">
      {body}
    </a>
  );
}

/** Invest note의 header·본문·출처·관련 글을 조합함 */
export function InvestmentNotePage({
  locale,
  note,
  children,
  related,
  toc,
}: {
  readonly locale: Locale;
  readonly note: InvestmentNoteManifestEntry;
  readonly children: ReactNode;
  readonly related: readonly InvestmentNoteManifestEntry[];
  readonly toc: readonly TOCItemType[];
}): React.JSX.Element {
  const text = getInvestmentMessages(locale).article;
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
              aria-labelledby="investment-sources"
              className="mt-16 border-t pt-7"
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
                aria-labelledby="related-notes"
                className="mt-16 border-t pt-7"
              >
                <h2
                  className="mt-0 mb-5 text-[22px] font-medium"
                  id="related-notes"
                >
                  {text.related}
                </h2>
                <div className="grid grid-cols-3 gap-4 max-[760px]:grid-cols-1">
                  {relatedItems.map((item) => (
                    <EditorialCard item={item} key={item.id} />
                  ))}
                </div>
              </section>
            )}
            <p className="mt-10 border-t pt-6 text-xs text-muted-foreground">
              {text.disclaimer}
            </p>
          </>
        }
        header={
          <>
            {note.series === undefined ? (
              <p className="m-0 font-mono text-[11px] text-primary uppercase">
                {text.researchNote}
              </p>
            ) : (
              <Link
                className="font-mono text-[11px] text-primary uppercase underline-offset-4 hover:underline"
                href={createInvestmentSeriesHref(locale, note.series)}
              >
                {note.series}
              </Link>
            )}
            <h1 className="my-4 text-[clamp(38px,5vw,56px)] leading-[1.05] font-semibold tracking-[-.04em]">
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
            <nav aria-label={text.topics} className="mt-4 flex flex-wrap gap-2">
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
        rail={
          <DocumentOutline
            items={toc}
            labels={documentOutlineLabelsFor(locale)}
          />
        }
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
            {text.generatedImage}
          </figcaption>
        </figure>
        <div
          className={cn(
            articleProseClassName(locale),
            locale === "ko" && "break-keep",
          )}
          data-docs-prose="true"
          lang={locale}
        >
          {children}
        </div>
      </EditorialArticle>
    </>
  );
}
