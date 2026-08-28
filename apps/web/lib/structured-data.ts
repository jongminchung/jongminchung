import {
  createOgImageHref,
  displayTitleFor,
  type BlogPostManifestEntry,
  type ContentManifestEntry,
  type DocsPageManifestEntry,
  type Locale,
} from "./content-model.ts";
import { personSchema } from "./home/content.ts";
import type { InvestmentNoteManifestEntry } from "./invest/content.ts";
import { getDocsCategory, type LocalizedDocsCategory } from "./tech/docs.ts";

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

function articleGraph(
  document: ContentManifestEntry,
  type: "BlogPosting" | "TechArticle",
  breadcrumbItems: readonly Readonly<Record<string, unknown>>[],
  learningResourceType?: string,
): Readonly<Record<string, unknown>> {
  const url = absoluteUrl(techOrigin, document.href);
  return {
    "@context": "https://schema.org",
    "@graph": [
      personEntity,
      {
        "@type": type,
        "@id": `${url}#article`,
        url,
        mainEntityOfPage: url,
        headline: displayTitleFor(document),
        description: document.description,
        image: absoluteUrl(
          techOrigin,
          createOgImageHref(
            document.locale,
            document.contentType === "docs"
              ? ["docs", ...document.slugs].join("/")
              : document.id,
          ),
        ),
        inLanguage: document.locale,
        datePublished: document.publishedAt,
        dateModified: document.updatedAt,
        author: { "@id": personId },
        publisher: { "@id": personId },
        keywords: document.tags,
        citation: document.sourceUrl,
        isPartOf: { "@id": `${techOrigin}/#website` },
        ...(learningResourceType === undefined ? {} : { learningResourceType }),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: breadcrumbItems,
      },
    ],
  };
}

/** Blog 글의 발행일·저자·근거 URL을 BlogPosting으로 선언함 */
export function createBlogPostingStructuredData(
  post: BlogPostManifestEntry,
): Readonly<Record<string, unknown>> {
  const url = absoluteUrl(techOrigin, post.href);
  return articleGraph(post, "BlogPosting", [
    {
      "@type": "ListItem",
      position: 1,
      name: "Engineering Blog",
      item: `${techOrigin}/${post.locale}`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: displayTitleFor(post),
      item: url,
    },
  ]);
}

/** Docs 페이지를 Diátaxis 유형과 page tree breadcrumb를 가진 TechArticle로 선언함 */
export function createDocsArticleStructuredData(
  page: DocsPageManifestEntry,
): Readonly<Record<string, unknown>> {
  const url = absoluteUrl(techOrigin, page.href);
  const areaUrl = `${techOrigin}/${page.locale}/docs/${page.area}`;
  const area = getDocsCategory(page.area, page.locale);
  return articleGraph(
    page,
    "TechArticle",
    [
      {
        "@type": "ListItem",
        position: 1,
        name: "Docs",
        item: `${techOrigin}/${page.locale}/docs`,
      },
      ...(page.slugs.length === 0
        ? []
        : [
            {
              "@type": "ListItem",
              position: 2,
              name: area.title,
              item: areaUrl,
            },
          ]),
      ...(page.slugs.length <= 1
        ? []
        : [
            {
              "@type": "ListItem",
              position: 3,
              name: displayTitleFor(page),
              item: url,
            },
          ]),
    ],
    page.documentKind,
  );
}

/** 콘텐츠 유형에 맞는 기술 구조화 데이터를 생성함 */
export function createTechArticleStructuredData(
  document: ContentManifestEntry,
): Readonly<Record<string, unknown>> {
  return document.contentType === "blog"
    ? createBlogPostingStructuredData(document)
    : createDocsArticleStructuredData(document);
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
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Docs",
          item: `${techOrigin}/${locale}/docs`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: category.title,
          item: url,
        },
      ],
    },
    hasPart: documents.map((document) => ({
      "@type": "TechArticle",
      "@id": `${absoluteUrl(techOrigin, document.href)}#article`,
      url: absoluteUrl(techOrigin, document.href),
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
    "@graph": [
      personEntity,
      {
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
        author: { "@id": personId },
        publisher: { "@id": personId },
        keywords: note.tags,
        citation: note.sources.flatMap((source) =>
          source.url === undefined ? [] : [source.url],
        ),
        isPartOf: { "@id": `${investOrigin}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Investment Notes",
            item: `${investOrigin}/${note.locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: note.title,
            item: url,
          },
        ],
      },
    ],
  };
}

/** 투자 collection과 포함 노트의 관계를 선언함 */
export function createInvestmentCollectionStructuredData({
  locale,
  pathname,
  title,
  description,
  notes,
}: {
  readonly locale: Locale;
  readonly pathname: string;
  readonly title: string;
  readonly description: string;
  readonly notes: readonly InvestmentNoteManifestEntry[];
}): Readonly<Record<string, unknown>> {
  const url = absoluteUrl(investOrigin, pathname);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name: title,
    description,
    inLanguage: locale,
    isPartOf: { "@id": `${investOrigin}/#website` },
    hasPart: notes.map((note) => ({
      "@type": "Article",
      "@id": `${absoluteUrl(investOrigin, note.href)}#article`,
      url: absoluteUrl(investOrigin, note.href),
      name: note.title,
    })),
  };
}
