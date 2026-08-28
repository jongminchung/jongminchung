import { describe, expect, it } from "vitest";
import type { ContentManifestEntry } from "./content-model";
import type { InvestmentNoteManifestEntry } from "./invest/content";
import {
  createDocsCategoryStructuredData,
  createInvestmentArticleStructuredData,
  createTechArticleStructuredData,
} from "./structured-data";

const document = {
  id: "seo-contract",
  locale: "ko",
  title: "SEO 계약",
  description: "검색 엔진이 읽는 문서 계약",
  publishedAt: "2026-08-01",
  updatedAt: "2026-08-02",
  tags: ["frontend"],
  status: "stable",
  publicationStatus: "published",
  sourceUrl: "https://developers.google.com/search/docs",
  href: "/ko/seo-contract",
} as const satisfies ContentManifestEntry;

describe("구조화 데이터", () => {
  it("[성공] 기술 문서에 canonical URL과 저자·날짜·근거를 연결함", () => {
    const schema = createTechArticleStructuredData(document);

    expect(schema["@type"]).toBe("TechArticle");
    expect(schema.mainEntityOfPage).toBe(
      "https://tech.jamie.kr/ko/seo-contract",
    );
    expect(schema.dateModified).toBe("2026-08-02");
    expect(schema.author).toMatchObject({
      "@type": "Person",
      name: "Jongmin Chung",
    });
    expect(schema.citation).toBe("https://developers.google.com/search/docs");
  });

  it("[성공] 문서 카테고리가 canonical 기술 문서를 포함함", () => {
    const schema = createDocsCategoryStructuredData({
      category: {
        id: "fe",
        label: "FE",
        title: "프론트엔드",
        description: "프론트엔드 실무 문서",
      },
      documents: [document],
      locale: "ko",
    });

    expect(schema["@type"]).toBe("CollectionPage");
    expect(schema.hasPart).toEqual([
      expect.objectContaining({
        url: "https://tech.jamie.kr/ko/seo-contract",
      }),
    ]);
  });

  it("[성공] 투자 노트에 원자료 URL을 citation으로 연결함", () => {
    const note = {
      id: "source-note",
      locale: "en",
      title: "Source note",
      description: "A source-grounded note",
      publishedAt: "2026-08-01",
      updatedAt: "2026-08-02",
      status: "published",
      tags: ["research"],
      sources: [
        {
          kind: "article",
          title: "Primary source",
          creator: "Publisher",
          url: "https://example.com/source",
        },
      ],
      href: "/en/notes/source-note",
    } as const satisfies InvestmentNoteManifestEntry;

    expect(createInvestmentArticleStructuredData(note).citation).toEqual([
      "https://example.com/source",
    ]);
  });
});
