import { describe, expect, it } from "bun:test";
import type { SortedResult } from "fumadocs-core/search";
import { toSearchItems } from "./search-results";

const copy = {
  body: "Body",
  heading: "Heading",
  resultGroupBlog: "Blog posts",
  title: "Title",
};

function page(breadcrumbs?: string[]): SortedResult {
  return {
    id: "page",
    type: "page",
    url: "/en/docs/fe/example",
    content: "A <mark>document</mark>",
    breadcrumbs,
  };
}

describe("검색 결과 표시", () => {
  it("문서 유형을 현지화하고 알 수 없는 유형에는 Docs를 표시함", () => {
    for (const [kind, en, ko] of [
      ["tutorial", "Tutorial", "튜토리얼"],
      ["how-to", "How-to guide", "방법 안내"],
      ["reference", "Reference", "기술 참조"],
      ["explanation", "Explanation", "설명"],
      ["Docs", "Docs", "Docs"],
      ["future-kind", "Docs", "Docs"],
      ["toString", "Docs", "Docs"],
      ["__proto__", "Docs", "Docs"],
      ["", "Docs", "Docs"],
    ] as const) {
      const results = [page([kind, "Frontend"])];
      expect(toSearchItems("en", results, copy)[0]?.badge).toBe(en);
      expect(toSearchItems("ko", results, copy)[0]?.badge).toBe(ko);
      expect(toSearchItems("en", results, copy)[0]?.group).toBe("Frontend");
    }
  });

  it("Blog과 breadcrumb가 없는 기존 응답을 유지함", () => {
    for (const breadcrumbs of [undefined, [], ["Blog"]]) {
      expect(toSearchItems("en", [page(breadcrumbs)], copy)[0]).toMatchObject({
        badge: "Blog",
        group: "Blog posts",
        label: "A document",
        matchLabel: "Title",
      });
    }
  });

  it("본문보다 제목 일치를 우선하고 해당 페이지의 anchor를 유지함", () => {
    const results: SortedResult[] = [
      { id: "orphan", type: "text", url: "/orphan", content: "Ignore" },
      page(["reference", "Frontend", "Next.js"]),
      { id: "text", type: "text", url: "/body", content: "Body match" },
      {
        id: "heading",
        type: "heading",
        url: "/en/docs/fe/example#heading",
        content: "The <mark>heading</mark>",
      },
      { ...page(["Blog"]), id: "blog", url: "/en/blog" },
      { id: "blog-text", type: "text", url: "/en/blog#body", content: "Text" },
    ];
    expect(toSearchItems("en", results, copy)).toEqual([
      {
        href: "/en/docs/fe/example#heading",
        label: "A document",
        matchLabel: "Heading",
        matchText: "The heading",
        group: "Frontend · Next.js",
        badge: "Reference",
      },
      {
        href: "/en/blog#body",
        label: "A document",
        matchLabel: "Body",
        matchText: "Text",
        group: "Blog posts",
        badge: "Blog",
      },
    ]);
    expect(toSearchItems("en", [], copy)).toEqual([]);
  });
});
