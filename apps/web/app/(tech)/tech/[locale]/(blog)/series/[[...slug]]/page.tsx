import { notFound, permanentRedirect } from "next/navigation";
import { isLocale, locales } from "#lib/content-model";
import { docsOverviewForSeries } from "#lib/tech/routing";
import { isSeriesId } from "#lib/tech/series";
import { seriesRegistry } from "#lib/tech/series";

export function generateStaticParams() {
  return locales.flatMap((locale) => [
    { locale, slug: [] },
    ...Object.keys(seriesRegistry).map((series) => ({
      locale,
      slug: [series],
    })),
  ]);
}

/** 과거 Series URL을 대응 Docs overview로 한 번의 308 이동함 */
export default async function LegacySeriesPage({
  params,
}: {
  readonly params: Promise<{
    readonly locale: string;
    readonly slug?: string[];
  }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  if (slug === undefined || slug.length === 0)
    permanentRedirect(docsOverviewForSeries(locale));
  if (slug.length !== 1 || !isSeriesId(slug[0] ?? "")) notFound();
  permanentRedirect(docsOverviewForSeries(locale, slug[0]));
}
