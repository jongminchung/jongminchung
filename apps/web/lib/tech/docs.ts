import {
  displayTitleFor,
  type ContentManifestEntry,
  type Locale,
} from "../content-model.ts";
import { getSeries } from "./series.ts";

export const docsCategoryIds = ["fe", "k8s"] as const;
export type DocsCategoryId = (typeof docsCategoryIds)[number];

interface DocsCategoryDefinition {
  readonly label: string;
  readonly title: Readonly<Record<Locale, string>>;
  readonly description: Readonly<Record<Locale, string>>;
  readonly matches: (document: ContentManifestEntry) => boolean;
  readonly section: (document: ContentManifestEntry) => string;
  readonly sectionLabels: Readonly<
    Record<string, Readonly<Record<Locale, string>>>
  >;
}

const hasTag =
  (...tags: readonly string[]) =>
  (document: ContentManifestEntry): boolean =>
    tags.some((tag) => document.tags.includes(tag));

export const docsCategoryRegistry: Readonly<
  Record<DocsCategoryId, DocsCategoryDefinition>
> = {
  fe: {
    label: "FE",
    title: { ko: "프론트엔드", en: "Frontend" },
    description: {
      ko: "React 컴포넌트, 디자인 시스템, 브라우저 성능과 유지보수 경계를 실무 관점에서 설명함",
      en: "Practical guidance for React components, design systems, browser performance, and maintainability boundaries.",
    },
    matches: hasTag("frontend"),
    section: (document) => {
      if (document.series === "frontend-maintainability")
        return "maintainability";
      if (hasTag("react", "components", "design-system")(document))
        return "components";
      return "performance";
    },
    sectionLabels: {
      maintainability: {
        ko: "Tailwind와 shadcn/ui 유지보수",
        en: "Tailwind and shadcn/ui Maintainability",
      },
      components: {
        ko: "React와 UI 아키텍처",
        en: "React and UI Architecture",
      },
      performance: {
        ko: "성능과 인터랙션",
        en: "Performance and Interaction",
      },
    },
  },
  k8s: {
    label: "K8s",
    title: { ko: "Kubernetes", en: "Kubernetes" },
    description: {
      ko: "Kubernetes 네트워킹, Cilium Gateway API와 분산 제어 루프의 설계·운영 기준을 정리함",
      en: "Design and operational guidance for Kubernetes networking, Cilium Gateway API, and distributed control loops.",
    },
    matches: hasTag("kubernetes", "cilium"),
    section: (document) =>
      document.series === "cilium-gateway-api" ? "cilium" : "operations",
    sectionLabels: {
      cilium: {
        ko: "Cilium Gateway API",
        en: "Cilium Gateway API",
      },
      operations: {
        ko: "운영과 신뢰성",
        en: "Operations and Reliability",
      },
    },
  },
};

export interface LocalizedDocsCategory {
  readonly id: DocsCategoryId;
  readonly label: string;
  readonly title: string;
  readonly description: string;
}

export interface DocsDocumentGroup {
  readonly id: string;
  readonly label: string;
  readonly documents: readonly ContentManifestEntry[];
}

/** `isDocsCategoryId` 등록된 문서 카테고리 식별자를 판별함 */
export function isDocsCategoryId(value: string): value is DocsCategoryId {
  return docsCategoryIds.includes(value as DocsCategoryId);
}

/** `getDocsCategory` 지역화된 문서 카테고리 정보를 반환함 */
export function getDocsCategory(
  id: DocsCategoryId,
  locale: Locale,
): LocalizedDocsCategory {
  const category = docsCategoryRegistry[id];
  return Object.freeze({
    id,
    label: category.label,
    title: category.title[locale],
    description: category.description[locale],
  });
}

/** `createDocsHref` 문서 허브와 카테고리·본문 경로를 생성함 */
export function createDocsHref(
  locale: Locale,
  category?: DocsCategoryId,
  documentId?: string,
): string {
  if (category === undefined) return `/${locale}/docs`;
  if (documentId === undefined) return `/${locale}/docs/${category}`;
  return `/${locale}/docs/${category}/${documentId}`;
}

function compareDocs(
  left: ContentManifestEntry,
  right: ContentManifestEntry,
): number {
  const leftSeries = left.series ?? "";
  const rightSeries = right.series ?? "";
  return (
    leftSeries.localeCompare(rightSeries) ||
    (left.seriesOrder ?? Number.POSITIVE_INFINITY) -
      (right.seriesOrder ?? Number.POSITIVE_INFINITY) ||
    displayTitleFor(left).localeCompare(displayTitleFor(right))
  );
}

/** `documentsForDocsCategory` 카테고리에 포함되는 공개 문서를 반환함 */
export function documentsForDocsCategory(
  documents: readonly ContentManifestEntry[],
  categoryId: DocsCategoryId,
): readonly ContentManifestEntry[] {
  return documents
    .filter(docsCategoryRegistry[categoryId].matches)
    .toSorted(compareDocs);
}

/** `groupDocsDocuments` 카테고리 문서를 좌측 탐색 섹션으로 묶음 */
export function groupDocsDocuments(
  documents: readonly ContentManifestEntry[],
  categoryId: DocsCategoryId,
  locale: Locale,
): readonly DocsDocumentGroup[] {
  const definition = docsCategoryRegistry[categoryId];
  const grouped = new Map<string, ContentManifestEntry[]>();
  for (const document of documentsForDocsCategory(documents, categoryId)) {
    const section = definition.section(document);
    const entries = grouped.get(section) ?? [];
    entries.push(document);
    grouped.set(section, entries);
  }
  return [...grouped].map(([id, entries]) => ({
    id,
    label: definition.sectionLabels[id]?.[locale] ?? id,
    documents: Object.freeze(entries),
  }));
}

/** `docsSeriesLabel` 문서가 속한 시리즈 이름을 지역화함 */
export function docsSeriesLabel(
  document: ContentManifestEntry,
  locale: Locale,
): string | undefined {
  return document.series === undefined
    ? undefined
    : getSeries(document.series, locale)?.title;
}
