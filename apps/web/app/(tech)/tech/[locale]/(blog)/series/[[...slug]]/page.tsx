import { notFound, permanentRedirect } from "next/navigation";
import {
  createSeriesHref,
  isLocale,
  locales,
  type Locale,
} from "#lib/content-model";
import { getLocalizedDocuments } from "#lib/documents";
import { techPageMetadata } from "#lib/tech/metadata";
import {
  docsOverviewForSeries,
  isLegacyDocsSeriesId,
  legacyDocsSeriesIds,
} from "#lib/tech/routing";
import { isSeriesId, seriesRegistry, type SeriesId } from "#lib/tech/series";
import { DocsShell } from "#tech-components/DocsShell";
import { SeriesDetail, SeriesIndex } from "#tech-components/SeriesPages";

export function generateStaticParams() {
  return locales.flatMap((locale) => [
    { locale, slug: [] },
    ...Object.keys(seriesRegistry).map((series) => ({
      locale,
      slug: [series],
    })),
    ...legacyDocsSeriesIds.map((series) => ({ locale, slug: [series] })),
  ]);
}

/** Blog Series 목록과 상세의 canonical 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{
    readonly locale: string;
    readonly slug?: string[];
  }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const id = slug?.[0];
  if (slug === undefined || slug.length === 0)
    return techPageMetadata({
      title: locale === "ko" ? "블로그 시리즈" : "Blog Series",
      description:
        locale === "ko"
          ? "순서에 따라 읽는 기술 블로그 글 모음"
          : "Ordered collections of engineering blog articles.",
      locale,
      canonical: createSeriesHref(locale),
      alternatePaths: {
        ko: createSeriesHref("ko"),
        en: createSeriesHref("en"),
      },
      imageId: "series",
    });
  if (slug.length !== 1 || id === undefined || !isSeriesId(id)) return {};
  const series = seriesRegistry[id]!;
  return techPageMetadata({
    title: series.title[locale],
    description: series.description[locale],
    locale,
    canonical: createSeriesHref(locale, id),
    alternatePaths: {
      ko: createSeriesHref("ko", id),
      en: createSeriesHref("en", id),
    },
    imageId: `series/${id}`,
  });
}

function seriesCounts(
  documents: Awaited<ReturnType<typeof getLocalizedDocuments>>,
): Readonly<Record<SeriesId, number>> {
  return Object.fromEntries(
    (Object.keys(seriesRegistry) as SeriesId[]).map((id) => [
      id,
      documents.filter((document) => document.series === id).length,
    ]),
  ) as Record<SeriesId, number>;
}

/** Blog 데이터만 사용하는 Series 목록과 상세를 렌더링함 */
export default async function BlogSeriesPage({
  params,
}: {
  readonly params: Promise<{
    readonly locale: string;
    readonly slug?: string[];
  }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const alternate: Locale = locale === "ko" ? "en" : "ko";
  if (slug === undefined || slug.length === 0) {
    const documents = await getLocalizedDocuments(locale);
    return (
      <DocsShell
        active="series"
        alternateHref={createSeriesHref(alternate)}
        locale={locale}
      >
        <SeriesIndex counts={seriesCounts(documents)} locale={locale} />
      </DocsShell>
    );
  }
  const id = slug[0];
  if (slug.length !== 1 || id === undefined) notFound();
  if (isLegacyDocsSeriesId(id))
    permanentRedirect(docsOverviewForSeries(locale, id));
  if (!isSeriesId(id)) notFound();
  const documents = (await getLocalizedDocuments(locale))
    .filter((document) => document.series === id)
    .toSorted(
      (left, right) =>
        (left.seriesOrder ?? 0) - (right.seriesOrder ?? 0) ||
        left.id.localeCompare(right.id),
    );
  return (
    <DocsShell
      active="series"
      alternateHref={createSeriesHref(alternate, id)}
      locale={locale}
    >
      <SeriesDetail documents={documents} id={id} locale={locale} />
    </DocsShell>
  );
}
