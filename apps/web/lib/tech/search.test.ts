import type { SortedResult } from "fumadocs-core/search";
import { describe, expect, it } from "vitest";
import { searchTechDocuments } from "./search-server.ts";
import {
  createSearchAliases,
  filterSearchResults,
  interleaveSearchResults,
  normalizeSearchText,
  segmentSearchQuery,
} from "./search.ts";

const result = (
  id: string,
  type: SortedResult["type"],
  content: string,
  url = `/${id}`,
): SortedResult => ({ id, type, content, url });

describe("검색 runtime", () => {
  it("Unicode와 공백을 같은 검색 표기로 정규화함", () => {
    expect(normalizeSearchText("  Ｎext.JS\n16  ")).toBe("next.js 16");
  });

  it("공백 없는 질의를 metadata 사전으로 분해함", () => {
    expect(
      segmentSearchQuery("pnpmworkspacecatalog", [
        "pnpm",
        "workspace",
        "catalog",
      ]),
    ).toBe("pnpm workspace catalog");
  });

  it("연속 단어와 원문을 검색 별칭으로 생성함", () => {
    expect(createSearchAliases(["Cache invalidation strategy"])).toEqual([
      "cache invalidation strategy",
      "cacheinvalidation",
      "cacheinvalidationstrategy",
      "invalidationstrategy",
    ]);
  });

  it("검색 토큰이 부족한 page group을 제외함", () => {
    const results = [
      result("cache", "page", "Cache strategy"),
      result("cache-heading", "heading", "invalidation", "/cache"),
      result("other", "page", "Cache only"),
    ];

    expect(
      filterSearchResults(results, "cache invalidation strategy").map(
        ({ id }) => id,
      ),
    ).toEqual(["cache", "cache-heading"]);
  });

  it("서로 다른 source의 page group을 번갈아 유지함", () => {
    const left = [
      result("blog-1", "page", "Blog 1"),
      result("blog-heading", "heading", "Heading", "/blog-1"),
      result("blog-2", "page", "Blog 2"),
    ];
    const right = [
      result("docs-1", "page", "Docs 1"),
      result("duplicate", "page", "Duplicate", "/blog-2"),
    ];

    expect(interleaveSearchResults(left, right, 8).map(({ id }) => id)).toEqual(
      ["blog-1", "blog-heading", "docs-1", "blog-2"],
    );
  });

  it("빈 검색 추천에는 공개 rke2spray·FE·BE·K8s landing만 포함함", async () => {
    const results = await searchTechDocuments("", "en");
    const docsUrls = results
      .filter(({ type, url }) => type === "page" && url.includes("/docs/"))
      .map(({ url }) => url);
    expect(docsUrls).toEqual([
      "/en/docs/rke2spray",
      "/en/docs/fe",
      "/en/docs/be",
      "/en/docs/k8s",
    ]);
    expect(docsUrls.some((url) => url.includes("ansible"))).toBe(false);
  });
});
