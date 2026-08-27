import { inflateSync } from "node:zlib";
import type { Root } from "mdast";
import { describe, expect, test } from "vitest";
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
    const url = image?.type === "image" ? image.url : "";
    const encoded = url.split("/").at(-1);

    expect(encoded).toBeDefined();
    expect(
      inflateSync(Buffer.from(encoded ?? "", "base64url")).toString("utf8"),
    ).toBe(diagram);
    expect(image).toMatchObject({
      alt: "Request flow",
      type: "image",
      url: expect.stringMatching(
        /^https:\/\/example\.com\/plantuml\/svg\/[A-Za-z0-9_-]+$/u,
      ),
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
});
