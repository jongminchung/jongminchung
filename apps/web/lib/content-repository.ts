import {
  blogPostMetadataSchema,
  compareDocumentMetadata,
  createBlogPostHref,
  docsPageMetadataSchema,
  type BlogPostManifestEntry,
  type BlogPostMetadata,
  type ContentManifestEntry,
  type DocsPageManifestEntry,
  type DocsPageMetadata,
  type Locale,
} from "./content-model.ts";
import {
  validateTechContent,
  type ValidatedContentSource,
} from "./content-validation.ts";
import { blogSource, docsSource } from "./fumadocs-source.ts";
import {
  type InvestmentNoteManifestEntry,
  type InvestmentSourceKind,
} from "./invest/content.ts";
import { readInvestmentNoteCollection } from "./invest/source.ts";
import { publishedContentOnly } from "./tech/publication.ts";

export interface TechContentCollection {
  readonly blogPosts: readonly BlogPostManifestEntry[];
  readonly docsPages: readonly DocsPageManifestEntry[];
  readonly documents: readonly ContentManifestEntry[];
}

export interface ContentSnapshot {
  readonly sourceTech: TechContentCollection;
  readonly publishedTech: TechContentCollection;
  readonly investmentNotes: readonly InvestmentNoteManifestEntry[];
}

let productionSnapshot: ContentSnapshot | undefined;

function relativePath(path: string): string {
  return path.replace(/^[/\\]+/u, "").replaceAll("\\", "/");
}

function sharedMetadata(value: BlogPostMetadata | DocsPageMetadata) {
  return {
    id: value.id,
    locale: value.locale,
    title: value.title,
    displayTitle: value.displayTitle,
    description: value.description,
    publishedAt: value.publishedAt,
    updatedAt: value.updatedAt,
    tags: value.tags,
    status: value.status,
    publicationStatus: value.publicationStatus,
    sourceUrl: value.sourceUrl,
    packageName: value.packageName,
    packageVersion: value.packageVersion,
    apiSymbols: value.apiSymbols,
  };
}

function blogMetadata(value: BlogPostMetadata): BlogPostMetadata {
  return blogPostMetadataSchema.parse({
    ...sharedMetadata(value),
    thesis: value.thesis,
    counterargument: value.counterargument,
    series: value.series,
    seriesOrder: value.seriesOrder,
    verifiedAt: value.verifiedAt,
  });
}

function docsMetadata(value: DocsPageMetadata): DocsPageMetadata {
  return docsPageMetadataSchema.parse({
    ...sharedMetadata(value),
    area: value.area,
    documentKind: value.documentKind,
    verifiedAt: value.verifiedAt,
  });
}

function loadBlogPosts() {
  return blogSource.getPages().map((page) => {
    const metadata = blogMetadata(page.data);
    const manifest = Object.freeze({
      ...metadata,
      contentType: "blog",
      href: createBlogPostHref(metadata.locale, metadata.id),
    } satisfies BlogPostManifestEntry);
    const validationSource: ValidatedContentSource<BlogPostMetadata> = {
      metadata,
      body: "",
      filePath: page.data.info.fullPath,
      relativePath: relativePath(page.data.info.path),
      extractedReferences: [],
    };
    return { manifest, validationSource };
  });
}

function loadDocsPages() {
  return docsSource.getPages().map((page) => {
    const metadata = docsMetadata(page.data);
    const manifest = Object.freeze({
      ...metadata,
      contentType: "docs",
      href: page.url,
      slugs: Object.freeze([...page.slugs]),
    } satisfies DocsPageManifestEntry);
    const validationSource: ValidatedContentSource<DocsPageMetadata> = {
      metadata,
      body: "",
      filePath: page.data.info.fullPath,
      relativePath: relativePath(page.data.info.path),
      extractedReferences: [],
    };
    return { manifest, validationSource };
  });
}

function createContentSnapshot(): ContentSnapshot {
  const blog = loadBlogPosts();
  const docs = loadDocsPages();
  validateTechContent(
    blog.map(({ validationSource }) => validationSource),
    docs.map(({ validationSource }) => validationSource),
    { enforceInventory: true },
  );
  const blogPosts = Object.freeze(
    blog.map(({ manifest }) => manifest).sort(compareDocumentMetadata),
  );
  const docsPages = Object.freeze(
    docs.map(({ manifest }) => manifest).sort(compareDocumentMetadata),
  );
  const sourceTech = Object.freeze({
    blogPosts,
    docsPages,
    documents: Object.freeze([...blogPosts, ...docsPages]),
  } satisfies TechContentCollection);
  const publishedBlogPosts = publishedContentOnly(blogPosts);
  const publishedDocsPages = publishedContentOnly(docsPages);
  const publishedTech = Object.freeze({
    blogPosts: publishedBlogPosts,
    docsPages: publishedDocsPages,
    documents: Object.freeze([...publishedBlogPosts, ...publishedDocsPages]),
  } satisfies TechContentCollection);
  return Object.freeze({
    sourceTech,
    publishedTech,
    investmentNotes: readInvestmentNoteCollection(),
  });
}

/** Fumadocs 컬렉션을 검증된 제품 도메인 스냅샷으로 변환함 */
export function readContentSnapshot(): ContentSnapshot {
  if (process.env.NODE_ENV === "development") return createContentSnapshot();
  productionSnapshot ??= createContentSnapshot();
  return productionSnapshot;
}

/** Fumadocs가 색인한 Blog 본문을 locale과 공개 ID로 조회함 */
export async function loadBlogContent(locale: Locale, id: string) {
  return (await blogSource.getPage([id], locale)?.data.load()) ?? null;
}

/** Fumadocs가 색인한 Docs 본문을 locale과 slugs로 조회함 */
export async function loadDocsContent(locale: Locale, slugs: string[]) {
  return (await docsSource.getPage(slugs, locale)?.data.load()) ?? null;
}

/** 게시된 투자 노트를 반환함 */
export function publishedInvestmentNotes(
  notes: readonly InvestmentNoteManifestEntry[],
  locale: Locale,
): readonly InvestmentNoteManifestEntry[] {
  return notes.filter(
    (note) => note.locale === locale && note.status === "published",
  );
}

/** source 종류에 맞는 투자 노트를 반환함 */
export function notesBySource(
  notes: readonly InvestmentNoteManifestEntry[],
  locale: Locale,
  kind: InvestmentSourceKind,
): readonly InvestmentNoteManifestEntry[] {
  return publishedInvestmentNotes(notes, locale).filter((note) =>
    note.sources.some((source) => source.kind === kind),
  );
}
