import { describe, expect, it } from "vitest";
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

describe("블로그 문서 발견", () => {
  it("[성공] 두 Blog Series의 멤버와 순서를 locale별로 동일하게 유지함", async () => {
    const expected = {
      "building-from-first-principles": [
        "building-calculator-engine",
        "hamssun-python-lisp",
        "implementing-genetic-algorithm",
        "ascii-3d-renderer",
        "building-3d-illusion-game",
        "building-nes-emulator",
        "building-llm",
        "building-coding-agent",
        "building-email-relay-system",
        "encrypted-share-vault-system",
      ],
      "react-ui-architecture": [
        "react-component-based-thinking",
        "modeling-series-view-model",
        "headless-react-component",
      ],
    } as const;
    const posts = await getBlogPosts();
    for (const locale of ["ko", "en"] as const) {
      for (const [series, ids] of Object.entries(expected)) {
        const actual = posts
          .filter((post) => post.locale === locale && post.series === series)
          .toSorted(
            (left, right) => (left.seriesOrder ?? 0) - (right.seriesOrder ?? 0),
          );
        expect(actual.map(({ id }) => id)).toEqual(ids);
      }
    }
  });

  it("[성공] 글을 최신 게시일 순으로 제공함", async () => {
    const documents = await getLocalizedDocuments("ko");
    expect(documents).toHaveLength(25);
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
    await expect(findDocument("fr", "ddd")).resolves.toBeNull();
    await expect(findDocument("en", "missing")).resolves.toBeNull();
    await expect(getRelatedDocuments("en", "missing")).resolves.toEqual([]);
    await expect(loadDocument("en", "missing")).resolves.toBeNull();
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
      expect(blog.filter((post) => post.locale === locale)).toHaveLength(25);
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
      ).toEqual(new Set(["fe", "be", "k8s"]));
    }
  });
});
