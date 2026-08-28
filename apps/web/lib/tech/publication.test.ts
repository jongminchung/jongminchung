import type { Root } from "fumadocs-core/page-tree";
import { describe, expect, it } from "vitest";
import { publicPageTree, publishedContentOnly } from "./publication.ts";

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
