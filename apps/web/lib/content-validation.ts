import { relative, resolve } from "node:path";
import {
  createDocHref,
  locales,
  type DocMetadata,
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

const localizedMetadataFields = [
  "documentKind",
  "series",
  "seriesOrder",
  "status",
  "tags",
  "packageName",
  "packageVersion",
  "apiSymbols",
] as const satisfies readonly (keyof DocMetadata)[];

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
  if (!/^\/(?:ko|en)\//u.test(href)) return null;
  return href.split(/[?#]/u, 1)[0] ?? null;
}

/** 단일 기술 문서의 경로와 게시 가능한 본문 계약을 검증함 */
export function validateDocumentEntry(
  document: ContentEntry<DocMetadata>,
): void {
  const expectedPath = `${document.metadata.locale}/${document.metadata.id}.mdx`;
  if (document.relativePath !== expectedPath)
    throw new Error(
      `${document.relativePath}: expected path ${expectedPath} from metadata.`,
    );
  if (
    document.metadata.publicationStatus === "published" &&
    containsBlockingTodo(document.body)
  ) {
    throw new Error(
      `${document.relativePath}: published document contains a blocking TODO comment.`,
    );
  }
  if (
    document.metadata.series === "frontend-maintainability" &&
    document.metadata.documentKind === undefined
  ) {
    throw new Error(
      `${document.relativePath}: frontend-maintainability documents require documentKind.`,
    );
  }
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

/** 정규화된 기술 문서 집합의 locale·navigation·link 계약을 검증함 */
export function validateDocuments(
  documents: readonly ValidatedContentSource<DocMetadata>[],
): void {
  const byId = new Map<string, Map<Locale, DocMetadata>>();
  const hrefs = new Set<string>();
  const seriesOrders = new Set<string>();

  for (const document of documents) {
    validateDocumentEntry(document);
    const { metadata } = document;
    const href = createDocHref(metadata.locale, metadata.id);
    if (hrefs.has(href)) throw new Error(`Duplicate document URL: ${href}`);
    hrefs.add(href);

    if (metadata.series !== undefined && metadata.seriesOrder !== undefined) {
      const orderKey = `${metadata.locale}:${metadata.series}:${metadata.seriesOrder}`;
      if (seriesOrders.has(orderKey))
        throw new Error(`Duplicate series order: ${orderKey}`);
      seriesOrders.add(orderKey);
    }

    const localized = getOrCreateLocalizedMetadata(byId, metadata.id);
    if (localized.has(metadata.locale))
      throw new Error(`Duplicate document URL: ${href}`);
    localized.set(metadata.locale, metadata);
  }

  for (const [id, localized] of byId) {
    const missing = locales.filter((locale) => !localized.has(locale));
    if (missing.length > 0)
      throw new Error(
        `Document ${id} is missing locales: ${missing.join(", ")}`,
      );

    const reference = localized.get(locales[0]);
    if (reference === undefined)
      throw new Error(`Document ${id} has no reference locale.`);
    for (const locale of locales.slice(1)) {
      const candidate = localized.get(locale);
      if (candidate === undefined) continue;
      for (const field of localizedMetadataFields) {
        if (
          JSON.stringify(reference[field]) !== JSON.stringify(candidate[field])
        ) {
          throw new Error(
            `Document ${id} has inconsistent "${field}" across locales.`,
          );
        }
      }
    }
  }

  const knownPaths = new Set(
    documents.map(({ metadata }) =>
      createDocHref(metadata.locale, metadata.id),
    ),
  );
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
      reference?.series !== translation?.series
    ) {
      throw new Error(
        `Investment note ${id} has inconsistent shared metadata.`,
      );
    }
  }
}
