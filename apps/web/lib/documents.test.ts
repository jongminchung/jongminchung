import { describe, expect, it } from "vitest";
import {
  findDocument,
  getLocalizedDocuments,
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
});
