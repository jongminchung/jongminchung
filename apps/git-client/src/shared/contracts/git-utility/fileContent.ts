import { z } from "zod";
import { RepositoryIdSchema } from "../git-identifiers";
import { FileSourceSchema } from "./repositoryCommon";

const FilePathSchema = z.string().min(1).max(16_384);
const FileSizeSchema = z.number().int().nonnegative().safe();

export const GitReadFileRequestSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
    source: FileSourceSchema,
    path: FilePathSchema,
  })
  .strict()
  .readonly();
export type GitReadFileRequest = Readonly<z.infer<typeof GitReadFileRequestSchema>>;

export const FileContentSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("text"),
        path: FilePathSchema,
        content: z.string().max(5 * 1024 * 1024),
        sizeBytes: FileSizeSchema,
        lineCount: z.number().int().nonnegative().max(50_000),
      })
      .strict(),
    z
      .object({
        kind: z.literal("binary"),
        path: FilePathSchema,
        sizeBytes: FileSizeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("invalidUtf8"),
        path: FilePathSchema,
        sizeBytes: FileSizeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("tooLarge"),
        path: FilePathSchema,
        sizeBytes: FileSizeSchema,
        lineCount: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    z.object({ kind: z.literal("missing"), path: FilePathSchema }).strict(),
  ])
  .readonly();
export type FileContent = Readonly<z.infer<typeof FileContentSchema>>;

export const FilePreviewSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("image"),
        preview: z
          .object({
            path: FilePathSchema,
            mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
            dataUrl: z.string().max(8 * 1024 * 1024),
            sizeBytes: FileSizeSchema,
          })
          .strict()
          .readonly(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("binary"),
        path: FilePathSchema,
        sizeBytes: FileSizeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("tooLarge"),
        path: FilePathSchema,
        sizeBytes: FileSizeSchema,
      })
      .strict(),
    z.object({ kind: z.literal("missing"), path: FilePathSchema }).strict(),
  ])
  .readonly();
export type FilePreview = Readonly<z.infer<typeof FilePreviewSchema>>;

export const RepositoryInvalidationSchema = z.enum([
  "status",
  "history",
  "stash",
  "operation",
  "management",
]);

export const RepositoryChangedEventSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
    invalidations: z.array(RepositoryInvalidationSchema).min(1).max(5),
  })
  .strict()
  .superRefine((event, context) => {
    if (new Set(event.invalidations).size !== event.invalidations.length) {
      context.addIssue({
        code: "custom",
        path: ["invalidations"],
        message: "Repository invalidations must be unique",
      });
    }
  })
  .readonly();
export type RepositoryChangedEvent = Readonly<z.infer<typeof RepositoryChangedEventSchema>>;
export type RepositoryChangedListener = (event: RepositoryChangedEvent) => void;

export const GitWatchRepositoryRequestSchema = z
  .object({ repositoryId: RepositoryIdSchema })
  .strict()
  .readonly();
export type GitWatchRepositoryRequest = Readonly<z.infer<typeof GitWatchRepositoryRequestSchema>>;
