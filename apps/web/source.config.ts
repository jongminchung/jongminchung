import {
  applyMdxPreset,
  defineCollections,
  defineConfig,
} from "fumadocs-mdx/config";
import type { RefinementCtx } from "zod";
import { docMetadataSchema, type DocMetadata } from "./lib/content-model.ts";
import {
  validateDocumentEntry,
  validateInvestmentNoteEntry,
  type ContentEntry,
} from "./lib/content-validation.ts";
import {
  investmentNoteMetadataSchema,
  type InvestmentNoteMetadata,
} from "./lib/invest/content.ts";
import { remarkKrokiUrl } from "./lib/remark-kroki-url.ts";

function collectionPath(path: string, collection: "invest" | "tech"): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.split(`/content/${collection}/`).at(-1) ?? normalized;
}

function addValidationIssue(context: RefinementCtx, validate: () => void) {
  try {
    validate();
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function techSchema({ path, source }: { path: string; source: string }) {
  return docMetadataSchema.superRefine((metadata, context) => {
    const entry: ContentEntry<DocMetadata> = {
      metadata,
      body: source,
      relativePath: collectionPath(path, "tech"),
    };
    addValidationIssue(context, () => validateDocumentEntry(entry));
  });
}

function investmentSchema({ path, source }: { path: string; source: string }) {
  return investmentNoteMetadataSchema.superRefine((metadata, context) => {
    const entry: ContentEntry<InvestmentNoteMetadata> = {
      metadata,
      body: source,
      relativePath: collectionPath(path, "invest"),
    };
    addValidationIssue(context, () => validateInvestmentNoteEntry(entry));
  });
}

export const techCollection = defineCollections({
  type: "doc",
  dir: "content/tech",
  files: ["**/*.mdx"],
  async: true,
  mdxOptions: applyMdxPreset({
    rehypeCodeOptions: {
      addLanguageClass: true,
      fallbackLanguage: "plaintext",
      langAlias: { excalidraw: "plaintext" },
      themes: { light: "github-light", dark: "github-dark" },
    },
    remarkPlugins: (plugins) => [...plugins, remarkKrokiUrl],
  }),
  schema: techSchema,
  postprocess: { extractLinkReferences: true },
});

export const investmentCollection = defineCollections({
  type: "doc",
  dir: "content/invest",
  files: ["**/notes/*.mdx"],
  async: true,
  mdxOptions: applyMdxPreset(),
  schema: investmentSchema,
  postprocess: { extractLinkReferences: true },
});

export default defineConfig();
