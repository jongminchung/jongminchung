import type { MetadataRoute } from "next";
import { createSeriesHref, locales } from "#lib/content-model";
import { getDocuments } from "#lib/documents";
import { seriesRegistry } from "#lib/tech/series";

const siteOrigin = "https://tech.jamie.kr";
const absoluteUrl = (pathname: string): string =>
  new URL(pathname, siteOrigin).toString();

/** 사이트맵 항목을 생성함 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const documents = await getDocuments();
  const blogEntries = locales.map((locale) => ({
    url: absoluteUrl(`/${locale}`),
    alternates: {
      languages: Object.fromEntries(
        locales.map((candidate) => [candidate, absoluteUrl(`/${candidate}`)]),
      ),
    },
  }));
  const documentEntries = documents.map((document) => ({
    url: absoluteUrl(document.href),
    lastModified: document.updatedAt,
    alternates: {
      languages: Object.fromEntries(
        locales.map((locale) => [
          locale,
          absoluteUrl(`/${locale}/${document.id}`),
        ]),
      ),
    },
  }));
  const seriesEntries = locales.flatMap((locale) => [
    {
      url: absoluteUrl(createSeriesHref(locale)),
      alternates: {
        languages: Object.fromEntries(
          locales.map((candidate) => [
            candidate,
            absoluteUrl(createSeriesHref(candidate)),
          ]),
        ),
      },
    },
    ...Object.keys(seriesRegistry).map((id) => ({
      url: absoluteUrl(createSeriesHref(locale, id)),
      lastModified: documents
        .filter(
          (document) => document.locale === locale && document.series === id,
        )
        .toSorted((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        )[0]?.updatedAt,
      alternates: {
        languages: Object.fromEntries(
          locales.map((candidate) => [
            candidate,
            absoluteUrl(createSeriesHref(candidate, id)),
          ]),
        ),
      },
    })),
  ]);
  return [...blogEntries, ...documentEntries, ...seriesEntries];
}
