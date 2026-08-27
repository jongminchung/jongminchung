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
import { isSeriesId } from "./tech/series.ts";

export { isLocale, locales, publicationStatuses };
export type { Locale, PublicationStatus };

export const documentStatuses = [
  "stable",
  "deprecated",
  "experimental",
] as const;
export const documentStatusSchema = z.enum(documentStatuses);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const documentKinds = [
  "tutorial",
  "how-to",
  "reference",
  "explanation",
] as const;
export const documentKindSchema = z.enum(documentKinds);
export type DocumentKind = z.infer<typeof documentKindSchema>;

const DOCUMENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const docMetadataShape = {
  id: nonEmptyTrimmedStringSchema,
  locale: localeSchema,
  documentKind: documentKindSchema.optional(),
  series: nonEmptyTrimmedStringSchema.optional(),
  seriesOrder: z.number().int().positive().optional(),
  title: nonEmptyTrimmedStringSchema,
  displayTitle: nonEmptyTrimmedStringSchema.optional(),
  description: nonEmptyTrimmedStringSchema,
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
      message: 'metadata field "id" must be a lowercase slug.',
    });
  }
  if ((value.series === undefined) !== (value.seriesOrder === undefined)) {
    context.addIssue({
      code: "custom",
      path: value.series === undefined ? ["seriesOrder"] : ["series"],
      message:
        'metadata fields "series" and "seriesOrder" must be used together.',
    });
  }
  if (value.series !== undefined && !isSeriesId(value.series)) {
    context.addIssue({
      code: "custom",
      path: ["series"],
      message: `metadata references unknown series "${String(value.series)}".`,
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
      message: 'metadata field "updatedAt" must not precede "publishedAt".',
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
      message: 'metadata field "verifiedAt" must not precede "updatedAt".',
    });
  }
}

export const docMetadataSchema = z
  .strictObject(docMetadataShape)
  .superRefine(validateDocMetadata)
  .readonly();

export type DocMetadata = z.infer<typeof docMetadataSchema>;
export type ContentManifestEntry = DocMetadata &
  Readonly<{
    href: string;
  }>;

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
    if (unknownFields.length > 0)
      throw new Error(
        `${source}: unsupported metadata fields: ${unknownFields.join(", ")}.`,
      );
    if (
      typeof value.locale === "string" &&
      !localeSchema.safeParse(value.locale).success
    ) {
      throw new Error(`${source}: unsupported locale "${value.locale}".`);
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
  return `/${locale}/${id}`;
}

/** `createSeriesHref` 결과를 생성함 */
export function createSeriesHref(locale: Locale, id?: string): string {
  return id === undefined ? `/${locale}/series` : `/${locale}/series/${id}`;
}

/** `createOgImageHref` 결과를 생성함 */
export function createOgImageHref(locale: Locale, id: string): string {
  return `/og/${locale}/${id}`;
}

/** `compareDocumentMetadata` 최신 게시 순서를 비교함 */
export function compareDocumentMetadata(
  left: Pick<DocMetadata, "id" | "locale" | "publishedAt">,
  right: Pick<DocMetadata, "id" | "locale" | "publishedAt">,
): number {
  return (
    left.locale.localeCompare(right.locale) ||
    right.publishedAt.localeCompare(left.publishedAt) ||
    left.id.localeCompare(right.id)
  );
}
