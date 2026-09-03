import { describe, expect, test } from "bun:test";
import { inflateSync } from "node:zlib";
import type { Root } from "mdast";
import { remarkKrokiUrl } from "./remark-kroki-url.ts";

function transform(tree: Root): Root {
  remarkKrokiUrl({ server: "https://example.com/" })(tree);
  return tree;
}

describe("remarkKrokiUrl", () => {
  test("creates a reversible Kroki GET URL without fetching the diagram", () => {
    const diagram = "Alice -> Bob: hello";
    const tree = transform({
      type: "root",
      children: [
        {
          type: "code",
          lang: "plantuml",
          meta: 'alt="Request flow"',
          value: diagram,
        },
      ],
    });
    const image = tree.children[0];
    const attributes =
      image?.type === "mdxJsxFlowElement" ? image.attributes : [];
    const attribute = (name: string) =>
      attributes.find(
        (item) => item.type === "mdxJsxAttribute" && item.name === name,
      );
    const url = attribute("src")?.value;
    if (typeof url !== "string") throw new Error("Kroki URL is missing");
    const encoded = url.split("/").at(-1);

    expect(encoded).toBeDefined();
    expect(
      inflateSync(Buffer.from(encoded ?? "", "base64url")).toString("utf8"),
    ).toBe(diagram);
    expect(image).toMatchObject({
      attributes: expect.arrayContaining([
        { name: "alt", type: "mdxJsxAttribute", value: "Request flow" },
        {
          name: "src",
          type: "mdxJsxAttribute",
          value: expect.stringMatching(
            /^https:\/\/example\.com\/plantuml\/svg\/[A-Za-z0-9_-]+$/u,
          ),
        },
        { name: "loading", type: "mdxJsxAttribute", value: "lazy" },
      ]),
      children: [],
      name: "img",
      type: "mdxJsxFlowElement",
    });
  });

  test("leaves unrelated code blocks unchanged", () => {
    const code = {
      type: "code" as const,
      lang: "typescript",
      value: "const value = 1;",
    };
    const tree = transform({ type: "root", children: [code] });

    expect(tree.children[0]).toEqual(code);
  });

  test("normalizes existing Kroki Markdown images without changing their URL", () => {
    const url = "https://example.com/plantuml/svg/already-encoded";
    const tree = transform({
      type: "root",
      children: [{ type: "image", alt: "Existing diagram", url }],
    });

    expect(tree.children[0]).toMatchObject({
      attributes: expect.arrayContaining([
        {
          name: "alt",
          type: "mdxJsxAttribute",
          value: "Existing diagram",
        },
        { name: "src", type: "mdxJsxAttribute", value: url },
      ]),
      name: "img",
      type: "mdxJsxFlowElement",
    });
  });
});
