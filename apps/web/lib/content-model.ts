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

export const docsAreas = [
  "fe",
  "k8s",
  "architecture",
  "tooling",
  "practices",
] as const;
export const docsAreaSchema = z.enum(docsAreas);
export type DocsArea = z.infer<typeof docsAreaSchema>;

const DOCUMENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const sharedMetadataShape = {
  id: nonEmptyTrimmedStringSchema,
  locale: localeSchema,
  series: nonEmptyTrimmedStringSchema.optional(),
  seriesOrder: z.number().int().positive().optional(),
  title: nonEmptyTrimmedStringSchema,
  displayTitle: nonEmptyTrimmedStringSchema.optional(),
  description: nonEmptyTrimmedStringSchema,
  publishedAt: z.string(),
  updatedAt: z.string(),
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

const blogPostMetadataShape = {
  ...sharedMetadataShape,
  verifiedAt: z.string().optional(),
} as const;

const docsPageMetadataShape = {
  ...sharedMetadataShape,
  area: docsAreaSchema,
  documentKind: documentKindSchema,
  verifiedAt: z.string(),
} as const;

function validateSharedMetadata(
  value: z.infer<z.ZodObject<typeof sharedMetadataShape>> & {
    readonly verifiedAt?: string;
  },
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

export const blogPostMetadataSchema = z
  .strictObject(blogPostMetadataShape)
  .superRefine(validateSharedMetadata)
  .readonly();

export const docsPageMetadataSchema = z
  .strictObject(docsPageMetadataShape)
  .superRefine(validateSharedMetadata)
  .readonly();

export type BlogPostMetadata = z.infer<typeof blogPostMetadataSchema>;
export type DocsPageMetadata = z.infer<typeof docsPageMetadataSchema>;
export type DocMetadata = BlogPostMetadata | DocsPageMetadata;

export type BlogPostManifestEntry = BlogPostMetadata &
  Readonly<{
    area?: undefined;
    contentType: "blog";
    documentKind?: undefined;
    href: string;
    slugs?: undefined;
  }>;

export type DocsPageManifestEntry = DocsPageMetadata &
  Readonly<{
    contentType: "docs";
    href: string;
    slugs: readonly string[];
  }>;

export type ContentManifestEntry =
  | BlogPostManifestEntry
  | DocsPageManifestEntry;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata<Output>(
  schema: {
    readonly safeParse: (value: unknown) => z.ZodSafeParseResult<Output>;
  },
  fields: Readonly<Record<string, unknown>>,
  value: unknown,
  source: string,
): Output {
  if (isRecord(value)) {
    const supported = new Set(Object.keys(fields));
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
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const message = result.error.issues[0]?.message ?? "invalid metadata.";
  throw new Error(`${source}: ${message}`);
}

/** Blog frontmatter를 검증된 공개 모델로 파싱함 */
export function parseBlogPostMetadata(
  value: unknown,
  source = "blog post",
): BlogPostMetadata {
  return parseMetadata(
    blogPostMetadataSchema,
    blogPostMetadataShape,
    value,
    source,
  );
}

/** Docs frontmatter를 검증된 공개 모델로 파싱함 */
export function parseDocsPageMetadata(
  value: unknown,
  source = "docs page",
): DocsPageMetadata {
  return parseMetadata(
    docsPageMetadataSchema,
    docsPageMetadataShape,
    value,
    source,
  );
}

/** @deprecated Blog 메타데이터는 `parseBlogPostMetadata`로 파싱함 */
export const parseDocMetadata = parseBlogPostMetadata;

/** 문서의 표시 제목을 반환함 */
export function displayTitleFor(
  document: Pick<DocMetadata, "displayTitle" | "title">,
): string {
  return document.displayTitle ?? document.title;
}

/** Blog canonical 경로를 생성함 */
export function createBlogPostHref(locale: Locale, id: string): string {
  return `/${locale}/${id}`;
}

/** @deprecated Blog canonical은 `createBlogPostHref`로 생성함 */
export const createDocHref = createBlogPostHref;

/** Docs canonical 경로를 생성함 */
export function createDocsPageHref(
  locale: Locale,
  area?: DocsArea,
  id?: string,
): string {
  if (area === undefined) return `/${locale}/docs`;
  if (id === undefined) return `/${locale}/docs/${area}`;
  return `/${locale}/docs/${area}/${id}`;
}

/** 과거 Series 경로를 생성함 */
export function createSeriesHref(locale: Locale, id?: string): string {
  return id === undefined ? `/${locale}/series` : `/${locale}/series/${id}`;
}

/** OG 이미지 경로를 생성함 */
export function createOgImageHref(locale: Locale, id: string): string {
  return `/og/${locale}/${id}`;
}

/** 콘텐츠를 locale·최신 게시 순서로 비교함 */
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
