import { describe, expect, test } from "bun:test";
import type { Root } from "mdast";
import { remarkReadingSource } from "./remark-reading-source";

describe("reading source export", () => {
  for (const newline of ["\n", "\r\n"]) {
    test(`removes only frontmatter (${JSON.stringify(newline)})`, () => {
      const body =
        "\n<mark>Keep JSX</mark>\n\n> [!TIP]\n> Keep markers\n\n```ts\nconst value = 1; // [!code ++]\n```\n\n---\n";
      const tree: Root = { type: "root", children: [] };
      remarkReadingSource()(tree, {
        value: ["---", 'title: "Example"', "---", body].join(newline),
      });
      expect(tree.children[0]).toMatchObject({
        type: "mdxjsEsm",
        value: `export const readingSource = ${JSON.stringify(body)};`,
      });
    });
  }
  test("preserves a copied body without frontmatter", () => {
    const source =
      "<details>\n<summary>Why?</summary>\n\nBecause.\n\n</details>\n";
    const tree: Root = { type: "root", children: [] };
    remarkReadingSource()(tree, { value: source });
    expect(tree.children[0]).toMatchObject({
      value: `export const readingSource = ${JSON.stringify(source)};`,
    });
  });
});
