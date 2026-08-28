import type { TOCItemType } from "fumadocs-core/toc";
import type { MDXContent } from "mdx/types";
import {
  compareDocumentMetadata,
  isLocale,
  type BlogPostManifestEntry,
  type ContentManifestEntry,
  type DocsPageManifestEntry,
  type Locale,
} from "./content-model.ts";
import {
  loadBlogContent,
  loadDocsContent,
  readContentSnapshot,
} from "./content-repository.ts";

export interface LoadedDocument {
  readonly metadata: ContentManifestEntry;
  readonly Content: MDXContent;
  readonly toc: readonly TOCItemType[];
  readonly previous: ContentManifestEntry | null;
  readonly next: ContentManifestEntry | null;
  readonly related: readonly ContentManifestEntry[];
}

/** validation·evidence용 전체 source 문서를 반환함 */
export async function getSourceDocuments(): Promise<
  readonly ContentManifestEntry[]
> {
  return readContentSnapshot().sourceTech.documents;
}

/** 공개된 Blog와 Docs 문서만 반환함 */
export async function getDocuments(): Promise<readonly ContentManifestEntry[]> {
  return readContentSnapshot().publishedTech.documents;
}

/** 전체 Blog 글을 반환함 */
export async function getBlogPosts(): Promise<
  readonly BlogPostManifestEntry[]
> {
  return readContentSnapshot().publishedTech.blogPosts;
}

/** 전체 Docs 페이지를 반환함 */
export async function getDocsPages(): Promise<
  readonly DocsPageManifestEntry[]
> {
  return readContentSnapshot().publishedTech.docsPages;
}

/** `getLocalizedDocuments` 데이터를 조회함 */
export async function getLocalizedDocuments(locale: Locale) {
  return (await getBlogPosts())
    .filter((post) => post.locale === locale)
    .sort(compareDocumentMetadata);
}

/** locale별 Docs 페이지를 반환함 */
export async function getLocalizedDocsPages(locale: Locale) {
  return (await getDocsPages())
    .filter((page) => page.locale === locale)
    .sort(compareDocumentMetadata);
}

/** `findDocument` 데이터를 조회함 */
export async function findDocument(locale: string, id: string) {
  if (!isLocale(locale)) return null;
  return (
    (await getDocuments()).find(
      (document) => document.locale === locale && document.id === id,
    ) ?? null
  );
}

/** locale과 ID로 Blog 글만 조회함 */
export async function findBlogPost(locale: string, id: string) {
  if (!isLocale(locale)) return null;
  return (
    (await getBlogPosts()).find(
      (post) => post.locale === locale && post.id === id,
    ) ?? null
  );
}

/** locale과 route slugs로 Docs 페이지만 조회함 */
export async function findDocsPage(locale: string, slugs: readonly string[]) {
  if (!isLocale(locale)) return null;
  return (
    (await getDocsPages()).find(
      (page) =>
        page.locale === locale &&
        page.slugs.length === slugs.length &&
        page.slugs.every((slug, index) => slug === slugs[index]),
    ) ?? null
  );
}

function countSharedTags(
  left: Pick<ContentManifestEntry, "tags">,
  right: Pick<ContentManifestEntry, "tags">,
): number {
  const rightTags = new Set(right.tags);
  return left.tags.reduce(
    (count, tag) => count + (rightTags.has(tag) ? 1 : 0),
    0,
  );
}

/** `rankRelatedDocuments` 결과를 계산함 */
export function rankRelatedDocuments(
  current: ContentManifestEntry,
  candidates: readonly ContentManifestEntry[],
  limit = 3,
): readonly ContentManifestEntry[] {
  return candidates
    .flatMap((candidate) => {
      if (
        candidate.locale !== current.locale ||
        candidate.contentType !== current.contentType ||
        candidate.id === current.id ||
        candidate.status === "deprecated"
      )
        return [];
      const sharedTags = countSharedTags(current, candidate);
      const sameSeries =
        current.contentType === "blog" &&
        candidate.contentType === "blog" &&
        current.series !== undefined &&
        candidate.series === current.series;
      if (sharedTags === 0 && !sameSeries) return [];
      return [
        {
          document: candidate,
          sharedTags,
          sameSeries,
          orderDistance: sameSeries
            ? Math.abs(
                (candidate.seriesOrder ?? 0) - (current.seriesOrder ?? 0),
              )
            : Number.POSITIVE_INFINITY,
        },
      ];
    })
    .toSorted(
      (left, right) =>
        Number(right.sameSeries) - Number(left.sameSeries) ||
        right.sharedTags - left.sharedTags ||
        left.orderDistance - right.orderDistance ||
        right.document.updatedAt.localeCompare(left.document.updatedAt) ||
        left.document.id.localeCompare(right.document.id),
    )
    .slice(0, Math.max(0, limit))
    .map(({ document }) => document);
}

/** `getRelatedDocuments` 데이터를 조회함 */
export async function getRelatedDocuments(
  locale: Locale,
  id: string,
  limit = 3,
) {
  const [current, documents] = await Promise.all([
    findDocument(locale, id),
    getDocuments(),
  ]);
  return current === null
    ? []
    : rankRelatedDocuments(current, documents, limit);
}

/** `loadDocument` 데이터를 조회함 */
export async function loadDocument(locale: Locale, id: string) {
  const metadata = await findDocument(locale, id);
  if (metadata === null) return null;
  const [seriesDocuments, ContentModule, related] = await Promise.all([
    getLocalizedDocuments(locale).then((documents) =>
      metadata.contentType !== "blog" || metadata.series === undefined
        ? documents
        : documents
            .filter((document) => document.series === metadata.series)
            .toSorted(
              (left, right) =>
                (left.seriesOrder ?? 0) - (right.seriesOrder ?? 0) ||
                left.id.localeCompare(right.id),
            ),
    ),
    metadata.contentType === "blog"
      ? loadBlogContent(locale, id)
      : loadDocsContent(locale, [...metadata.slugs]),
    getRelatedDocuments(locale, id),
  ]);
  if (ContentModule === null)
    throw new Error(`Missing compiled content for ${locale}/${id}.`);
  const index = seriesDocuments.findIndex((document) => document.id === id);
  return Object.freeze({
    metadata,
    Content: ContentModule.body,
    toc: ContentModule.toc,
    previous: index <= 0 ? null : (seriesDocuments[index - 1] ?? null),
    next:
      index < 0 || index >= seriesDocuments.length - 1
        ? null
        : (seriesDocuments[index + 1] ?? null),
    related,
  } satisfies LoadedDocument);
}

/** Blog 글 본문과 탐색 정보를 로드함 */
export async function loadBlogPost(locale: Locale, id: string) {
  const post = await findBlogPost(locale, id);
  if (post === null) return null;
  return loadDocument(locale, post.id);
}

/** Docs 본문과 page tree 경로를 로드함 */
export async function loadDocsPage(locale: Locale, slugs: readonly string[]) {
  const page = await findDocsPage(locale, slugs);
  if (page === null) return null;
  const ContentModule = await loadDocsContent(locale, [...slugs]);
  if (ContentModule === null)
    throw new Error(
      `Missing compiled docs content for ${locale}/${slugs.join("/")}.`,
    );
  return Object.freeze({
    metadata: page,
    Content: ContentModule.body,
    toc: ContentModule.toc,
    previous: null,
    next: null,
    related: await getRelatedDocuments(locale, page.id),
  } satisfies LoadedDocument);
}
