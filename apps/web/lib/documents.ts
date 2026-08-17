import type { ComponentType } from "react";
import {
    compareDocumentMetadata,
    isLocale,
    type ContentManifestEntry,
    type DocSection,
    type Locale,
} from "./content-model.ts";
import { readContentSnapshot, renderTechMdx } from "./content-repository.ts";

export interface LoadedDocument {
    readonly metadata: ContentManifestEntry;
    readonly Content: ComponentType;
    readonly previous: ContentManifestEntry | null;
    readonly next: ContentManifestEntry | null;
    readonly related: readonly ContentManifestEntry[];
}

/** `getDocuments` 데이터를 조회함 */
export async function getDocuments(): Promise<readonly ContentManifestEntry[]> {
    return (await readContentSnapshot()).documents;
}

/** `getLocalizedDocuments` 데이터를 조회함 */
export async function getLocalizedDocuments(locale: Locale) {
    return (await getDocuments())
        .filter((document) => document.locale === locale)
        .sort(compareDocumentMetadata);
}

/** `getSectionDocuments` 데이터를 조회함 */
export async function getSectionDocuments(locale: Locale, section: DocSection) {
    return (await getLocalizedDocuments(locale)).filter(
        (document) => document.section === section,
    );
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
                candidate.section === "overview" ||
                candidate.status === "deprecated"
            )
                return [];
            const sharedTags = countSharedTags(current, candidate);
            const sameSection = candidate.section === current.section;
            if (sharedTags === 0 && !sameSection) return [];
            return [
                {
                    document: candidate,
                    sharedTags,
                    sameSection,
                    orderDistance: sameSection
                        ? Math.abs(candidate.order - current.order)
                        : Number.POSITIVE_INFINITY,
                },
            ];
        })
        .toSorted(
            (left, right) =>
                right.sharedTags - left.sharedTags ||
                Number(right.sameSection) - Number(left.sameSection) ||
                left.orderDistance - right.orderDistance ||
                right.document.updatedAt.localeCompare(
                    left.document.updatedAt,
                ) ||
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
    const [localized, ContentModule, related] = await Promise.all([
        getLocalizedDocuments(locale),
        renderTechMdx(locale, id),
        getRelatedDocuments(locale, id),
    ]);
    const index = localized.findIndex((document) => document.id === id);
    return Object.freeze({
        metadata,
        Content: ContentModule.default as ComponentType,
        previous: index <= 0 ? null : (localized[index - 1] ?? null),
        next:
            index < 0 || index >= localized.length - 1
                ? null
                : (localized[index + 1] ?? null),
        related,
    } satisfies LoadedDocument);
}
