import { describe, expect, it } from "vitest";
import {
  findDocument,
  getRelatedDocuments,
  getLocalizedDocuments,
  loadDocument,
  rankRelatedDocuments,
} from "./documents";

describe("블로그 문서 발견", () => {
  it("[성공] 글을 최신 게시일 순으로 제공함", async () => {
    const documents = await getLocalizedDocuments("ko");
    expect(documents).not.toHaveLength(0);
    expect(documents.map(({ publishedAt }) => publishedAt)).toEqual(
      documents
        .map(({ publishedAt }) => publishedAt)
        .toSorted((left, right) => right.localeCompare(left)),
    );
  });

  it("[성공] 시리즈 글을 고유 slug로 조회함", async () => {
    const document = await findDocument("en", "ddd");
    expect(document).toMatchObject({
      id: "ddd",
      href: "/en/ddd",
      series: "domain-driven-design",
      seriesOrder: 1,
    });
  });

  it("[성공] 동일 시리즈 글을 관련 글로 우선함", async () => {
    const [current, candidates] = await Promise.all([
      findDocument("en", "ddd"),
      getLocalizedDocuments("en"),
    ]);
    if (current === null) throw new Error("Missing DDD article.");
    expect(
      rankRelatedDocuments(current, candidates).map(({ id }) => id),
    ).toContain("collaboration");
  });

  it("[실패] 지원하지 않는 locale과 없는 글은 조회하지 않음", async () => {
    await expect(findDocument("fr", "ddd")).resolves.toBeNull();
    await expect(findDocument("en", "missing")).resolves.toBeNull();
    await expect(getRelatedDocuments("en", "missing")).resolves.toEqual([]);
    await expect(loadDocument("en", "missing")).resolves.toBeNull();
  });

  it("[성공] Fumadocs 본문과 목차를 제품 문서 모델로 로드함", async () => {
    const document = await loadDocument("en", "ddd");
    expect(document?.metadata.id).toBe("ddd");
    expect(document?.Content).toBeTypeOf("function");
    expect(document?.toc.length).toBeGreaterThan(0);
  });

  it("[성공] FE 유지보수 시리즈가 Diátaxis 유형과 공개 근거를 유지함", async () => {
    const documents = (await getLocalizedDocuments("ko"))
      .filter(({ series }) => series === "frontend-maintainability")
      .toSorted(
        (left, right) => (left.seriesOrder ?? 0) - (right.seriesOrder ?? 0),
      );
    expect(documents.map(({ documentKind }) => documentKind)).toEqual([
      "explanation",
      "tutorial",
      "how-to",
      "reference",
    ]);
    expect(new Set(documents.map(({ sourceUrl }) => sourceUrl))).toEqual(
      new Set(["https://news.hada.io/topic?id=32073"]),
    );
  });
});
