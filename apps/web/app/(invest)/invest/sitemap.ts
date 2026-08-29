import type { MetadataRoute } from "next";
import type { Locale } from "#lib/content-contracts";
import { investmentSourceKinds } from "#lib/invest/content";
import { getInvestmentNotes } from "#lib/invest/notes";
import {
  createInvestmentSeriesHref,
  createInvestmentSourceHref,
  createInvestmentTagHref,
} from "#lib/invest/routing";
import { alternateLocale } from "#lib/locale";
import { locales } from "#lib/site-routing";

const origin = "https://invest.jamie.kr";

function latestUpdate(
  notes: readonly { readonly updatedAt: string }[],
): string | undefined {
  return notes.toSorted((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0]?.updatedAt;
}

function alternates(
  koPath: string | undefined,
  enPath: string | undefined,
): { readonly languages: Readonly<Record<string, string>> } | undefined {
  if (koPath === undefined && enPath === undefined) return undefined;
  const languages: Record<string, string> = {};
  if (koPath !== undefined) languages.ko = `${origin}${koPath}`;
  if (enPath !== undefined) {
    languages.en = `${origin}${enPath}`;
    languages["x-default"] = `${origin}${enPath}`;
  }
  return { languages };
}

function localizedAlternates(
  locale: Locale,
  currentPath: string,
  alternatePath?: string,
): ReturnType<typeof alternates> {
  const paths: Partial<Record<Locale, string>> = { [locale]: currentPath };
  if (alternatePath !== undefined)
    paths[alternateLocale(locale)] = alternatePath;
  return alternates(paths.ko, paths.en);
}

/** 사이트맵 항목을 생성함 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const notesByLocale = Object.fromEntries(
    await Promise.all(
      locales.map(async (locale) => [locale, await getInvestmentNotes(locale)]),
    ),
  ) as Record<Locale, Awaited<ReturnType<typeof getInvestmentNotes>>>;
  const localizedRoots = alternates("/ko", "/en");
  const localizedNotes = alternates("/ko/notes", "/en/notes");
  const roots = locales.flatMap((locale) => {
    const localeNotes = notesByLocale[locale];
    const lastModified = latestUpdate(localeNotes);
    return [
      {
        url: `${origin}/${locale}`,
        lastModified,
        alternates: localizedRoots,
      },
      {
        url: `${origin}/${locale}/notes`,
        lastModified,
        alternates: localizedNotes,
      },
    ];
  });
  const sources = locales.flatMap((locale) =>
    investmentSourceKinds.flatMap((kind) => {
      const matching = notesByLocale[locale].filter((note) =>
        note.sources.some((source) => source.kind === kind),
      );
      if (matching.length < 2) return [];
      const otherLocale = alternateLocale(locale);
      const otherMatching = notesByLocale[otherLocale].filter((note) =>
        note.sources.some((source) => source.kind === kind),
      );
      return [
        {
          url: `${origin}${createInvestmentSourceHref(locale, kind)}`,
          lastModified: latestUpdate(matching),
          alternates: localizedAlternates(
            locale,
            createInvestmentSourceHref(locale, kind),
            otherMatching.length >= 2
              ? createInvestmentSourceHref(otherLocale, kind)
              : undefined,
          ),
        },
      ];
    }),
  );
  const tags = locales.flatMap((locale) => {
    const localeNotes = notesByLocale[locale];
    return [...new Set(localeNotes.flatMap((note) => note.tags))].flatMap(
      (tag) => {
        const matching = localeNotes.filter((note) => note.tags.includes(tag));
        if (matching.length < 2) return [];
        const otherLocale = alternateLocale(locale);
        const otherMatching = notesByLocale[otherLocale].filter((note) =>
          note.tags.includes(tag),
        );
        return [
          {
            url: `${origin}${createInvestmentTagHref(locale, tag)}`,
            lastModified: latestUpdate(matching),
            alternates: localizedAlternates(
              locale,
              createInvestmentTagHref(locale, tag),
              otherMatching.length >= 2
                ? createInvestmentTagHref(otherLocale, tag)
                : undefined,
            ),
          },
        ];
      },
    );
  });
  const series = locales.flatMap((locale) => {
    const localeNotes = notesByLocale[locale];
    return [
      ...new Set(
        localeNotes.flatMap((note) =>
          note.series === undefined ? [] : [note.series],
        ),
      ),
    ].flatMap((name) => {
      const matching = localeNotes.filter((note) => note.series === name);
      if (matching.length < 2) return [];
      const otherLocale = alternateLocale(locale);
      const otherMatching = notesByLocale[otherLocale].filter(
        (note) => note.series === name,
      );
      return [
        {
          url: `${origin}${createInvestmentSeriesHref(locale, name)}`,
          lastModified: latestUpdate(matching),
          alternates: localizedAlternates(
            locale,
            createInvestmentSeriesHref(locale, name),
            otherMatching.length >= 2
              ? createInvestmentSeriesHref(otherLocale, name)
              : undefined,
          ),
        },
      ];
    });
  });
  const noteEntries = locales.flatMap((locale) =>
    notesByLocale[locale].map((note) => {
      const otherLocale = alternateLocale(locale);
      const hasOther = notesByLocale[otherLocale].some(
        (candidate) => candidate.id === note.id,
      );
      return {
        url: `${origin}${note.href}`,
        lastModified: note.updatedAt,
        alternates: localizedAlternates(
          locale,
          note.href,
          hasOther ? `/${otherLocale}/notes/${note.id}` : undefined,
        ),
      };
    }),
  );
  return [...roots, ...sources, ...tags, ...series, ...noteEntries];
}
