import { describe, expect, it } from "vitest";
import { docsInventoryPerLocale } from "./content-validation";
import {
  findDocument,
  findDocsPage,
  getBlogPosts,
  getDocsPages,
  getRelatedDocuments,
  getLocalizedDocuments,
  getLocalizedDocsPages,
  loadDocsPage,
  loadDocument,
  rankRelatedDocuments,
} from "./documents";

describe("블로그 문서 발견", () => {
  it("[성공] 글을 최신 게시일 순으로 제공함", async () => {
    const documents = await getLocalizedDocuments("ko");
    expect(documents).toHaveLength(24);
    expect(documents.map(({ publishedAt }) => publishedAt)).toEqual(
      documents
        .map(({ publishedAt }) => publishedAt)
        .toSorted((left, right) => right.localeCompare(left)),
    );
  });

  it("[성공] Docs 페이지를 area와 slug로 조회함", async () => {
    const document = await findDocsPage("en", ["architecture", "ddd"]);
    expect(document).toMatchObject({
      id: "ddd",
      href: "/en/docs/architecture/ddd",
      area: "architecture",
      documentKind: "how-to",
      series: "domain-driven-design",
      seriesOrder: 1,
    });
  });

  it("[성공] 동일 시리즈 글을 관련 글로 우선함", async () => {
    const [current, candidates] = await Promise.all([
      findDocument("en", "ascii-3d-renderer"),
      getLocalizedDocuments("en"),
    ]);
    if (current === null) throw new Error("Missing Blog article.");
    expect(
      rankRelatedDocuments(current, candidates).map(({ id }) => id),
    ).not.toContain("ddd");
  });

  it("[실패] 지원하지 않는 locale과 없는 글은 조회하지 않음", async () => {
    await expect(findDocument("fr", "ddd")).resolves.toBeNull();
    await expect(findDocument("en", "missing")).resolves.toBeNull();
    await expect(getRelatedDocuments("en", "missing")).resolves.toEqual([]);
    await expect(loadDocument("en", "missing")).resolves.toBeNull();
  });

  it("[성공] Fumadocs 본문과 목차를 제품 문서 모델로 로드함", async () => {
    const document = await loadDocsPage("en", ["architecture", "ddd"]);
    expect(document?.metadata.id).toBe("ddd");
    expect(document?.Content).toBeTypeOf("function");
    expect(document?.toc.length).toBeGreaterThan(0);
  });

  it("[성공] FE 유지보수 시리즈가 Diátaxis 유형과 공개 근거를 유지함", async () => {
    const documents = (await getLocalizedDocsPages("ko"))
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

  it("[성공] locale별 Blog와 Docs를 독립 canonical inventory로 유지함", async () => {
    const [blog, docs] = await Promise.all([getBlogPosts(), getDocsPages()]);
    for (const locale of ["ko", "en"] as const) {
      expect(blog.filter((post) => post.locale === locale)).toHaveLength(24);
      expect(
        docs.filter(
          (page) => page.locale === locale && !page.id.endsWith("-overview"),
        ),
      ).toHaveLength(docsInventoryPerLocale);
      expect(
        new Set(
          docs.filter((page) => page.locale === locale).map(({ area }) => area),
        ),
      ).toEqual(new Set(["fe", "k8s", "architecture", "tooling", "practices"]));
    }
  });
});
