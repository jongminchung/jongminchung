import { z } from "zod";
import {
  credentialFreeHttpsUrlSchema,
  isoDateSchema,
  localeSchema,
  nonEmptyTrimmedStringSchema,
  publicationStatusSchema,
  uniqueStringArraySchema,
  type Locale,
} from "../content-contracts.ts";

export const investmentSourceKinds = [
  "book",
  "social",
  "video",
  "interview",
  "article",
] as const;

export const investmentSourceKindSchema = z.enum(investmentSourceKinds);
export type InvestmentSourceKind = z.infer<typeof investmentSourceKindSchema>;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const INVESTMENT_IMAGE_PATTERN = /^\/invest\/[a-z0-9]+(?:-[a-z0-9]+)*\.png$/u;

export const investmentSourceSchema = z
  .strictObject({
    kind: investmentSourceKindSchema,
    title: nonEmptyTrimmedStringSchema,
    creator: nonEmptyTrimmedStringSchema,
    url: credentialFreeHttpsUrlSchema.optional(),
    isbn: nonEmptyTrimmedStringSchema.optional(),
    publishedAt: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.kind !== "book" && value.url === undefined) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: `Source kind "${value.kind}" requires a URL.`,
      });
    }
    if (
      value.publishedAt !== undefined &&
      !isoDateSchema.safeParse(value.publishedAt).success
    ) {
      context.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Source has an invalid publication date.",
      });
    }
  })
  .readonly();

const investmentNoteShape = {
  id: nonEmptyTrimmedStringSchema,
  locale: localeSchema,
  title: nonEmptyTrimmedStringSchema,
  description: nonEmptyTrimmedStringSchema,
  publishedAt: z.string(),
  updatedAt: z.string(),
  status: publicationStatusSchema,
  tags: uniqueStringArraySchema("tags"),
  series: nonEmptyTrimmedStringSchema.optional(),
  image: z.string().regex(INVESTMENT_IMAGE_PATTERN),
  imageAlt: nonEmptyTrimmedStringSchema,
  sources: z.array(investmentSourceSchema).min(1).readonly(),
} as const;

function validateInvestmentNote(
  value: z.infer<z.ZodObject<typeof investmentNoteShape>>,
  context: z.RefinementCtx,
): void {
  if (!SLUG_PATTERN.test(value.id)) {
    context.addIssue({
      code: "custom",
      path: ["id"],
      message: "has an invalid ID.",
    });
  }
  if (
    !isoDateSchema.safeParse(value.publishedAt).success ||
    !isoDateSchema.safeParse(value.updatedAt).success
  ) {
    context.addIssue({
      code: "custom",
      message: "has an invalid publication date.",
    });
  } else if (value.updatedAt < value.publishedAt) {
    context.addIssue({
      code: "custom",
      path: ["updatedAt"],
      message: "update date precedes its publication date.",
    });
  }
}

export const investmentNoteMetadataSchema = z
  .strictObject(investmentNoteShape)
  .superRefine(validateInvestmentNote)
  .readonly();

export const investmentNoteManifestEntrySchema = z
  .strictObject({
    ...investmentNoteShape,
    href: nonEmptyTrimmedStringSchema,
  })
  .superRefine(validateInvestmentNote)
  .readonly();

export type InvestmentSource = z.infer<typeof investmentSourceSchema>;
export type InvestmentNoteMetadata = z.infer<
  typeof investmentNoteMetadataSchema
>;
export type InvestmentNoteManifestEntry = z.infer<
  typeof investmentNoteManifestEntrySchema
>;

/** `createInvestmentNoteHref` 결과를 생성함 */
export function createInvestmentNoteHref(locale: Locale, id: string): string {
  return `/${locale}/notes/${id}`;
}

/** `parseInvestmentNoteMetadata` 입력을 파싱함 */
export function parseInvestmentNoteMetadata(
  value: unknown,
  source = "investment note",
): InvestmentNoteMetadata {
  const result = investmentNoteMetadataSchema.safeParse(value);
  if (result.success) return result.data;
  const message = result.error.issues[0]?.message ?? "metadata is invalid.";
  throw new Error(`${source} ${message}`);
}

/** `validateInvestmentNoteBody` 입력을 검증함 */
export function validateInvestmentNoteBody(body: string, source: string): void {
  for (const component of ["SourceSummary", "JamieNotes"] as const) {
    if (new RegExp(`<${component}(?:\\s|>)`, "u").test(body))
      throw new Error(
        `${source} must use ordinary Markdown instead of <${component}>.`,
      );
  }
}
