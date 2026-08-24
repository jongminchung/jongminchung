import Link from "next/link";
import {
  createSeriesHref,
  type ContentManifestEntry,
  type Locale,
} from "#lib/content-model";
import { type SeriesId, seriesRegistry } from "#lib/tech/series";
import { DocumentCard } from "./DocumentCard";

const copy = {
  ko: { eyebrow: "시리즈", title: "시리즈", articles: "글" },
  en: { eyebrow: "Series", title: "Series", articles: "articles" },
} as const;

/** `SeriesIndex` 시리즈 목록을 렌더링함 */
export function SeriesIndex({
  locale,
  counts,
}: {
  readonly locale: Locale;
  readonly counts: Readonly<Record<SeriesId, number>>;
}) {
  const text = copy[locale];
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pt-[clamp(64px,9vw,112px)] pb-24 max-[680px]:px-4 max-[680px]:pt-12">
      <header className="mb-12">
        <p className="font-mono text-[11px] font-medium tracking-[.12em] text-primary uppercase">
          {text.eyebrow}
        </p>
        <h1 className="mt-4 mb-3 text-[clamp(42px,5vw,68px)] leading-[1] font-medium tracking-[-.05em]">
          {text.title}
        </h1>
      </header>
      <div className="grid gap-4">
        {(
          Object.entries(seriesRegistry) as [
            SeriesId,
            (typeof seriesRegistry)[SeriesId],
          ][]
        )
          .sort(([, left], [, right]) => left.order - right.order)
          .map(([id, series]) => (
            <Link
              className="rounded-[var(--radius)] border bg-card p-6 transition-colors hover:bg-muted"
              href={createSeriesHref(locale, id)}
              key={id}
            >
              <p className="m-0 font-mono text-[11px] text-primary uppercase">
                {counts[id]} {text.articles}
              </p>
              <h2 className="mt-3 mb-2 text-2xl font-medium tracking-[-.02em]">
                {series.title[locale]}
              </h2>
              <p className="m-0 text-muted-foreground">
                {series.description[locale]}
              </p>
            </Link>
          ))}
      </div>
    </div>
  );
}

/** `SeriesDetail` 시리즈의 순서 있는 글을 렌더링함 */
export function SeriesDetail({
  locale,
  id,
  documents,
}: {
  readonly locale: Locale;
  readonly id: SeriesId;
  readonly documents: readonly ContentManifestEntry[];
}) {
  const text = copy[locale];
  const series = seriesRegistry[id]!;
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pt-[clamp(64px,9vw,112px)] pb-24 max-[680px]:px-4 max-[680px]:pt-12">
      <header className="mb-12 max-w-[680px]">
        <p className="font-mono text-[11px] font-medium tracking-[.12em] text-primary uppercase">
          {text.eyebrow}
        </p>
        <h1 className="mt-4 mb-3 text-[clamp(42px,5vw,68px)] leading-[1] font-medium tracking-[-.05em]">
          {series.title[locale]}
        </h1>
        <p className="m-0 text-[16px] leading-[1.55] text-muted-foreground">
          {series.description[locale]}
        </p>
      </header>
      <div className="grid grid-cols-3 gap-x-5 gap-y-9 max-[840px]:grid-cols-2 max-[560px]:grid-cols-1">
        {documents.map((document, index) => (
          <DocumentCard
            document={document}
            eager={index < 3}
            key={document.id}
            label={`${document.seriesOrder}. ${series.title[locale]}`}
            locale={locale}
            variant="related"
          />
        ))}
      </div>
    </div>
  );
}
