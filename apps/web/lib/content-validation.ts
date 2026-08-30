import { relative, resolve } from "node:path";
import {
  createBlogPostHref,
  locales,
  publicDocsAreas,
  type BlogPostMetadata,
  type DocMetadata,
  type DocsPageMetadata,
  type Locale,
} from "./content-model.ts";
import {
  validateInvestmentNoteBody,
  type InvestmentNoteMetadata,
} from "./invest/content.ts";

const appRoot = process.cwd().endsWith("/apps/web")
  ? process.cwd()
  : resolve(process.cwd(), "apps/web");
const workspaceRoot = resolve(appRoot, "../..");

/** locale별 overview를 제외한 canonical Docs inventory임 */
export const docsInventoryPerLocale = 22;
/** locale별 root·영역 landing을 포함한 전체 Docs 파일 수임 */
export const docsPagesPerLocale = 30;

export interface ContentEntry<Metadata> {
  readonly metadata: Metadata;
  readonly body: string;
  readonly relativePath: string;
}

export interface ValidatedContentSource<
  Metadata,
> extends ContentEntry<Metadata> {
  readonly filePath: string;
  readonly extractedReferences: readonly Readonly<{ href: string }>[];
}

const sharedLocalizedMetadataFields = [
  "status",
  "tags",
  "packageName",
  "packageVersion",
  "apiSymbols",
] as const satisfies readonly (keyof DocMetadata)[];

const blogLocalizedMetadataFields = [
  ...sharedLocalizedMetadataFields,
  "series",
  "seriesOrder",
] as const satisfies readonly (keyof BlogPostMetadata)[];

const docsLocalizedMetadataFields = [
  ...sharedLocalizedMetadataFields,
  "area",
  "documentKind",
] as const satisfies readonly (keyof DocsPageMetadata)[];

function getOrCreateLocalizedMetadata<Metadata>(
  byId: Map<string, Map<Locale, Metadata>>,
  id: string,
): Map<Locale, Metadata> {
  const existing = byId.get(id);
  if (existing !== undefined) return existing;

  const localized = new Map<Locale, Metadata>();
  byId.set(id, localized);
  return localized;
}

function containsBlockingTodo(body: string): boolean {
  const prose = body
    .replace(/```[\s\S]*?```/gu, "")
    .replace(/^>[^\n]*(?:\n|$)/gmu, "");
  return /\{\/\*\s*(?:TODO|FIXME)\b[\s\S]*?\*\/\}/u.test(prose);
}

function referencePath(href: string): string | null {
  if (!/^\/(?:ko|en)(?:\/|$)/u.test(href)) return null;
  return href.split(/[?#]/u, 1)[0] ?? null;
}

function validatePublishedBody(document: ContentEntry<DocMetadata>): void {
  if (
    document.metadata.publicationStatus === "published" &&
    containsBlockingTodo(document.body)
  ) {
    throw new Error(
      `${document.relativePath}: published document contains a blocking TODO comment.`,
    );
  }
}

/** 단일 Blog 글의 경로와 게시 가능한 본문 계약을 검증함 */
export function validateBlogPostEntry(
  post: ContentEntry<BlogPostMetadata>,
): void {
  const expectedPath = `${post.metadata.locale}/${post.metadata.id}.mdx`;
  if (post.relativePath !== expectedPath)
    throw new Error(
      `${post.relativePath}: expected path ${expectedPath} from metadata.`,
    );
  validatePublishedBody(post);
}

function expectedDocsPath(metadata: DocsPageMetadata): string {
  if (metadata.id === "docs-overview") return `${metadata.locale}/index.mdx`;
  if (metadata.area === undefined)
    throw new Error(
      `${metadata.locale}/${String(metadata.id)}: Docs area is required.`,
    );
  if (metadata.id === `${metadata.area}-overview`)
    return `${metadata.locale}/${metadata.area}/index.mdx`;
  const filename = metadata.id.endsWith("-overview")
    ? metadata.id.slice(0, -"-overview".length)
    : metadata.id;
  return `${metadata.locale}/${metadata.area}/${filename}.mdx`;
}

/** 단일 Docs 페이지의 영역·Diátaxis·경로 계약을 검증함 */
export function validateDocsPageEntry(
  page: ContentEntry<DocsPageMetadata>,
): void {
  const expectedPath = expectedDocsPath(page.metadata);
  if (page.relativePath !== expectedPath)
    throw new Error(
      `${page.relativePath}: expected path ${expectedPath} from metadata.`,
    );
  validatePublishedBody(page);
}

/** Docs 파일 상대 경로를 canonical 공개 URL로 변환함 */
export function docsHrefFromRelativePath(relativePath: string): string {
  const [locale, ...segments] = relativePath.replace(/\.mdx$/u, "").split("/");
  if (locale === undefined || !locales.includes(locale as Locale))
    throw new Error(`Invalid localized docs path: ${relativePath}`);
  if (segments.at(-1) === "index") segments.pop();
  return `/${locale}/docs${segments.length === 0 ? "" : `/${segments.join("/")}`}`;
}

function validateLocalizedPairs<Metadata extends DocMetadata>(
  label: string,
  documents: readonly ValidatedContentSource<Metadata>[],
  fields: readonly (keyof Metadata)[],
): void {
  const byId = new Map<string, Map<Locale, Metadata>>();
  for (const document of documents) {
    const localized = getOrCreateLocalizedMetadata(byId, document.metadata.id);
    if (localized.has(document.metadata.locale))
      throw new Error(
        `Duplicate ${label} ID: ${document.metadata.locale}/${document.metadata.id}`,
      );
    localized.set(document.metadata.locale, document.metadata);
  }

  for (const [id, localized] of byId) {
    const missing = locales.filter((locale) => !localized.has(locale));
    if (missing.length > 0)
      throw new Error(
        `${label} ${id} is missing locales: ${missing.join(", ")}`,
      );

    const reference = localized.get(locales[0]);
    if (reference === undefined)
      throw new Error(`${label} ${id} has no reference locale.`);
    for (const locale of locales.slice(1)) {
      const candidate = localized.get(locale);
      if (candidate === undefined) continue;
      for (const field of fields) {
        if (
          JSON.stringify(reference[field]) !== JSON.stringify(candidate[field])
        ) {
          throw new Error(
            `${label} ${id} has inconsistent "${String(field)}" across locales.`,
          );
        }
      }
    }
  }
}

function validateSeriesOrders(
  documents: readonly ValidatedContentSource<BlogPostMetadata>[],
): void {
  const seriesOrders = new Set<string>();
  for (const { metadata } of documents) {
    if (metadata.series === undefined || metadata.seriesOrder === undefined)
      continue;
    const orderKey = `${metadata.locale}:${metadata.series}:${metadata.seriesOrder}`;
    if (seriesOrders.has(orderKey))
      throw new Error(`Duplicate series order: ${orderKey}`);
    seriesOrders.add(orderKey);
  }
}

function validateInternalLinks(
  documents: readonly ValidatedContentSource<DocMetadata>[],
  knownPaths: ReadonlySet<string>,
): void {
  for (const document of documents) {
    for (const reference of document.extractedReferences) {
      const href = referencePath(reference.href);
      if (href !== null && !knownPaths.has(href))
        throw new Error(
          `${relative(workspaceRoot, document.filePath)}: broken internal link ${href}`,
        );
    }
  }
}

/** Blog collection의 개수·번역·canonical 계약을 검증함 */
export function validateBlogPosts(
  posts: readonly ValidatedContentSource<BlogPostMetadata>[],
): void {
  for (const post of posts) validateBlogPostEntry(post);
  validateLocalizedPairs("Blog post", posts, blogLocalizedMetadataFields);
  validateSeriesOrders(posts);
}

/** Docs collection의 개수·영역·번역·canonical 계약을 검증함 */
export function validateDocsPages(
  pages: readonly ValidatedContentSource<DocsPageMetadata>[],
  enforceInventory = false,
): void {
  for (const page of pages) validateDocsPageEntry(page);
  validateLocalizedPairs("Docs page", pages, docsLocalizedMetadataFields);

  if (!enforceInventory) return;
  for (const locale of locales) {
    const localized = pages.filter(
      ({ metadata }) => metadata.locale === locale,
    );
    if (localized.length !== docsPagesPerLocale)
      throw new Error(
        `Docs ${locale} must contain ${String(docsPagesPerLocale)} pages; found ${localized.length}.`,
      );
    const migrated = localized.filter(
      ({ metadata }) => !metadata.id.endsWith("-overview"),
    );
    if (migrated.length !== docsInventoryPerLocale)
      throw new Error(
        `Docs ${locale} must contain ${String(docsInventoryPerLocale)} migrated pages; found ${migrated.length}.`,
      );
    for (const area of publicDocsAreas) {
      if (!localized.some(({ metadata }) => metadata.area === area))
        throw new Error(`Docs ${locale} is missing area ${area}.`);
    }
    if (localized.some(({ metadata }) => metadata.area === "ansible"))
      throw new Error(
        `Docs ${locale} must keep Ansible private until content exists.`,
      );
  }
}

/** Blog와 Docs를 합친 ID·canonical·내부 링크 계약을 검증함 */
export function validateTechContent(
  posts: readonly ValidatedContentSource<BlogPostMetadata>[],
  pages: readonly ValidatedContentSource<DocsPageMetadata>[],
  options: Readonly<{ enforceInventory?: boolean }> = {},
): void {
  validateBlogPosts(posts);
  validateDocsPages(pages, options.enforceInventory);

  if (options.enforceInventory === true) {
    for (const locale of locales) {
      const count = posts.filter(
        ({ metadata }) => metadata.locale === locale,
      ).length;
      if (count !== 25)
        throw new Error(
          `Blog ${locale} must contain 25 posts; found ${count}.`,
        );
    }
  }

  const blogIds = new Set(posts.map(({ metadata }) => metadata.id));
  const duplicateId = pages.find(({ metadata }) => blogIds.has(metadata.id));
  if (duplicateId !== undefined)
    throw new Error(`Duplicate Blog/Docs ID: ${duplicateId.metadata.id}`);

  const blogPaths = posts.map(({ metadata }) =>
    createBlogPostHref(metadata.locale, metadata.id),
  );
  const docsPaths = pages.map(({ relativePath }) =>
    docsHrefFromRelativePath(relativePath),
  );
  const knownPaths = new Set([...blogPaths, ...docsPaths]);
  if (knownPaths.size !== blogPaths.length + docsPaths.length)
    throw new Error("Blog and Docs canonical URL sets overlap.");
  validateInternalLinks([...posts, ...pages], knownPaths);
}

/** 단일 투자 노트의 경로와 필수 본문 계약을 검증함 */
export function validateInvestmentNoteEntry(
  note: ContentEntry<InvestmentNoteMetadata>,
  validateBody = true,
): void {
  const expectedPath = `${note.metadata.locale}/notes/${note.metadata.id}.mdx`;
  if (note.relativePath !== expectedPath)
    throw new Error(`${note.relativePath}: expected ${expectedPath}.`);
  if (validateBody) validateInvestmentNoteBody(note.body, note.relativePath);
}

/** 투자 노트의 경로·필수 섹션·번역 완전성 계약을 검증함 */
export function validateInvestmentNotes(
  notes: readonly ValidatedContentSource<InvestmentNoteMetadata>[],
  validateBodies = true,
): void {
  const byId = new Map<string, Map<Locale, InvestmentNoteMetadata>>();
  for (const note of notes) {
    validateInvestmentNoteEntry(note, validateBodies);
    const localized = getOrCreateLocalizedMetadata(byId, note.metadata.id);
    if (localized.has(note.metadata.locale))
      throw new Error(
        `Duplicate investment note ${note.metadata.locale}/${note.metadata.id}.`,
      );
    localized.set(note.metadata.locale, note.metadata);
  }

  for (const [id, localized] of byId) {
    const missing = locales.filter((locale) => !localized.has(locale));
    if (missing.length > 0)
      throw new Error(
        `Investment note ${id} is missing locales: ${missing.join(", ")}.`,
      );
    const reference = localized.get("ko");
    const translation = localized.get("en");
    if (
      reference?.publishedAt !== translation?.publishedAt ||
      reference?.status !== translation?.status ||
      JSON.stringify(reference?.tags) !== JSON.stringify(translation?.tags) ||
      reference?.series !== translation?.series ||
      reference?.image !== translation?.image
    ) {
      throw new Error(
        `Investment note ${id} has inconsistent shared metadata.`,
      );
    }
  }
}
