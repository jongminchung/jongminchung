import { describe, expect, it } from "bun:test";
import {
  docsInventoryPerLocale,
  docsPagesPerLocale,
} from "./content-validation";
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
import { seriesRegistry } from "./tech/series";

describe("블로그 문서 발견", () => {
  it("[성공] Blog Series의 멤버와 순서를 locale별로 동일하게 유지함", async () => {
    const posts = await getBlogPosts();
    for (const series of Object.keys(seriesRegistry)) {
      const members = (["ko", "en"] as const).map((locale) =>
        posts
          .filter((post) => post.locale === locale && post.series === series)
          .toSorted(
            (left, right) => (left.seriesOrder ?? 0) - (right.seriesOrder ?? 0),
          )
          .map(({ id, seriesOrder }) => ({ id, seriesOrder })),
      );
      expect(members[0]?.length).toBeGreaterThan(0);
      expect(members[0]).toEqual(members[1]);
    }
  });

  it("[성공] 글을 최신 게시일 순으로 제공함", async () => {
    const documents = await getLocalizedDocuments("ko");
    expect(documents.length).toBeGreaterThan(0);
    expect(documents.every((post) => post.locale === "ko")).toBe(true);
    expect(documents.map(({ publishedAt }) => publishedAt)).toEqual(
      documents
        .map(({ publishedAt }) => publishedAt)
        .toSorted((left, right) => right.localeCompare(left)),
    );
  });

  it("[성공] Docs 페이지를 area와 slug로 조회함", async () => {
    const document = await findDocsPage("en", ["be", "ddd"]);
    expect(document).toMatchObject({
      id: "ddd",
      href: "/en/docs/be/ddd",
      area: "be",
      documentKind: "how-to",
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
    expect(await findDocument("fr", "ddd")).toBeNull();
    expect(await findDocument("en", "missing")).toBeNull();
    expect(await getRelatedDocuments("en", "missing")).toEqual([]);
    expect(await loadDocument("en", "missing")).toBeNull();
  });

  it("[성공] Fumadocs 본문과 목차를 제품 문서 모델로 로드함", async () => {
    const document = await loadDocsPage("en", ["be", "ddd"]);
    expect(document?.metadata.id).toBe("ddd");
    expect(document?.Content).toBeTypeOf("function");
    expect(document?.toc.length).toBeGreaterThan(0);
  });

  it("[성공] FE 유지보수 문서가 Series 없이 Diátaxis 유형과 공개 근거를 유지함", async () => {
    const ids = new Set([
      "why-tailwind-shadcn-maintainability-needs-ownership",
      "tutorial-maintainable-tailwind-shadcn",
      "how-to-audit-tailwind-shadcn",
      "tailwind-shadcn-maintainability-reference",
    ]);
    const documents = (await getLocalizedDocsPages("ko")).filter(({ id }) =>
      ids.has(id),
    );
    expect(new Set(documents.map(({ documentKind }) => documentKind))).toEqual(
      new Set(["explanation", "tutorial", "how-to", "reference"]),
    );
    expect(new Set(documents.map(({ sourceUrl }) => sourceUrl))).toEqual(
      new Set(["https://news.hada.io/topic?id=32073"]),
    );
  });

  it("[성공] locale별 Blog와 Docs를 독립 canonical inventory로 유지함", async () => {
    const [blog, docs] = await Promise.all([getBlogPosts(), getDocsPages()]);
    for (const locale of ["ko", "en"] as const) {
      const localizedBlog = blog.filter((post) => post.locale === locale);
      expect(localizedBlog.length).toBeGreaterThan(0);
      expect(localizedBlog.map(({ id }) => id).toSorted()).toEqual(
        blog
          .filter((post) => post.locale !== locale)
          .map(({ id }) => id)
          .toSorted(),
      );
      expect(docs.filter((page) => page.locale === locale)).toHaveLength(
        docsPagesPerLocale,
      );
      expect(
        docs.filter(
          (page) => page.locale === locale && !page.id.endsWith("-overview"),
        ),
      ).toHaveLength(docsInventoryPerLocale);
      expect(
        new Set(
          docs
            .filter((page) => page.locale === locale && page.area !== undefined)
            .map(({ area }) => area),
        ),
      ).toEqual(new Set(["rke2spray", "fe", "be", "k8s"]));
    }
  });
});
