import type { ComponentType } from "react";
import { z } from "zod";
import manifestData from "../generated/content-manifest.json";
import {
    documentLoaders,
    type DocumentLoaderKey,
} from "../generated/document-loaders";
import {
    compareDocumentMetadata,
    contentManifestEntrySchema,
    createDocHref,
    createDocumentKey,
    isLocale,
    type ContentManifestEntry,
    type DocSection,
    type Locale,
} from "./content-model";

export interface LoadedDocument {
    readonly metadata: ContentManifestEntry;
    readonly Content: ComponentType;
    readonly previous: ContentManifestEntry | null;
    readonly next: ContentManifestEntry | null;
    readonly related: readonly ContentManifestEntry[];
}

function parseManifest(value: unknown): readonly ContentManifestEntry[] {
    const result = z
        .array(contentManifestEntrySchema)
        .readonly()
        .safeParse(value);
    if (!result.success)
        throw new Error(
            `Invalid content manifest: ${result.error.issues[0]?.message ?? "unknown error"}`,
        );
    for (const [index, entry] of result.data.entries()) {
        if (entry.href !== createDocHref(entry.locale, entry.id))
            throw new Error(`manifest[${index}]: invalid href.`);
    }
    return result.data;
}

export const documents = parseManifest(manifestData);

export function getLocalizedDocuments(
    locale: Locale,
): readonly ContentManifestEntry[] {
    return documents
        .filter((document) => document.locale === locale)
        .sort(compareDocumentMetadata);
}

export function getSectionDocuments(
    locale: Locale,
    section: DocSection,
): readonly ContentManifestEntry[] {
    return getLocalizedDocuments(locale).filter(
        (document) => document.section === section,
    );
}

export function findDocument(
    locale: string,
    id: string,
): ContentManifestEntry | null {
    if (!isLocale(locale)) return null;
    return (
        documents.find(
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
            ) {
                return [];
            }
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

export function getRelatedDocuments(
    locale: Locale,
    id: string,
    limit = 3,
): readonly ContentManifestEntry[] {
    const current = findDocument(locale, id);
    return current === null
        ? []
        : rankRelatedDocuments(current, documents, limit);
}

export async function loadDocument(
    locale: Locale,
    id: string,
): Promise<LoadedDocument | null> {
    const metadata = findDocument(locale, id);
    const key = createDocumentKey(locale, id) as DocumentLoaderKey;
    const loader = documentLoaders[key];
    if (metadata === null || loader === undefined) return null;

    const localized = getLocalizedDocuments(locale);
    const index = localized.findIndex((document) => document.id === id);
    const module = await loader();
    return Object.freeze({
        metadata,
        Content: module.default,
        previous: index <= 0 ? null : (localized[index - 1] ?? null),
        next:
            index < 0 || index >= localized.length - 1
                ? null
                : (localized[index + 1] ?? null),
        related: getRelatedDocuments(locale, id),
    });
}
