import {
  createDocsPageHref,
  displayTitleFor,
  docsAreas,
  documentKinds,
  type ContentManifestEntry,
  type DocumentKind,
  type DocsArea,
  type DocsPageManifestEntry,
  type Locale,
} from "../content-model.ts";

export const registeredDocsCategoryIds = docsAreas;
export const docsCategoryIds = ["fe", "be", "k8s"] as const;
export type DocsCategoryId = DocsArea;

const docsCategoryRegistry = {
  fe: {
    label: "FE",
    title: { ko: "프론트엔드", en: "Frontend" },
    description: {
      ko: "유지보수 가능한 UI, 테스트, 프레임워크 계약을 목적별로 탐색하는 문서",
      en: "Purpose-oriented guidance for maintainable UI, testing, and framework contracts.",
    },
  },
  be: {
    label: "BE",
    title: { ko: "백엔드", en: "Backend" },
    description: {
      ko: "도메인 경계, 분산 실패 처리, 시스템 아키텍처와 협업을 연결하는 문서",
      en: "Documentation connecting domain boundaries, distributed failure handling, system architecture, and collaboration.",
    },
  },
  k8s: {
    label: "K8s",
    title: { ko: "Kubernetes", en: "Kubernetes" },
    description: {
      ko: "Cilium Gateway API와 Kubernetes 네트워크 운영을 위한 문서",
      en: "Documentation for Cilium Gateway API and Kubernetes network operations.",
    },
  },
  ansible: {
    label: "Ansible",
    title: { ko: "Ansible", en: "Ansible" },
    description: {
      ko: "자동화 문서가 추가되면 공개되는 Ansible 영역",
      en: "An Ansible area that becomes public when automation documents are added.",
    },
  },
} as const;

export interface LocalizedDocsCategory {
  readonly id: DocsCategoryId;
  readonly label: string;
  readonly title: string;
  readonly description: string;
}

export interface DocsDocumentGroup {
  readonly id: string;
  readonly label: string;
  readonly documents: readonly DocsPageManifestEntry[];
}

type CategorizedDocsPage = DocsPageManifestEntry &
  Readonly<{ area: DocsCategoryId; documentKind: DocumentKind }>;

/** 등록된 문서 영역 식별자를 판별함 */
export function isDocsCategoryId(value: string): value is DocsCategoryId {
  return registeredDocsCategoryIds.includes(value as DocsCategoryId);
}

/** 지역화된 문서 영역 정보를 반환함 */
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

/** Docs root·영역·본문 canonical 경로를 생성함 */
export function createDocsHref(
  locale: Locale,
  category?: DocsCategoryId,
  documentId?: string,
): string {
  return createDocsPageHref(locale, category, documentId);
}

/** 지정 영역의 공개 Docs 페이지만 반환함 */
export function documentsForDocsCategory(
  documents: readonly ContentManifestEntry[],
  categoryId: DocsCategoryId,
): readonly CategorizedDocsPage[] {
  return documents
    .filter(
      (document): document is CategorizedDocsPage =>
        document.contentType === "docs" &&
        document.area === categoryId &&
        document.documentKind !== undefined,
    )
    .toSorted(
      (left, right) =>
        documentKinds.indexOf(left.documentKind) -
          documentKinds.indexOf(right.documentKind) ||
        displayTitleFor(left).localeCompare(displayTitleFor(right)),
    );
}

/** 영역 문서를 Diátaxis 유형 순서의 sidebar 그룹으로 묶음 */
export function groupDocsDocuments(
  documents: readonly ContentManifestEntry[],
  categoryId: DocsCategoryId,
  locale: Locale,
): readonly DocsDocumentGroup[] {
  const labels = {
    tutorial: { ko: "Tutorial · 학습", en: "Tutorial" },
    "how-to": { ko: "How-to · 작업", en: "How-to" },
    reference: { ko: "Reference · 조회", en: "Reference" },
    explanation: { ko: "Explanation · 이해", en: "Explanation" },
  } as const;
  const pages = documentsForDocsCategory(documents, categoryId);
  return documentKinds.map((kind) => ({
    id: kind,
    label: labels[kind][locale],
    documents: pages.filter((page) => page.documentKind === kind),
  }));
}
