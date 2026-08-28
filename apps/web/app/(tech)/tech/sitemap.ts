import type { MetadataRoute } from "next";
import { locales, type Locale } from "#lib/content-model";
import { getBlogPosts, getDocsPages } from "#lib/documents";

const siteOrigin = "https://tech.jamie.kr";
const absoluteUrl = (pathname: string): string =>
  new URL(pathname, siteOrigin).toString();

function latestUpdate(
  documents: readonly { readonly updatedAt: string }[],
): string | undefined {
  return documents.toSorted((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0]?.updatedAt;
}

function localizedAlternates(pathFor: (locale: Locale) => string) {
  return {
    languages: Object.fromEntries([
      ...locales.map((locale) => [locale, absoluteUrl(pathFor(locale))]),
      ["x-default", absoluteUrl(pathFor("en"))],
    ]),
  };
}

/** Blog와 Docs의 최종 canonical URL만 sitemap에 출력함 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, docs] = await Promise.all([getBlogPosts(), getDocsPages()]);
  const blogRoots = locales.map((locale) => ({
    url: absoluteUrl(`/${locale}`),
    lastModified: latestUpdate(posts.filter((post) => post.locale === locale)),
    alternates: localizedAlternates((candidate) => `/${candidate}`),
  }));
  const blogEntries = posts.map((post) => ({
    url: absoluteUrl(post.href),
    lastModified: post.updatedAt,
    alternates: localizedAlternates((locale) => `/${locale}/${post.id}`),
  }));
  const docsEntries = docs.map((page) => ({
    url: absoluteUrl(page.href),
    lastModified: page.updatedAt,
    alternates: localizedAlternates((locale) => {
      const counterpart = docs.find(
        (candidate) => candidate.locale === locale && candidate.id === page.id,
      );
      if (counterpart === undefined)
        throw new Error(`Missing Docs counterpart for ${page.id}/${locale}.`);
      return counterpart.href;
    }),
  }));
  const showcaseEntries = locales.map((locale) => ({
    url: absoluteUrl(`/${locale}/showcase`),
    alternates: localizedAlternates((candidate) => `/${candidate}/showcase`),
  }));
  return [...blogRoots, ...blogEntries, ...docsEntries, ...showcaseEntries];
}
