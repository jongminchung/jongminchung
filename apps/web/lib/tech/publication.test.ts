import { describe, expect, it } from "bun:test";
import type { Root } from "fumadocs-core/page-tree";
import {
  publicPageTree,
  publicPageTreeForArea,
  publishedContentOnly,
} from "./publication.ts";

const source = [
  {
    id: "published",
    title: "Published title",
    body: "Published body",
    publicationStatus: "published" as const,
  },
  {
    id: "draft",
    title: "Draft title",
    body: "Draft private body",
    publicationStatus: "draft" as const,
  },
];

describe("Tech publication boundary", () => {
  it("source collection에는 draft를 유지하고 public collection에서 제외함", () => {
    const published = publishedContentOnly(source);

    expect(source.map(({ id }) => id)).toEqual(["published", "draft"]);
    expect(published.map(({ id }) => id)).toEqual(["published"]);
    expect(JSON.stringify(published)).not.toContain("Draft private body");
  });

  it("page tree에서 draft URL과 비게 된 folder를 제거함", () => {
    const tree: Root = {
      name: "Docs",
      children: [
        { type: "page", name: "Published", url: "/en/docs/published" },
        {
          type: "folder",
          name: "Drafts",
          children: [{ type: "page", name: "Draft", url: "/en/docs/draft" }],
        },
      ],
    };

    expect(
      publicPageTree(tree, new Set(["/en/docs/published"])).children,
    ).toEqual([{ type: "page", name: "Published", url: "/en/docs/published" }]);
  });
});

// optional 속성을 정리할 때 비공개 index가 원본 spread를 통해 다시 노출되지 않아야 함.
it("비공개 folder index를 제거하고 원본과 공개 fallback을 보존함", () => {
  const published = { type: "page", name: "Public", url: "/public" } as const;
  const draft = { type: "page", name: "Draft", url: "/draft" } as const;
  const tree: Root = {
    name: "Docs",
    children: [
      { type: "folder", name: "Mixed", index: draft, children: [published] },
    ],
    fallback: { name: "Fallback", children: [draft, published] },
  };
  const result = publicPageTree(tree, new Set([published.url]));
  expect(result.children).toEqual([
    { type: "folder", name: "Mixed", children: [published] },
  ]);
  expect(result.children[0]).not.toHaveProperty("index");
  expect(result.fallback?.children).toEqual([published]);
  expect(tree.children[0]).toHaveProperty("index", draft);
  expect(tree.fallback?.children).toEqual([draft, published]);
  expect(
    publicPageTree({ name: "Empty", children: [] }, new Set()),
  ).not.toHaveProperty("fallback");
});

it("영역별 tree에서 중첩 draft를 제거하고 공개 index만 있는 폴더를 유지함", () => {
  const published = {
    type: "page",
    name: "Published",
    url: "/en/docs/fe/public",
  } as const;
  const draft = {
    type: "page",
    name: "Draft",
    url: "/en/docs/fe/draft",
  } as const;
  const tree: Root = {
    name: "Docs",
    children: [
      {
        type: "folder",
        $id: "en:fe",
        name: "Frontend",
        children: [
          {
            type: "folder",
            name: "Index only",
            index: published,
            children: [draft],
          },
          { type: "folder", name: "Private", index: draft, children: [draft] },
        ],
      },
      { type: "folder", $id: "en:be", name: "Backend", children: [draft] },
    ],
  };
  const area = publicPageTreeForArea(tree, "fe", new Set([published.url]));
  expect(area.name).toBe("Frontend");
  expect(area.children).toEqual([
    { type: "folder", name: "Index only", index: published, children: [] },
  ]);
  expect(JSON.stringify(area)).not.toContain(draft.url);
  expect(() =>
    publicPageTreeForArea(tree, "be", new Set([published.url])),
  ).toThrow("Missing Fumadocs page tree root");
});
