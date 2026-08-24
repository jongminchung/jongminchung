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
  sources: [
    {
      kind: "book",
      title: "The Intelligent Investor",
      creator: "Benjamin Graham",
      isbn: "9780060555665",
    },
  ],
} as const;

describe("투자 어음계약", () => {
  it("[성공] 소스 기반 더블 언어 노트 모양을 허용함", () => {
    expect(parseInvestmentNoteMetadata(metadata).sources[0]?.kind).toBe("book");
    expect(() =>
      validateInvestmentNoteBody(
        "<SourceSummary>Summary</SourceSummary>\n<JamieNotes>Notes</JamieNotes>",
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

  it("[성공] 별도의 소스 요약 및 작성자 메모가 필요함", () => {
    expect(() => validateInvestmentNoteBody("Freeform", "fixture")).toThrow(
      /SourceSummary/u,
    );
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
