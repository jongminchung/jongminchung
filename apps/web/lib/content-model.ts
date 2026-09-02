import { z } from "zod";
import {
  credentialFreeHttpsUrlSchema,
  isLocale,
  isoDateSchema,
  localeSchema,
  locales,
  nonEmptyTrimmedStringSchema,
  publicationStatusSchema,
  uniqueStringArraySchema,
  type Locale,
} from "./content-contracts.ts";
import { isSeriesId } from "./tech/series.ts";

export { isLocale, locales };
export type { Locale };

const documentStatusSchema = z.enum(["stable", "deprecated", "experimental"]);

export const documentKinds = [
  "tutorial",
  "how-to",
  "reference",
  "explanation",
] as const;
const documentKindSchema = z.enum(documentKinds);
export type DocumentKind = z.infer<typeof documentKindSchema>;

export const docsAreas = ["rke2spray", "fe", "be", "k8s", "ansible"] as const;
export const publicDocsAreas = ["rke2spray", "fe", "be", "k8s"] as const;
export const docsAreaSchema = z.enum(docsAreas);
export type DocsArea = z.infer<typeof docsAreaSchema>;

const DOCUMENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const documentIdSchema = nonEmptyTrimmedStringSchema.regex(
  DOCUMENT_ID_PATTERN,
  'metadata field "id" must be a lowercase slug.',
);

const sharedFrontmatterShape = {
  title: nonEmptyTrimmedStringSchema,
  displayTitle: nonEmptyTrimmedStringSchema.optional(),
  description: nonEmptyTrimmedStringSchema,
  publishedAt: isoDateSchema,
  updatedAt: isoDateSchema,
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

const sharedMetadataShape = {
  id: documentIdSchema,
  locale: localeSchema,
  ...sharedFrontmatterShape,
} as const;

const blogPostFrontmatterShape = {
  ...sharedFrontmatterShape,
  thesis: nonEmptyTrimmedStringSchema,
  counterargument: nonEmptyTrimmedStringSchema,
  series: nonEmptyTrimmedStringSchema.optional(),
  seriesOrder: z.number().int().positive().optional(),
  verifiedAt: isoDateSchema.optional(),
} as const;

const blogPostMetadataShape = {
  id: documentIdSchema,
  locale: localeSchema,
  ...blogPostFrontmatterShape,
} as const;

const docsSharedFrontmatterShape = {
  ...sharedFrontmatterShape,
  verifiedAt: isoDateSchema,
} as const;

const docsSharedMetadataShape = {
  id: documentIdSchema,
  locale: localeSchema,
  ...docsSharedFrontmatterShape,
} as const;

const docsOverviewMetadataShape = {
  ...docsSharedMetadataShape,
  id: z.literal("docs-overview"),
  area: z.undefined().optional(),
  documentKind: z.undefined().optional(),
} as const;

const docsContentMetadataShape = {
  ...docsSharedMetadataShape,
  id: documentIdSchema.refine(
    (id) => id !== "docs-overview",
    'only the Docs root may use ID "docs-overview".',
  ),
  area: docsAreaSchema,
  documentKind: documentKindSchema,
} as const;

function validateSharedMetadata(
  value: z.infer<z.ZodObject<typeof sharedMetadataShape>> & {
    readonly verifiedAt?: string;
  },
  context: z.RefinementCtx,
): void {
  if (value.updatedAt < value.publishedAt) {
    context.addIssue({
      code: "custom",
      path: ["updatedAt"],
      message: 'metadata field "updatedAt" must not precede "publishedAt".',
    });
  }
  if (value.verifiedAt !== undefined && value.verifiedAt < value.updatedAt) {
    context.addIssue({
      code: "custom",
      path: ["verifiedAt"],
      message: 'metadata field "verifiedAt" must not precede "updatedAt".',
    });
  }
}

function validateBlogMetadata(
  value: z.infer<z.ZodObject<typeof blogPostMetadataShape>>,
  context: z.RefinementCtx,
): void {
  validateSharedMetadata(value, context);
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
}

export const blogPostMetadataSchema = z
  .strictObject(blogPostMetadataShape)
  .superRefine(validateBlogMetadata)
  .readonly();

export const blogPostFrontmatterSchema = z
  .strictObject(blogPostFrontmatterShape)
  .readonly();

export const docsPageFrontmatterSchema = z
  .strictObject({
    ...docsSharedFrontmatterShape,
    documentKind: documentKindSchema.optional(),
    overview: z.literal(true).optional(),
  })
  .readonly();

const docsOverviewMetadataSchema = z
  .strictObject(docsOverviewMetadataShape)
  .superRefine(validateSharedMetadata)
  .readonly();

const docsContentMetadataSchema = z
  .strictObject(docsContentMetadataShape)
  .superRefine(validateSharedMetadata)
  .readonly();

export const docsPageMetadataSchema = z
  .union([docsOverviewMetadataSchema, docsContentMetadataSchema])
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
    { ...docsOverviewMetadataShape, ...docsContentMetadataShape },
    value,
    source,
  );
}

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

/** 기술 블로그 글의 주제별 테마 이미지 경로를 생성함 */
export function createTechArticleImageHref(
  id: string,
  theme: "light" | "dark" = "light",
): string {
  return `/tech/articles/${id}.${theme}.png`;
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
