import {
  createDocHref,
  createOgImageHref,
  displayTitleFor,
  type ContentManifestEntry,
  type Locale,
} from "./content-model.ts";
import { personSchema } from "./home/content.ts";
import type { InvestmentNoteManifestEntry } from "./invest/content.ts";
import type { LocalizedDocsCategory } from "./tech/docs.ts";

export const homeOrigin = "https://www.jamie.kr";
export const techOrigin = "https://tech.jamie.kr";
export const investOrigin = "https://invest.jamie.kr";

const personId = `${homeOrigin}/#person`;

const personEntity = {
  ...personSchema,
  "@id": personId,
} as const;

function absoluteUrl(origin: string, pathname: string): string {
  return new URL(pathname, origin).toString();
}

/** 사이트 전역의 발행자와 언어를 검색 엔진에 선언함 */
export function createWebsiteStructuredData({
  origin,
  name,
  description,
  locale,
}: {
  readonly origin: string;
  readonly name: string;
  readonly description: string;
  readonly locale: Locale;
}): Readonly<Record<string, unknown>> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: origin,
    name,
    description,
    inLanguage: locale,
    publisher: { "@id": personId },
  };
}

/** 홈 프로필과 동일 인물 엔터티의 관계를 명시함 */
export function createHomeProfileStructuredData(
  locale: Locale,
): Readonly<Record<string, unknown>> {
  const url = `${homeOrigin}/${locale}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      personEntity,
      {
        "@type": "ProfilePage",
        "@id": `${url}#profile`,
        url,
        name: "Jamie — Jongmin Chung",
        inLanguage: locale,
        mainEntity: { "@id": personId },
      },
    ],
  };
}

/** 기술 문서의 발행일·저자·근거 URL을 TechArticle로 선언함 */
export function createTechArticleStructuredData(
  document: ContentManifestEntry,
): Readonly<Record<string, unknown>> {
  const url = absoluteUrl(techOrigin, document.href);
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": `${url}#article`,
    url,
    mainEntityOfPage: url,
    headline: displayTitleFor(document),
    description: document.description,
    image: absoluteUrl(
      techOrigin,
      createOgImageHref(document.locale, document.id),
    ),
    inLanguage: document.locale,
    datePublished: document.publishedAt,
    dateModified: document.updatedAt,
    author: personEntity,
    publisher: { "@id": personId },
    keywords: document.tags,
    citation: document.sourceUrl,
    isPartOf: { "@id": `${techOrigin}/#website` },
  };
}

/** 문서 카테고리와 포함 문서를 CollectionPage 관계로 선언함 */
export function createDocsCategoryStructuredData({
  category,
  documents,
  locale,
}: {
  readonly category: LocalizedDocsCategory;
  readonly documents: readonly ContentManifestEntry[];
  readonly locale: Locale;
}): Readonly<Record<string, unknown>> {
  const url = `${techOrigin}/${locale}/docs/${category.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name:
      locale === "ko"
        ? `${category.title} 엔지니어링 문서`
        : `${category.title} Engineering Docs`,
    description: category.description,
    inLanguage: locale,
    isPartOf: { "@id": `${techOrigin}/#website` },
    hasPart: documents.map((document) => ({
      "@type": "TechArticle",
      "@id": `${absoluteUrl(techOrigin, createDocHref(locale, document.id))}#article`,
      url: absoluteUrl(techOrigin, createDocHref(locale, document.id)),
      name: displayTitleFor(document),
    })),
  };
}

/** 투자 리서치 노트의 저자·날짜·원자료를 Article로 선언함 */
export function createInvestmentArticleStructuredData(
  note: InvestmentNoteManifestEntry,
): Readonly<Record<string, unknown>> {
  const url = absoluteUrl(investOrigin, note.href);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    url,
    mainEntityOfPage: url,
    headline: note.title,
    description: note.description,
    image: `${investOrigin}/investment-notes-og.png`,
    inLanguage: note.locale,
    datePublished: note.publishedAt,
    dateModified: note.updatedAt,
    author: personEntity,
    publisher: { "@id": personId },
    keywords: note.tags,
    citation: note.sources.flatMap((source) =>
      source.url === undefined ? [] : [source.url],
    ),
    isPartOf: { "@id": `${investOrigin}/#website` },
  };
}
