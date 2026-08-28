import type { MetadataRoute } from "next";
import { investmentSourceKinds } from "#lib/invest/content";
import { getInvestmentNotes } from "#lib/invest/notes";
import { locales } from "#lib/site-routing";

const origin = "https://invest.jamie.kr";

/** 사이트맵 항목을 생성함 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const roots = locales.flatMap((locale) => [
    { url: `${origin}/${locale}` },
    { url: `${origin}/${locale}/notes` },
    ...investmentSourceKinds.map((kind) => ({
      url: `${origin}/${locale}/sources/${kind}`,
    })),
  ]);
  const notes = (await Promise.all(locales.map(getInvestmentNotes)))
    .flat()
    .map((note) => ({
      url: `${origin}${note.href}`,
      lastModified: note.updatedAt,
      alternates: {
        languages: {
          ko: `${origin}/ko/notes/${note.id}`,
          en: `${origin}/en/notes/${note.id}`,
        },
      },
    }));
  return [...roots, ...notes];
}
