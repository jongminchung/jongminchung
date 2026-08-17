import { z } from "zod";
import {
    credentialFreeHttpsUrlSchema,
    isLocale,
    isoDateSchema,
    localeSchema,
    locales,
    nonEmptyTrimmedStringSchema,
    publicationStatusSchema,
    publicationStatuses,
    uniqueStringArraySchema,
    type Locale,
    type PublicationStatus,
} from "./content-contracts.ts";

export { isLocale, locales, publicationStatuses };
export type { Locale, PublicationStatus };

export const sections = ["overview", "handbook", "deep-dive"] as const;
export const sectionLandingSections = ["handbook", "deep-dive"] as const;
export const documentStatuses = [
    "stable",
    "deprecated",
    "experimental",
] as const;

export const docSectionSchema = z.enum(sections);
export const sectionLandingSchema = z.enum(sectionLandingSections);
export const documentStatusSchema = z.enum(documentStatuses);

export type DocSection = z.infer<typeof docSectionSchema>;
export type SectionLanding = z.infer<typeof sectionLandingSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type TechSeries = Exclude<DocSection, "overview">;

const DOCUMENT_ID_PATTERN =
    /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/u;

const docMetadataShape = {
    id: nonEmptyTrimmedStringSchema,
    locale: localeSchema,
    section: docSectionSchema,
    title: nonEmptyTrimmedStringSchema,
    displayTitle: nonEmptyTrimmedStringSchema.optional(),
    description: nonEmptyTrimmedStringSchema,
    order: z.number().int().nonnegative(),
    publishedAt: z.string(),
    updatedAt: z.string(),
    verifiedAt: z.string().optional(),
    tags: uniqueStringArraySchema("tags"),
    status: documentStatusSchema,
    publicationStatus: publicationStatusSchema,
    sourceUrl: credentialFreeHttpsUrlSchema,
    packageName: nonEmptyTrimmedStringSchema.optional(),
    packageVersion: nonEmptyTrimmedStringSchema.optional(),
    apiSymbols: uniqueStringArraySchema("apiSymbols", {
        allowEmpty: true,
    }).optional(),
} as const;

function validateDocMetadata(
    value: z.infer<z.ZodObject<typeof docMetadataShape>>,
    context: z.RefinementCtx,
): void {
    if (!DOCUMENT_ID_PATTERN.test(value.id)) {
        context.addIssue({
            code: "custom",
            path: ["id"],
            message: 'metadata field "id" must be a lowercase path.',
        });
    }
    if (
        (value.section === "overview" && value.id !== "overview") ||
        (value.section !== "overview" &&
            !value.id.startsWith(`${value.section}/`))
    ) {
        context.addIssue({
            code: "custom",
            path: ["id"],
            message: `document ID "${value.id}" does not belong to section "${value.section}".`,
        });
    }
    if (
        !isoDateSchema.safeParse(value.publishedAt).success ||
        !isoDateSchema.safeParse(value.updatedAt).success
    ) {
        context.addIssue({
            code: "custom",
            message: "publication dates must use the ISO date format.",
        });
    } else if (value.updatedAt < value.publishedAt) {
        context.addIssue({
            code: "custom",
            path: ["updatedAt"],
            message:
                'metadata field "updatedAt" must not precede "publishedAt".',
        });
    }
    if (
        value.verifiedAt !== undefined &&
        !isoDateSchema.safeParse(value.verifiedAt).success
    ) {
        context.addIssue({
            code: "custom",
            path: ["verifiedAt"],
            message: 'metadata field "verifiedAt" must be an ISO date.',
        });
    } else if (
        value.verifiedAt !== undefined &&
        value.verifiedAt < value.updatedAt
    ) {
        context.addIssue({
            code: "custom",
            path: ["verifiedAt"],
            message:
                'metadata field "verifiedAt" must not precede "updatedAt".',
        });
    }
}

export const docMetadataSchema = z
    .strictObject(docMetadataShape)
    .superRefine(validateDocMetadata)
    .readonly();

export const outlineEntrySchema = z
    .strictObject({
        id: nonEmptyTrimmedStringSchema,
        label: nonEmptyTrimmedStringSchema,
        level: z.union([z.literal(2), z.literal(3)]),
    })
    .readonly();

export const contentManifestEntrySchema = z
    .strictObject({
        ...docMetadataShape,
        href: nonEmptyTrimmedStringSchema,
        outline: z.array(outlineEntrySchema).readonly(),
    })
    .superRefine(validateDocMetadata)
    .readonly();

export const searchDocumentSchema = z
    .strictObject({
        id: nonEmptyTrimmedStringSchema,
        locale: localeSchema,
        section: docSectionSchema,
        title: nonEmptyTrimmedStringSchema,
        description: nonEmptyTrimmedStringSchema,
        order: z.number().int().nonnegative(),
        href: nonEmptyTrimmedStringSchema,
        headings: uniqueStringArraySchema("headings"),
        tags: uniqueStringArraySchema("tags"),
        apiSymbols: uniqueStringArraySchema("apiSymbols", {
            allowEmpty: true,
        }),
        body: z.string(),
    })
    .readonly();

export type DocMetadata = z.infer<typeof docMetadataSchema>;
export type OutlineEntry = z.infer<typeof outlineEntrySchema>;
export type ContentManifestEntry = z.infer<typeof contentManifestEntrySchema>;
export type SearchDocument = z.infer<typeof searchDocumentSchema>;

export interface TechArticleMetadata extends Omit<
    DocMetadata,
    "order" | "section" | "status"
> {
    readonly series: TechSeries;
    readonly seriesOrder: number;
    readonly maturity: DocumentStatus;
}

export interface NavigationEntry {
    readonly id: string;
    readonly section: DocSection;
    readonly title: string;
    readonly displayTitle?: string;
    readonly href: string;
}

export interface CurrentDocumentNavigationEntry extends NavigationEntry {
    readonly kind: "document";
    readonly outline: readonly OutlineEntry[];
}

export interface CurrentSectionNavigationEntry extends NavigationEntry {
    readonly kind: "section";
    readonly section: SectionLanding;
}

export type CurrentNavigationEntry =
    | CurrentDocumentNavigationEntry
    | CurrentSectionNavigationEntry;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `parseDocMetadata` 입력을 파싱함 */
export function parseDocMetadata(
    value: unknown,
    source = "document",
): DocMetadata {
    if (isRecord(value)) {
        const supported = new Set(Object.keys(docMetadataShape));
        const unknownFields = Object.keys(value).filter(
            (key) => !supported.has(key),
        );
        if (unknownFields.length > 0) {
            throw new Error(
                `${source}: unsupported metadata fields: ${unknownFields.join(", ")}.`,
            );
        }
        if (
            typeof value.locale === "string" &&
            !localeSchema.safeParse(value.locale).success
        ) {
            throw new Error(`${source}: unsupported locale "${value.locale}".`);
        }
        if (
            typeof value.section === "string" &&
            !docSectionSchema.safeParse(value.section).success
        ) {
            throw new Error(
                `${source}: unsupported section "${value.section}".`,
            );
        }
    }
    const result = docMetadataSchema.safeParse(value);
    if (result.success) return result.data;
    const message = result.error.issues[0]?.message ?? "invalid metadata.";
    throw new Error(`${source}: ${message}`);
}

/** `displayTitleFor` 공개 기능을 제공함 */
export function displayTitleFor(
    document: Pick<DocMetadata, "displayTitle" | "title">,
): string {
    return document.displayTitle ?? document.title;
}

/** `createDocHref` 결과를 생성함 */
export function createDocHref(locale: Locale, id: string): string {
    if (id === "overview") return `/${locale}`;
    const slug = id.split("/").at(-1);
    if (slug === undefined) throw new Error(`Invalid article ID: ${id}`);
    return `/${locale}/articles/${slug}`;
}

/** `createSectionHref` 결과를 생성함 */
export function createSectionHref(locale: Locale, section: DocSection): string {
    return section === "overview"
        ? `/${locale}`
        : `/${locale}/series/${section}`;
}

/** `createOgImageHref` 결과를 생성함 */
export function createOgImageHref(locale: Locale, id: string): string {
    return `/og/${locale}/${id}`;
}

/** `createDocumentKey` 결과를 생성함 */
export function createDocumentKey(locale: string, id: string): string {
    return `${locale}/${id}`;
}

/** `toTechArticleMetadata` 공개 기능을 제공함 */
export function toTechArticleMetadata(
    document: DocMetadata,
): TechArticleMetadata | null {
    if (document.section === "overview") return null;
    const { order, section, status, ...metadata } = document;
    return Object.freeze({
        ...metadata,
        series: section,
        seriesOrder: order,
        maturity: status,
    });
}

/** `compareDocumentMetadata` 값을 비교함 */
export function compareDocumentMetadata(
    left: Pick<DocMetadata, "id" | "locale" | "order" | "section">,
    right: Pick<DocMetadata, "id" | "locale" | "order" | "section">,
): number {
    return (
        left.locale.localeCompare(right.locale) ||
        sections.indexOf(left.section) - sections.indexOf(right.section) ||
        left.order - right.order ||
        left.id.localeCompare(right.id)
    );
}

/** `isSectionLanding` 조건을 판별함 */
export function isSectionLanding(value: string): value is SectionLanding {
    return sectionLandingSchema.safeParse(value).success;
}
