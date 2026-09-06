import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import { investmentCollection } from "../../.source/server.ts";
import "server-only";
import type { Locale } from "../content-contracts.ts";
import { contentI18n } from "../content-i18n.ts";
import type { ValidatedContentSource } from "../content-validation.ts";
import { validateInvestmentNotes } from "../content-validation.ts";
import {
  createInvestmentNoteHref,
  investmentNoteMetadataSchema,
  type InvestmentNoteManifestEntry,
  type InvestmentNoteMetadata,
} from "./content.ts";

export interface InvestmentNoteSourceInput {
  readonly metadata: unknown;
  readonly body: string;
  readonly filePath: string;
  readonly relativePath: string;
  readonly extractedReferences?: readonly Readonly<{ href: string }>[];
}

function relativePath(path: string): string {
  return path.replace(/^[/\\]+/u, "").replaceAll("\\", "/");
}

/** 검증된 Investment source를 공개 manifest collection으로 변환함 */
export function createInvestmentNoteCollection(
  inputs: readonly InvestmentNoteSourceInput[],
  validateBodies = true,
): readonly InvestmentNoteManifestEntry[] {
  const sources = inputs.map((input) => {
    const metadata = investmentNoteMetadataSchema.parse(input.metadata);
    return {
      metadata,
      body: input.body,
      filePath: input.filePath,
      relativePath: relativePath(input.relativePath),
      extractedReferences: input.extractedReferences ?? [],
    } satisfies ValidatedContentSource<InvestmentNoteMetadata>;
  });

  validateInvestmentNotes(sources, validateBodies);
  return Object.freeze(
    sources
      .map(({ metadata }) =>
        Object.freeze({
          ...metadata,
          href: createInvestmentNoteHref(metadata.locale, metadata.id),
        } satisfies InvestmentNoteManifestEntry),
      )
      .toSorted(
        (left, right) =>
          left.locale.localeCompare(right.locale) ||
          right.publishedAt.localeCompare(left.publishedAt) ||
          left.id.localeCompare(right.id),
      ),
  );
}

/** Fumadocs가 읽은 Investment source를 검증된 manifest로 변환함 */
export function readInvestmentNoteCollection(): readonly InvestmentNoteManifestEntry[] {
  return createInvestmentNoteCollection(
    investmentSource.getPages().map((page) => ({
      metadata: {
        id: page.data.id,
        locale: page.data.locale,
        title: page.data.title,
        description: page.data.description,
        publishedAt: page.data.publishedAt,
        updatedAt: page.data.updatedAt,
        status: page.data.status,
        tags: page.data.tags,
        series: page.data.series,
        image: page.data.image,
        imageAlt: page.data.imageAlt,
        sources: page.data.sources,
      },
      body: "",
      filePath: page.data.info.fullPath,
      relativePath: page.data.info.path,
      extractedReferences: [],
    })),
    false,
  );
}

/** Fumadocs가 색인한 투자 노트 본문을 locale과 공개 ID로 조회함 */
export async function loadInvestmentContent(locale: Locale, id: string) {
  return (
    (await investmentSource.getPage(["notes", id], locale)?.data.load()) ?? null
  );
}

let productionNotes: readonly InvestmentNoteManifestEntry[] | undefined;

/** Invest 메타데이터만 검증하고 production에서 재사용함. 개발 중에는 콘텐츠 변경을 반영함. */
export function readInvestmentNotes(): readonly InvestmentNoteManifestEntry[] {
  if (process.env.NODE_ENV === "development")
    return readInvestmentNoteCollection();
  productionNotes ??= readInvestmentNoteCollection();
  return productionNotes;
}

const investmentSource = loader({
  baseUrl: "/",
  source: toFumadocsSource(investmentCollection, []),
  i18n: contentI18n,
  url: (slugs, locale) => `/${locale ?? "en"}/notes/${slugs.at(-1) ?? ""}`,
});
