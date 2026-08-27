import {
  compareDocumentMetadata,
  createDocHref,
  docMetadataSchema,
  type ContentManifestEntry,
  type DocMetadata,
  type Locale,
} from "./content-model.ts";
import {
  validateDocuments,
  validateInvestmentNotes,
  type ValidatedContentSource,
} from "./content-validation.ts";
import { investmentSource, techSource } from "./fumadocs-source.ts";
import {
  createInvestmentNoteHref,
  investmentNoteMetadataSchema,
  type InvestmentNoteManifestEntry,
  type InvestmentNoteMetadata,
  type InvestmentSourceKind,
} from "./invest/content.ts";

export interface ContentSnapshot {
  readonly documents: readonly ContentManifestEntry[];
  readonly investmentNotes: readonly InvestmentNoteManifestEntry[];
}

let productionSnapshot: ContentSnapshot | undefined;

function relativePath(path: string): string {
  return path.replace(/^[/\\]+/u, "").replaceAll("\\", "/");
}

function techMetadata(value: DocMetadata): DocMetadata {
  return docMetadataSchema.parse({
    id: value.id,
    locale: value.locale,
    documentKind: value.documentKind,
    series: value.series,
    seriesOrder: value.seriesOrder,
    title: value.title,
    displayTitle: value.displayTitle,
    description: value.description,
    publishedAt: value.publishedAt,
    updatedAt: value.updatedAt,
    verifiedAt: value.verifiedAt,
    tags: value.tags,
    status: value.status,
    publicationStatus: value.publicationStatus,
    sourceUrl: value.sourceUrl,
    packageName: value.packageName,
    packageVersion: value.packageVersion,
    apiSymbols: value.apiSymbols,
  });
}

function investmentMetadata(
  value: InvestmentNoteMetadata,
): InvestmentNoteMetadata {
  return investmentNoteMetadataSchema.parse({
    id: value.id,
    locale: value.locale,
    title: value.title,
    description: value.description,
    publishedAt: value.publishedAt,
    updatedAt: value.updatedAt,
    status: value.status,
    tags: value.tags,
    series: value.series,
    sources: value.sources,
  });
}

function loadTechDocuments(): readonly ContentManifestEntry[] {
  const loaded = techSource.getPages().map((page) => {
    const metadata = techMetadata(page.data);
    const manifest = Object.freeze({
      ...metadata,
      href: createDocHref(metadata.locale, metadata.id),
    } satisfies ContentManifestEntry);
    const validationSource: ValidatedContentSource<DocMetadata> = {
      metadata,
      body: "",
      filePath: page.data.info.fullPath,
      relativePath: relativePath(page.data.info.path),
      extractedReferences: [],
    };
    return { manifest, validationSource };
  });

  validateDocuments(loaded.map(({ validationSource }) => validationSource));
  return Object.freeze(
    loaded.map(({ manifest }) => manifest).sort(compareDocumentMetadata),
  );
}

function loadInvestmentNotes(): readonly InvestmentNoteManifestEntry[] {
  const loaded = investmentSource.getPages().map((page) => {
    const metadata = investmentMetadata(page.data);
    const manifest = Object.freeze({
      ...metadata,
      href: createInvestmentNoteHref(metadata.locale, metadata.id),
    } satisfies InvestmentNoteManifestEntry);
    const validationSource: ValidatedContentSource<InvestmentNoteMetadata> = {
      metadata,
      body: "",
      filePath: page.data.info.fullPath,
      relativePath: relativePath(page.data.info.path),
      extractedReferences: [],
    };
    return { manifest, validationSource };
  });

  validateInvestmentNotes(
    loaded.map(({ validationSource }) => validationSource),
    false,
  );
  return Object.freeze(
    loaded
      .map(({ manifest }) => manifest)
      .toSorted(
        (left, right) =>
          left.locale.localeCompare(right.locale) ||
          right.publishedAt.localeCompare(left.publishedAt) ||
          left.id.localeCompare(right.id),
      ),
  );
}

function createContentSnapshot(): ContentSnapshot {
  return Object.freeze({
    documents: loadTechDocuments(),
    investmentNotes: loadInvestmentNotes(),
  });
}

/** Fumadocs 컬렉션을 검증된 제품 도메인 스냅샷으로 변환함 */
export function readContentSnapshot(): ContentSnapshot {
  if (process.env.NODE_ENV === "development") return createContentSnapshot();
  productionSnapshot ??= createContentSnapshot();
  return productionSnapshot;
}

/** Fumadocs가 색인한 기술 문서 본문을 locale과 공개 ID로 조회함 */
export async function loadTechContent(locale: Locale, id: string) {
  return (await techSource.getPage([id], locale)?.data.load()) ?? null;
}

/** Fumadocs가 색인한 투자 노트 본문을 locale과 공개 ID로 조회함 */
export async function loadInvestmentContent(locale: Locale, id: string) {
  return (
    (await investmentSource.getPage(["notes", id], locale)?.data.load()) ?? null
  );
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
