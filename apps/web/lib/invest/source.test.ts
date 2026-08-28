import { describe, expect, it } from "vitest";
import type { InvestmentNoteMetadata } from "./content.ts";
import {
  createInvestmentNoteCollection,
  type InvestmentNoteSourceInput,
} from "./source.ts";

const baseMetadata = {
  id: "margin-of-safety",
  locale: "ko",
  title: "안전마진",
  description: "원문 기반 투자 노트",
  publishedAt: "2026-08-20",
  updatedAt: "2026-08-20",
  status: "published",
  tags: ["risk"],
  series: "Risk",
  image: "/invest/margin-of-safety.png",
  imageAlt: "안전마진을 표현한 투자 리서치 이미지",
  sources: [
    {
      kind: "book",
      title: "The Intelligent Investor",
      creator: "Benjamin Graham",
      isbn: "9780060555665",
    },
  ],
} as const satisfies InvestmentNoteMetadata;

const body = "## Margin of safety\n\nArticle body";

function source(
  locale: "ko" | "en",
  overrides: Partial<InvestmentNoteMetadata> = {},
  sourceBody = body,
): InvestmentNoteSourceInput {
  return {
    metadata: {
      ...baseMetadata,
      locale,
      title: locale === "ko" ? "안전마진" : "Margin of Safety",
      description:
        locale === "ko" ? "원문 기반 투자 노트" : "A source-grounded note",
      imageAlt:
        locale === "ko"
          ? "안전마진을 표현한 투자 리서치 이미지"
          : "An investment research image representing margin of safety",
      ...overrides,
    },
    body: sourceBody,
    filePath: `/workspace/apps/web/content/invest/${locale}/notes/margin-of-safety.mdx`,
    relativePath: `${locale}/notes/margin-of-safety.mdx`,
  };
}

describe("Investment source collection", () => {
  it("locale pair를 검증된 공개 manifest로 변환함", () => {
    const collection = createInvestmentNoteCollection([
      source("ko"),
      source("en"),
    ]);

    expect(collection.map(({ href }) => href)).toEqual([
      "/en/notes/margin-of-safety",
      "/ko/notes/margin-of-safety",
    ]);
  });

  it("locale 누락을 구분해 거부함", () => {
    expect(() => createInvestmentNoteCollection([source("ko")])).toThrow(
      /missing locales: en/u,
    );
  });

  it("공유 metadata 불일치를 구분해 거부함", () => {
    expect(() =>
      createInvestmentNoteCollection([
        source("ko"),
        source("en", { tags: ["valuation"] }),
      ]),
    ).toThrow(/inconsistent shared metadata/u);
  });

  it("metadata ID와 source path 불일치를 구분해 거부함", () => {
    expect(() =>
      createInvestmentNoteCollection([
        source("ko"),
        { ...source("en"), relativePath: "en/notes/wrong-id.mdx" },
      ]),
    ).toThrow(/expected en\/notes\/margin-of-safety\.mdx/u);
  });

  it("과거 구분 wrapper를 사용한 본문을 거부함", () => {
    expect(() =>
      createInvestmentNoteCollection([
        source("ko", {}, "<SourceSummary>Summary</SourceSummary>"),
        source("en"),
      ]),
    ).toThrow(/ordinary Markdown/u);
  });
});
