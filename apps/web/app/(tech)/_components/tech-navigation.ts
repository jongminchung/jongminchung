// @ts-nocheck
import {
  createDocHref,
  createSectionHref,
  displayTitleFor,
  type CurrentNavigationEntry,
  type DocSection,
  type Locale,
  type NavigationEntry,
} from "#lib/content-model";

export interface NavigationItem {
  readonly href: string;
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
}

export const techNavigationCopy = {
  ko: {
    allDocumentation: "전체 문서",
    backToAll: "전체 문서로 돌아가기",
    documentation: "문서",
    documentationSections: "문서 섹션",
    inSection: "이 섹션에서",
    onThisPage: "이 페이지에서",
    openNavigation: "탐색 열기",
    tabletMenu: "현재 섹션 메뉴",
    tabletSection: "현재 섹션",
    closeTabletMenu: "현재 섹션 메뉴 닫기",
    closeMobileNavigation: "모바일 문서 탐색 닫기",
    mobileNavigation: "모바일 문서 탐색",
  },
  en: {
    allDocumentation: "All documentation",
    backToAll: "Back to all documentation",
    documentation: "Documentation",
    documentationSections: "Documentation sections",
    inSection: "In this section",
    onThisPage: "On this page",
    openNavigation: "Open navigation",
    tabletMenu: "Current section menu",
    tabletSection: "Current section",
    closeTabletMenu: "Close current section menu",
    closeMobileNavigation: "Close mobile documentation navigation",
    mobileNavigation: "Mobile documentation navigation",
  },
} as const;

/** `otherLocale` UI 컴포넌트를 렌더링함 */
export function otherLocale(locale: Locale): Locale {
  return locale === "ko" ? "en" : "ko";
}

/** `localizedNavigationHref` UI 컴포넌트를 렌더링함 */
export function localizedNavigationHref(
  locale: Locale,
  current: CurrentNavigationEntry,
): string {
  return current.kind === "section"
    ? createSectionHref(locale, current.section)
    : createDocHref(locale, current.id);
}

/** `sectionNavigationItems` UI 컴포넌트를 렌더링함 */
export function sectionNavigationItems(
  current: CurrentNavigationEntry,
  documents: readonly NavigationEntry[],
): readonly NavigationItem[] {
  const sectionDocuments = documents.filter(
    (document) => document.section === current.section,
  );
  if (current.kind === "document" && sectionDocuments.length === 1) {
    return current.outline
      .filter((item) => item.level === 2)
      .map((item) => ({
        id: item.id,
        href: `#${item.id}`,
        label: item.label,
        selected: false,
      }));
  }
  return sectionDocuments.map((document) => ({
    id: document.id,
    href: document.href,
    label: displayTitleFor(document),
    selected: document.id === current.id,
  }));
}

/** `documentsForSection` UI 컴포넌트를 렌더링함 */
export function documentsForSection(
  documents: readonly NavigationEntry[],
  section: DocSection,
): readonly NavigationItem[] {
  return documents
    .filter((document) => document.section === section)
    .map((document) => ({
      id: document.id,
      href: document.href,
      label: displayTitleFor(document),
      selected: false,
    }));
}
