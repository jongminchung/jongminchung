import type { ComponentType } from "react";
import manifestData from "../generated/content-manifest.json";
import {
    documentLoaders,
    type DocumentLoaderKey,
} from "../generated/document-loaders";
import {
    compareDocumentMetadata,
    createDocHref,
    createDocumentKey,
    isLocale,
    parseDocMetadata,
    type ContentManifestEntry,
    type DocSection,
    type Locale,
    type OutlineEntry,
} from "./content-model";

export interface LoadedDocument {
    readonly metadata: ContentManifestEntry;
    readonly Content: ComponentType;
    readonly previous: ContentManifestEntry | null;
    readonly next: ContentManifestEntry | null;
    readonly related: readonly ContentManifestEntry[];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOutline(value: unknown, source: string): readonly OutlineEntry[] {
    if (!Array.isArray(value))
        throw new Error(`${source}: outline must be an array.`);
    return value.map((item) => {
        if (!isRecord(item))
            throw new Error(`${source}: invalid outline item.`);
        const { id, label, level } = item;
        if (
            typeof id !== "string" ||
            typeof label !== "string" ||
            (level !== 2 && level !== 3)
        ) {
            throw new Error(`${source}: invalid outline item.`);
        }
        return Object.freeze({ id, label, level });
    });
}

function parseManifest(value: unknown): readonly ContentManifestEntry[] {
    if (!Array.isArray(value))
        throw new Error("Content manifest must be an array.");
    return Object.freeze(
        value.map((item, index) => {
            if (!isRecord(item))
                throw new Error(`Manifest item ${index} must be an object.`);
            const { href, outline, ...metadataValue } = item;
            const metadata = parseDocMetadata(
                metadataValue,
                `manifest[${index}]`,
            );
            if (
                typeof href !== "string" ||
                href !== createDocHref(metadata.locale, metadata.id)
            ) {
                throw new Error(`manifest[${index}]: invalid href.`);
            }
            return Object.freeze({
                ...metadata,
                href,
                outline: parseOutline(outline, href),
            });
        }),
    );
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
