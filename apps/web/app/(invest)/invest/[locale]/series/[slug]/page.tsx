import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { InvestmentCollection } from "#invest-components/InvestmentCollection";
import { investmentSeriesDescription } from "#lib/invest/copy";
import { getInvestmentNotes, getNotesBySeriesSlug } from "#lib/invest/notes";
import {
  createInvestmentSeriesHref,
  investmentSeriesSlug,
} from "#lib/invest/routing";
import { createInvestmentCollectionMetadata } from "#lib/invest/seo";
import { alternateLocale } from "#lib/locale";
import { isLocale, locales, type Locale } from "#lib/site-routing";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
  const investmentNotes = locales.flatMap(getInvestmentNotes);
  const params = [
    ...new Set(
      investmentNotes.flatMap((note) =>
        note.series === undefined
          ? []
          : [`${note.locale}:${investmentSeriesSlug(note.series)}`],
      ),
    ),
  ].map((key) => {
    const [locale, slug] = key.split(":");
    return { locale, slug };
  });
  return params.length > 0
    ? params
    : locales.map((locale) => ({ locale, slug: "__empty__" }));
}

function getSeriesCollection(locale: Locale, slug: string) {
  const normalizedSlug = investmentSeriesSlug(slug);
  if (normalizedSlug !== slug)
    permanentRedirect(`/${locale}/series/${normalizedSlug}`);
  const notes = getNotesBySeriesSlug(locale, slug);
  const series = notes[0]?.series;
  if (series === undefined) notFound();
  return {
    notes,
    title: series,
    description: investmentSeriesDescription(locale, series),
    pathname: createInvestmentSeriesHref(locale, series),
  };
}

/** series collection의 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/invest/[locale]/series/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const collection = getSeriesCollection(locale, slug);
  const otherLocale = alternateLocale(locale);
  const alternateNotes = getNotesBySeriesSlug(otherLocale, slug);
  return createInvestmentCollectionMetadata({
    locale,
    title: collection.title,
    description: collection.description,
    pathname: collection.pathname,
    alternatePathname:
      alternateNotes.length < 2
        ? undefined
        : createInvestmentSeriesHref(otherLocale, collection.title),
    index: collection.notes.length >= 2,
  });
}
/** `SeriesPage` 페이지 UI를 렌더링함 */
export default async function SeriesPage({
  params,
  searchParams,
}: PageProps<"/invest/[locale]/series/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <InvestmentCollection
      {...getSeriesCollection(locale, slug)}
      locale={locale}
      searchParams={await searchParams}
    />
  );
}
