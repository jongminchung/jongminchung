import { describe, expect, it } from "bun:test";
import {
  filterEditorialItems,
  paginateEditorialItems,
  parseEditorialQuery,
  rankRelatedEditorialItems,
  type EditorialItem,
} from "./editorial";

const items: readonly EditorialItem[] = [
  {
    id: "a",
    href: "/a",
    title: "A",
    description: "A",
    publishedAt: "2026-08-03",
    tags: ["react", "web"],
    kind: "Article",
    mediaSeed: "a",
  },
  {
    id: "b",
    href: "/b",
    title: "B",
    description: "B",
    publishedAt: "2026-08-02",
    tags: ["react"],
    kind: "Article",
    mediaSeed: "b",
  },
  {
    id: "c",
    href: "/c",
    title: "C",
    description: "C",
    publishedAt: "2026-08-01",
    tags: ["risk"],
    kind: "Note",
    mediaSeed: "c",
  },
];

describe("editorial 목록 상태", () => {
  it("[성공] 유효한 URL 상태만 유지하고 잘못된 값은 기본값으로 정규화함", () => {
    expect(
      parseEditorialQuery(
        { tag: "react", sort: "oldest", view: "list", page: "2" },
        ["react"],
      ),
    ).toEqual({ tag: "react", sort: "oldest", view: "list", page: 2 });
    expect(
      parseEditorialQuery(
        { tag: "missing", sort: "recent", view: "cards", page: "0" },
        ["react"],
      ),
    ).toEqual({ tag: undefined, sort: "newest", view: "grid", page: 1 });
  });

  it("[성공] 태그·정렬·페이지 경계를 함께 적용함", () => {
    const query = parseEditorialQuery({ tag: "react", sort: "oldest" }, [
      "react",
    ]);
    expect(filterEditorialItems(items, query).map(({ id }) => id)).toEqual([
      "b",
      "a",
    ]);
    expect(paginateEditorialItems(items, 1, 2)).toMatchObject({
      hasMore: true,
      items: [items[0], items[1]],
    });
    expect(paginateEditorialItems(items, 2, 2)).toMatchObject({
      hasMore: false,
      items: [items[2]!],
    });
  });

  it("마지막 페이지를 넘는 요청은 마지막 결과와 탐색 상태를 반환함", () => {
    expect(paginateEditorialItems(items, 999, 2)).toEqual({
      page: 2,
      totalPages: 2,
      hasMore: false,
      items: [items[2]!],
    });
    expect(paginateEditorialItems([], 999, 2)).toEqual({
      page: 1,
      totalPages: 1,
      hasMore: false,
      items: [],
    });
  });

  it("[성공] 현재 항목을 제외하고 공통 태그가 많은 항목을 우선함", () => {
    expect(
      rankRelatedEditorialItems(items[0]!, items).map(({ id }) => id),
    ).toEqual(["b"]);
  });
});
