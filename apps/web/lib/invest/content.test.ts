import { describe, expect, it } from "vitest";
import {
  parseInvestmentNoteMetadata,
  validateInvestmentNoteBody,
} from "./content";

const metadata = {
  id: "margin-of-safety",
  locale: "en",
  title: "Margin of Safety",
  description: "A source-grounded note",
  publishedAt: "2026-08-16",
  updatedAt: "2026-08-16",
  status: "published",
  tags: ["risk"],
  image: "/invest/margin-of-safety.light.png",
  imageDark: "/invest/margin-of-safety.dark.png",
  imageAlt: "A protected stack of capital representing margin of safety",
  sources: [
    {
      kind: "book",
      title: "The Intelligent Investor",
      creator: "Benjamin Graham",
      isbn: "9780060555665",
    },
  ],
} as const;

describe("투자 글 계약", () => {
  it("[성공] 일반 Markdown 본문을 허용함", () => {
    expect(parseInvestmentNoteMetadata(metadata).sources[0]?.kind).toBe("book");
    expect(() =>
      validateInvestmentNoteBody(
        "## Margin of safety\n\nArticle body",
        "fixture",
      ),
    ).not.toThrow();
  });

  it("[성공] 책이 아닌 출처에 대한 URL이 필요함", () => {
    expect(() =>
      parseInvestmentNoteMetadata({
        ...metadata,
        sources: [{ kind: "video", title: "Talk", creator: "Investor" }],
      }),
    ).toThrow(/requires a URL/u);
  });

  it("[실패] 과거 요약 및 작성자 메모 wrapper를 거부함", () => {
    expect(() =>
      validateInvestmentNoteBody(
        "<SourceSummary>Summary</SourceSummary>",
        "fixture",
      ),
    ).toThrow(/ordinary Markdown/u);
  });

  it("[실패] 알 수 없는 필드, 해석 태그 및 관계 반전을 의미함", () => {
    expect(() =>
      parseInvestmentNoteMetadata({ ...metadata, unexpected: true }),
    ).toThrow();
    expect(() =>
      parseInvestmentNoteMetadata({
        ...metadata,
        tags: ["risk", " risk "],
      }),
    ).toThrow(/duplicates/u);
    expect(() =>
      parseInvestmentNoteMetadata({
        ...metadata,
        updatedAt: "2026-08-15",
      }),
    ).toThrow(/precedes/u);
  });

  it("[실패] 불법 체류자격 및 자격 증명이 포함된 소스 URL이 있음을 증명함", () => {
    expect(() =>
      parseInvestmentNoteMetadata({
        ...metadata,
        publishedAt: "2026-02-30",
      }),
    ).toThrow(/invalid publication date/u);
    expect(() =>
      parseInvestmentNoteMetadata({
        ...metadata,
        sources: [
          {
            kind: "article",
            title: "Analysis",
            creator: "Analyst",
            url: "https://user:secret@example.com/article",
          },
        ],
      }),
    ).toThrow(/credential-free HTTPS URL/u);
  });
});
