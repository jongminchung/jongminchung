import type { SortedResult } from "fumadocs-core/search";
import { createFromSource } from "fumadocs-core/search/server";
import { displayTitleFor, type Locale } from "../content-model.ts";
import { readContentSnapshot } from "../content-repository.ts";
import { blogSource, docsSource } from "../fumadocs-source.ts";
import { docsCategoryIds, getDocsCategory } from "./docs.ts";
import { isPublishedContent } from "./publication.ts";
import {
  createSearchAliases,
  filterSearchResults,
  interleaveSearchResults,
  normalizeSearchText,
  segmentSearchQuery,
} from "./search.ts";

const publicBlogSource = {
  ...blogSource,
  getPages: (locale?: string) =>
    blogSource.getPages(locale).filter((page) => isPublishedContent(page.data)),
};
const publicDocsSource = {
  ...docsSource,
  getPages: (locale?: string) =>
    docsSource.getPages(locale).filter((page) => isPublishedContent(page.data)),
};

const sources = [publicBlogSource, publicDocsSource] as const;

const searchTerms = new Map(
  (["ko", "en"] as const).map((locale) => [
    locale,
    new Set(
      sources.flatMap((source) =>
        source
          .getPages(locale)
          .flatMap((page) =>
            [
              page.data.title,
              page.data.description,
              ...page.data.tags,
              ...(page.data.apiSymbols ?? []),
            ].flatMap(
              (value) =>
                normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [],
            ),
          ),
      ),
    ),
  ]),
);

async function searchIndex(page: typeof blogSource.$inferPage) {
  const structuredData = await page.data.structuredData();
  const aliases = createSearchAliases([
    page.data.title,
    page.data.description,
    ...page.data.tags,
    ...(page.data.apiSymbols ?? []),
    ...structuredData.headings.map(({ content }) => content),
  ]);
  return {
    id: page.url,
    title: page.data.title,
    description: page.data.description,
    breadcrumbs: ["Blog"],
    url: page.url,
    structuredData: {
      headings: structuredData.headings,
      contents: [
        ...structuredData.contents,
        ...aliases.map((content) => ({ heading: undefined, content })),
      ],
    },
  };
}

const blogSearch = createFromSource(publicBlogSource, {
  buildIndex: searchIndex,
});
const docsSearch = createFromSource(publicDocsSource, {
  buildIndex: async (page) => {
    const structuredData = await page.data.structuredData();
    const aliases = createSearchAliases([
      page.data.title,
      page.data.description,
      ...page.data.tags,
      ...(page.data.apiSymbols ?? []),
      ...structuredData.headings.map(({ content }) => content),
    ]);
    const breadcrumbs =
      page.data.area === undefined || page.data.documentKind === undefined
        ? ["Docs"]
        : [
            page.data.documentKind,
            getDocsCategory(page.data.area, page.data.locale).title,
          ];
    return {
      id: page.url,
      title: page.data.title,
      description: page.data.description,
      breadcrumbs,
      url: page.url,
      structuredData: {
        headings: structuredData.headings,
        contents: [
          ...structuredData.contents,
          ...aliases.map((content) => ({ heading: undefined, content })),
        ],
      },
    };
  },
});

function emptyQueryResults(locale: Locale): readonly SortedResult[] {
  const snapshot = readContentSnapshot();
  const blog = snapshot.publishedTech.blogPosts
    .filter((post) => post.locale === locale)
    .slice(0, 4)
    .map(
      (post): SortedResult => ({
        id: post.href,
        url: post.href,
        type: "page",
        content: displayTitleFor(post),
        breadcrumbs: ["Blog"],
      }),
    );
  const docs = docsCategoryIds
    .map((area) => {
      const page = snapshot.publishedTech.docsPages.find(
        (page) =>
          page.locale === locale &&
          page.area === area &&
          page.id === `${area}-overview`,
      );
      return page === undefined ? undefined : { area, page };
    })
    .filter((entry) => entry !== undefined)
    .map(
      ({ area, page }): SortedResult => ({
        id: page.href,
        url: page.href,
        type: "page",
        content: displayTitleFor(page),
        breadcrumbs: [
          page.documentKind ?? "Docs",
          getDocsCategory(area, locale).title,
        ],
      }),
    );
  return interleaveSearchResults(blog, docs, 8);
}

/** Blog와 Docs 색인을 locale 범위에서 결정적으로 통합함 */
export async function searchTechDocuments(
  query: string,
  locale: Locale,
  limit = 32,
): Promise<readonly SortedResult[]> {
  const effectiveQuery = segmentSearchQuery(
    query,
    searchTerms.get(locale) ?? [],
  );
  if (effectiveQuery.length === 0) return emptyQueryResults(locale);
  const [blogResults, docsResults] = await Promise.all([
    blogSearch.search(effectiveQuery, { locale, limit }),
    docsSearch.search(effectiveQuery, { locale, limit }),
  ]);
  return interleaveSearchResults(
    filterSearchResults(blogResults, effectiveQuery),
    filterSearchResults(docsResults, effectiveQuery),
    limit,
  );
}
