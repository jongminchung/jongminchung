import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { NoteCollection } from "#invest-components/InvestmentShell";
import { getInvestmentNotes, getNotesBySeriesSlug } from "#lib/invest/notes";
import {
  createInvestmentSeriesHref,
  investmentSeriesSlug,
} from "#lib/invest/routing";
import { createInvestmentCollectionMetadata } from "#lib/invest/seo";
import { isLocale, locales } from "#lib/site-routing";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export async function generateStaticParams() {
  const investmentNotes = (
    await Promise.all(locales.map(getInvestmentNotes))
  ).flat();
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

function description(locale: "ko" | "en", series: string): string {
  return locale === "ko"
    ? `${series} 시리즈의 원자료 요약과 Jamie의 판단을 순서대로 연결한 투자 리서치 노트 모음`
    : `An ordered ${series} collection of source-grounded investment research notes and Jamie's judgment.`;
}

/** series collection의 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/invest/[locale]/series/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const normalizedSlug = investmentSeriesSlug(slug);
  if (normalizedSlug !== slug)
    permanentRedirect(`/${locale}/series/${normalizedSlug}`);
  const notes = await getNotesBySeriesSlug(locale, slug);
  const series = notes[0]?.series;
  if (series === undefined) notFound();
  const otherLocale = locale === "ko" ? "en" : "ko";
  const alternateNotes = await getNotesBySeriesSlug(otherLocale, slug);
  return createInvestmentCollectionMetadata({
    locale,
    title: series,
    description: description(locale, series),
    pathname: createInvestmentSeriesHref(locale, series),
    alternatePathname:
      alternateNotes.length < 2
        ? undefined
        : createInvestmentSeriesHref(otherLocale, series),
    index: notes.length >= 2,
  });
}
/** `SeriesPage` 페이지 UI를 렌더링함 */
export default async function SeriesPage({
  params,
}: PageProps<"/invest/[locale]/series/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const normalizedSlug = investmentSeriesSlug(slug);
  if (normalizedSlug !== slug)
    permanentRedirect(`/${locale}/series/${normalizedSlug}`);
  const notes = await getNotesBySeriesSlug(locale, slug);
  const series = notes[0]?.series;
  if (series === undefined) notFound();
  return (
    <main>
      <NoteCollection
        locale={locale}
        notes={notes}
        description={description(locale, series)}
        pathname={createInvestmentSeriesHref(locale, series)}
        title={series}
      />
    </main>
  );
}
