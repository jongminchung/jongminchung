import type { TOCItemType } from "fumadocs-core/toc";
import type { MDXContent } from "mdx/types";
import {
  compareDocumentMetadata,
  isLocale,
  type ContentManifestEntry,
  type Locale,
} from "./content-model.ts";
import { loadTechContent, readContentSnapshot } from "./content-repository.ts";

export interface LoadedDocument {
  readonly metadata: ContentManifestEntry;
  readonly Content: MDXContent;
  readonly toc: readonly TOCItemType[];
  readonly previous: ContentManifestEntry | null;
  readonly next: ContentManifestEntry | null;
  readonly related: readonly ContentManifestEntry[];
}

/** `getDocuments` 데이터를 조회함 */
export async function getDocuments(): Promise<readonly ContentManifestEntry[]> {
  return readContentSnapshot().documents;
}

/** `getLocalizedDocuments` 데이터를 조회함 */
export async function getLocalizedDocuments(locale: Locale) {
  return (await getDocuments())
    .filter((document) => document.locale === locale)
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
        candidate.id === current.id ||
        candidate.status === "deprecated"
      )
        return [];
      const sharedTags = countSharedTags(current, candidate);
      const sameSeries =
        current.series !== undefined && candidate.series === current.series;
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
      metadata.series === undefined
        ? documents
        : documents
            .filter((document) => document.series === metadata.series)
            .toSorted(
              (left, right) =>
                (left.seriesOrder ?? 0) - (right.seriesOrder ?? 0) ||
                left.id.localeCompare(right.id),
            ),
    ),
    loadTechContent(locale, id),
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
