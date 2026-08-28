import { describe, expect, it } from "vitest";
import {
  createDocsPageHref,
  createDocHref,
  createSeriesHref,
  parseDocsPageMetadata,
  parseDocMetadata,
} from "./content-model";

const metadata = {
  id: "article",
  locale: "en",
  title: "Article",
  description: "A technical article",
  thesis: "A contestable technical claim",
  counterargument: "The strongest reasonable objection",
  publishedAt: "2026-07-14",
  updatedAt: "2026-07-14",
  tags: ["docs"],
  status: "stable",
  publicationStatus: "published",
  sourceUrl: "https://example.com/source",
};

const {
  thesis: _thesis,
  counterargument: _counterargument,
  ...docsMetadata
} = metadata;

describe("블로그 메타데이터", () => {
  it("[성공] 독립 글의 검증된 계약을 반환함", () => {
    const parsed = parseDocMetadata(metadata);
    expect(parsed).toMatchObject(metadata);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it("[성공] 등록된 시리즈와 순서를 함께 허용함", () => {
    expect(
      parseDocMetadata({
        ...metadata,
        series: "building-from-first-principles",
        seriesOrder: 1,
      }).series,
    ).toBe("building-from-first-principles");
  });

  it("[성공] Docs에 영역·Diátaxis 유형·검증일을 요구함", () => {
    expect(
      parseDocsPageMetadata({
        ...docsMetadata,
        area: "be",
        documentKind: "how-to",
        verifiedAt: "2026-07-14",
      }),
    ).toMatchObject({ area: "be", documentKind: "how-to" });
    expect(
      parseDocsPageMetadata({
        ...docsMetadata,
        id: "docs-overview",
        verifiedAt: "2026-07-14",
      }),
    ).toMatchObject({ id: "docs-overview" });
  });

  it("[실패] Blog의 Docs 전용 필드와 지원하지 않는 문서 유형을 거부함", () => {
    expect(() =>
      parseDocMetadata({ ...metadata, documentKind: "how-to" }),
    ).toThrow("unsupported metadata fields");
    expect(() =>
      parseDocsPageMetadata({
        ...docsMetadata,
        area: "be",
        documentKind: "guide",
        verifiedAt: "2026-07-14",
      }),
    ).toThrow();
  });

  it("[실패] Docs의 Series 필드와 실제 문서의 영역 누락을 거부함", () => {
    expect(() =>
      parseDocsPageMetadata({
        ...docsMetadata,
        area: "be",
        documentKind: "how-to",
        verifiedAt: "2026-07-14",
        series: "building-from-first-principles",
        seriesOrder: 1,
      }),
    ).toThrow("unsupported metadata fields");
    expect(() =>
      parseDocsPageMetadata({
        ...docsMetadata,
        documentKind: "how-to",
        verifiedAt: "2026-07-14",
      }),
    ).toThrow();
  });

  it("[실패] 시리즈와 순서의 단독 선언 및 미등록 시리즈를 거부함", () => {
    expect(() =>
      parseDocMetadata({
        ...metadata,
        series: "building-from-first-principles",
      }),
    ).toThrow("must be used together");
    expect(() => parseDocMetadata({ ...metadata, seriesOrder: 1 })).toThrow(
      "must be used together",
    );
    expect(() =>
      parseDocMetadata({ ...metadata, series: "unknown", seriesOrder: 1 }),
    ).toThrow('unknown series "unknown"');
  });

  it("[실패] Blog는 반론 가능한 주장과 예상 반론을 모두 요구함", () => {
    expect(() =>
      parseDocMetadata({ ...metadata, thesis: undefined }),
    ).toThrow();
    expect(() =>
      parseDocMetadata({ ...metadata, counterargument: undefined }),
    ).toThrow();
  });

  it("[성공] 새 공개 URL을 생성함", () => {
    expect(createDocHref("ko", "article")).toBe("/ko/article");
    expect(createSeriesHref("en")).toBe("/en/series");
    expect(createSeriesHref("en", "react-ui-architecture")).toBe(
      "/en/series/react-ui-architecture",
    );
    expect(createDocsPageHref("ko", "fe", "typescript-6")).toBe(
      "/ko/docs/fe/typescript-6",
    );
  });
});
