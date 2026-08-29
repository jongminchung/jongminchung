import { cache } from "react";
import {
  isLocale,
  type DocsPageManifestEntry,
  type Locale,
} from "../content-model.ts";
import {
  loadDocsContent,
  readPublishedTechContent,
  type TechContentCollection,
} from "../content-repository.ts";
import { rankRelatedDocuments, type LoadedDocument } from "../documents.ts";
import { alternateLocale } from "../locale.ts";
import { isDocsCategoryId } from "./docs.ts";

type ResolvedDocsBase = Readonly<{
  locale: Locale;
  slugs: readonly string[];
  page: DocsPageManifestEntry;
  alternatePage: DocsPageManifestEntry;
}>;

export type ResolvedTechDocsPage =
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "redirect"; destination: string }>
  | (ResolvedDocsBase &
      Readonly<{
        kind: "landing";
        documents: readonly DocsPageManifestEntry[];
      }>)
  | (ResolvedDocsBase &
      Readonly<{
        kind: "article";
        publicUrls: ReadonlySet<string>;
        related: LoadedDocument["related"];
      }>);

function docsPageAt(
  pages: readonly DocsPageManifestEntry[],
  locale: Locale,
  slugs: readonly string[],
): DocsPageManifestEntry | undefined {
  return pages.find(
    (page) =>
      page.locale === locale &&
      page.slugs.length === slugs.length &&
      page.slugs.every((slug, index) => slug === slugs[index]),
  );
}

function movedDestination(
  content: TechContentCollection,
  locale: Locale,
  id: string | undefined,
): string | undefined {
  if (id === undefined) return undefined;
  return (
    content.docsPages.find((page) => page.locale === locale && page.id === id)
      ?.href ??
    content.blogPosts.find((post) => post.locale === locale && post.id === id)
      ?.href
  );
}

function legacyDocsDestination(
  locale: Locale,
  slugs: readonly string[],
): string | null {
  const [area, ...rest] = slugs;
  if (area === "architecture")
    return `/${locale}/docs/be${rest.length === 0 ? "" : `/${rest.join("/")}`}`;
  if (area === "tooling")
    return `/${locale}/docs/fe${rest.length === 0 ? "" : `/${rest.join("/")}`}`;
  if (area === "practices" && rest.length === 0) return `/${locale}/docs/be`;
  if (area === "practices" && rest.length === 1 && rest[0] === "collaboration")
    return `/${locale}/docs/be/collaboration`;
  return null;
}

/** 검증된 collection 하나에서 redirect·landing·article route model을 조립함 */
export function resolveTechDocsPageFromContent(
  localeValue: string,
  slugs: readonly string[],
  content: TechContentCollection,
): ResolvedTechDocsPage {
  if (!isLocale(localeValue)) return Object.freeze({ kind: "not-found" });
  const locale = localeValue;
  if (
    ["architecture", "tooling", "practices"].includes(slugs[0] ?? "") &&
    slugs.length === 2
  ) {
    const destination = movedDestination(content, locale, slugs[1]);
    if (destination !== undefined)
      return Object.freeze({ kind: "redirect", destination });
  }
  const legacyDestination = legacyDocsDestination(locale, slugs);
  if (legacyDestination !== null)
    return Object.freeze({
      kind: "redirect",
      destination: legacyDestination,
    });

  const page = docsPageAt(content.docsPages, locale, slugs);
  if (page === undefined) {
    const destination = movedDestination(content, locale, slugs.at(-1));
    return destination === undefined
      ? Object.freeze({ kind: "not-found" })
      : Object.freeze({ kind: "redirect", destination });
  }
  const alternatePage = docsPageAt(
    content.docsPages,
    alternateLocale(locale),
    slugs,
  );
  if (alternatePage === undefined)
    throw new Error(`Missing localized Docs counterpart for ${page.href}.`);
  const base = Object.freeze({
    locale,
    slugs: Object.freeze([...slugs]),
    page,
    alternatePage,
  });

  if (slugs.length === 0)
    return Object.freeze({
      ...base,
      kind: "landing",
      documents: Object.freeze(
        content.docsPages.filter(
          (candidate) =>
            candidate.locale === locale && candidate.area !== undefined,
        ),
      ),
    });
  if (
    page.area === undefined ||
    page.documentKind === undefined ||
    !isDocsCategoryId(slugs[0] ?? "")
  )
    return Object.freeze({ kind: "not-found" });
  const publicUrls = new Set(
    content.docsPages
      .filter(
        (candidate) =>
          candidate.locale === locale && candidate.area === page.area,
      )
      .map((candidate) => candidate.href),
  );
  return Object.freeze({
    ...base,
    kind: "article",
    publicUrls,
    related: Object.freeze(rankRelatedDocuments(page, content.documents)),
  });
}

const resolveCachedTechDocsPage = cache(
  async (locale: string, slugPath: string): Promise<ResolvedTechDocsPage> =>
    resolveTechDocsPageFromContent(
      locale,
      slugPath.length === 0 ? [] : slugPath.split("/"),
      readPublishedTechContent(),
    ),
);

/** metadata와 page render가 공유하는 request-memoized Docs route resolver임 */
export async function resolveTechDocsPage(
  locale: string,
  slugs: readonly string[],
): Promise<ResolvedTechDocsPage> {
  return resolveCachedTechDocsPage(locale, slugs.join("/"));
}

/** 이미 해석된 Docs article의 MDX 본문만 로드함 */
export async function loadResolvedTechDocsPage(
  model: Extract<ResolvedTechDocsPage, { kind: "article" }>,
): Promise<LoadedDocument> {
  const compiled = await loadDocsContent(model.locale, [...model.slugs]);
  if (compiled === null)
    throw new Error(
      `Missing compiled docs content for ${model.locale}/${model.slugs.join("/")}.`,
    );
  return Object.freeze({
    metadata: model.page,
    Content: compiled.body,
    toc: compiled.toc,
    previous: null,
    next: null,
    related: model.related,
  });
}
