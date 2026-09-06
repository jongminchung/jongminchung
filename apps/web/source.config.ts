import {
  applyMdxPreset,
  defineCollections,
  defineConfig,
  defineDocs,
} from "fumadocs-mdx/config";
import { z, type RefinementCtx } from "zod";
import {
  blogPostFrontmatterSchema,
  blogPostMetadataSchema,
  docsPageFrontmatterSchema,
  docsPageMetadataSchema,
  type BlogPostMetadata,
  type DocsPageMetadata,
} from "./lib/content-model.ts";
import {
  validateBlogPostEntry,
  validateDocsPageEntry,
  validateInvestmentNoteEntry,
  type ContentEntry,
} from "./lib/content-validation.ts";
import {
  investmentNoteMetadataSchema,
  type InvestmentNoteMetadata,
} from "./lib/invest/content.ts";
import { remarkKrokiUrl } from "./lib/remark-kroki-url.ts";
import {
  remarkReadingAnnotations,
  readingStructureOptions,
} from "./lib/remark-reading-annotations.ts";
import { remarkReadingSource } from "./lib/remark-reading-source.ts";
import {
  parseBlogContentPath,
  parseDocsContentPath,
} from "./lib/tech/content-path.ts";

function collectionPath(path: string, collectionRoot: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.split(`/content/${collectionRoot}/`).at(-1) ?? normalized;
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

function blogSchema({ path, source }: { path: string; source: string }) {
  const relativePath = collectionPath(path, "tech/blog");
  const identity = parseBlogContentPath(relativePath);
  return blogPostFrontmatterSchema
    .transform((frontmatter) => ({ ...frontmatter, ...identity }))
    .pipe(blogPostMetadataSchema)
    .superRefine((metadata, context) => {
      const entry: ContentEntry<BlogPostMetadata> = {
        metadata,
        body: source,
        relativePath,
      };
      addValidationIssue(context, () => validateBlogPostEntry(entry));
    });
}

function docsSchema({ path, source }: { path: string; source: string }) {
  const relativePath = collectionPath(path, "tech/docs");
  return docsPageFrontmatterSchema
    .transform(({ overview, ...frontmatter }) => ({
      ...frontmatter,
      ...parseDocsContentPath(relativePath, overview),
    }))
    .pipe(docsPageMetadataSchema)
    .superRefine((metadata, context) => {
      const entry: ContentEntry<DocsPageMetadata> = {
        metadata,
        body: source,
        relativePath,
      };
      addValidationIssue(context, () => validateDocsPageEntry(entry));
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

// CLI의 링크·검색 데이터 추출에는 렌더링 전용 구문 강조가 필요하지 않음
const metadataOnly = process.env.JAMIE_MDX_METADATA_ONLY === "1";

function techMdxOptions(preserveSource = false) {
  return applyMdxPreset({
    remarkStructureOptions: readingStructureOptions,
    rehypeCodeOptions: metadataOnly
      ? false
      : {
          addLanguageClass: true,
          fallbackLanguage: "plaintext",
          langAlias: { excalidraw: "plaintext" },
          themes: { light: "github-light", dark: "github-dark" },
        },
    remarkPlugins: (plugins) => [
      ...(preserveSource ? [remarkReadingSource] : []),
      remarkReadingAnnotations,
      remarkKrokiUrl,
      ...plugins,
    ],
  });
}

export const blogCollection = defineCollections({
  type: "doc",
  dir: "content/tech/blog",
  files: ["**/*.mdx"],
  async: true,
  mdxOptions: techMdxOptions(),
  schema: blogSchema,
  postprocess: { extractLinkReferences: true },
});

export const docsCollection = defineDocs({
  dir: "content/tech/docs",
  docs: {
    files: ["**/*.mdx"],
    async: true,
    mdxOptions: techMdxOptions(),
    schema: docsSchema,
    postprocess: { extractLinkReferences: true },
  },
});

export const investmentCollection = defineCollections({
  type: "doc",
  dir: "content/invest",
  files: ["**/notes/*.mdx"],
  async: true,
  mdxOptions: applyMdxPreset({
    remarkStructureOptions: readingStructureOptions,
    ...(metadataOnly ? { rehypeCodeOptions: false } : {}),
    remarkPlugins: (plugins) => [remarkReadingAnnotations, ...plugins],
  }),
  schema: investmentSchema,
  postprocess: { extractLinkReferences: true },
});

// Showcase와 브라우저 테스트가 공유함. 콘텐츠 검색·RSS·사이트맵에는 연결하지 않음.
export const readingSamples = defineCollections({
  type: "doc",
  dir: "fixtures/reading",
  files: ["**/*.mdx"],
  async: true,
  mdxOptions: techMdxOptions(true),
  schema: z.object({
    title: z.string(),
    purpose: z.string(),
    caution: z.string(),
  }),
});

export default defineConfig();
