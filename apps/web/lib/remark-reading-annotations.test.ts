import { describe, expect, test } from "bun:test";
import type { Root } from "mdast";
import {
  remarkReadingAnnotations,
  readingStructureOptions,
} from "./remark-reading-annotations";

function quote(text: string): Root {
  return {
    type: "root",
    children: [
      {
        type: "blockquote",
        children: [
          { type: "paragraph", children: [{ type: "text", value: text }] },
        ],
      },
    ],
  };
}

describe("MDX 읽기 주석", () => {
  for (const [kind, title] of [
    ["NOTE", "참고"],
    ["TIP", "팁"],
    ["IMPORTANT", "중요"],
    ["WARNING", "주의"],
    ["CAUTION", "경고"],
  ]) {
    test(`${kind} 표식만 제거하고 한국어 제목과 본문을 보존함`, () => {
      const tree = quote(`[!${kind}]\n본문`);
      remarkReadingAnnotations()(tree, {
        path: "/content/tech/blog/ko/example.mdx",
      });
      expect(tree.children[0]).toMatchObject({
        type: "mdxJsxFlowElement",
        name: "MarkdownAlert",
        attributes: [
          { name: "kind", value: kind?.toLowerCase() },
          { name: "title", value: title },
        ],
        children: [
          { type: "paragraph", children: [{ type: "text", value: "본문" }] },
        ],
      });
    });
  }
  test("빈 표식 문단을 제거하고 링크·목록·코드·후속 문단을 유지함", () => {
    const tree = quote("[!NOTE]");
    const node = tree.children[0];
    if (node?.type !== "blockquote") throw new Error("Expected quote");
    const content: typeof node.children = [
      {
        type: "paragraph",
        children: [
          {
            type: "link",
            url: "/en/docs",
            children: [{ type: "text", value: "Docs" }],
          },
        ],
      },
      {
        type: "list",
        ordered: false,
        children: [
          {
            type: "listItem",
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", value: "step" }],
              },
            ],
          },
        ],
      },
      { type: "code", lang: "md", value: "> [!WARNING]" },
    ];
    node.children.push(...content);
    remarkReadingAnnotations()(tree, {
      path: "content/invest/en/notes/example.mdx",
    });
    expect(tree.children[0]).toMatchObject({
      attributes: [
        { name: "kind", value: "note" },
        { name: "title", value: "Note" },
      ],
      children: content,
    });
  });
  test("일반 인용·알 수 없는 종류·동일 행 본문·코드는 변환하지 않음", () => {
    for (const text of [
      "일반 인용",
      "[!OTHER]\n본문",
      "[!NOTE] same line",
      "prefix [!NOTE]\n본문",
    ]) {
      const tree = quote(text);
      const before = structuredClone(tree);
      remarkReadingAnnotations()(tree, {});
      expect(tree).toEqual(before);
    }
  });
  test("inline/flow mark의 속성과 자식을 보존해 Highlight로 연결함", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "mdxJsxTextElement",
              name: "mark",
              attributes: [],
              children: [{ type: "text", value: "핵심" }],
            },
          ],
        },
        {
          type: "mdxJsxFlowElement",
          name: "mark",
          attributes: [],
          children: [],
        },
      ],
    };
    remarkReadingAnnotations()(tree, {});
    expect(tree.children[0]).toMatchObject({
      children: [{ name: "Highlight", children: [{ value: "핵심" }] }],
    });
    expect(tree.children[1]).toMatchObject({ name: "Highlight" });
  });
});

test("native 읽기 요소의 속성과 문서 구조를 유지함", () => {
  for (const [name, component] of [
    ["details", "Details"],
    ["summary", "Summary"],
    ["dl", "Glossary"],
    ["dt", "Term"],
    ["dd", "Definition"],
  ]) {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "mdxJsxFlowElement",
          name: name ?? null,
          attributes: [
            { type: "mdxJsxAttribute", name: "id", value: "definition" },
          ],
          children: [],
        },
      ],
    };
    remarkReadingAnnotations()(tree, {});
    expect(tree.children[0]).toMatchObject({
      name: component,
      attributes: [{ name: "id", value: "definition" }],
    });
  }
});

test("용어·직접 JSX 설명을 색인하면서 중첩 제목·문단을 가리지 않음", () => {
  const base = {
    type: "mdxJsxFlowElement" as const,
    name: "Definition",
    attributes: [],
  };
  expect(
    readingStructureOptions.mdxTypes({
      ...base,
      type: "mdxJsxTextElement",
      children: [{ type: "text", value: "용어 정의" }],
    }),
  ).toBe(true);
  expect(
    readingStructureOptions.mdxTypes({
      ...base,
      children: [
        {
          type: "heading",
          depth: 3,
          children: [{ type: "text", value: "제목" }],
        },
      ],
    }),
  ).toBe(false);
  expect(
    readingStructureOptions.mdxTypes({
      ...base,
      children: [
        { type: "paragraph", children: [{ type: "text", value: "문단" }] },
      ],
    }),
  ).toBe(false);
  expect(
    readingStructureOptions.mdxTypes({
      ...base,
      name: "Unrelated",
      type: "mdxJsxTextElement",
      children: [{ type: "text", value: "기존 동작" }],
    }),
  ).toBe(false);
});
