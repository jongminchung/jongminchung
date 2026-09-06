import { readFileSync } from "node:fs";
import type { Root } from "mdast";

/** Preserve the author input before any MDX transforms; never read files at runtime. */
export function remarkReadingSource() {
  return (tree: Root, file: { value: unknown; path?: string }): void => {
    // Fumadocs replaces frontmatter with padding before remark runs. Read the
    // build input here to preserve exact whitespace; only the export ships.
    const input = file.path
      ? readFileSync(file.path, "utf8")
      : String(file.value);
    const source = input.replace(
      /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[^\S\r\n]*(?:\r?\n|$)/u,
      "",
    );
    tree.children.push({
      type: "mdxjsEsm",
      value: `export const readingSource = ${JSON.stringify(source)};`,
      data: {
        estree: {
          type: "Program",
          sourceType: "module",
          body: [
            {
              type: "ExportNamedDeclaration",
              specifiers: [],
              attributes: [],
              source: null,
              declaration: {
                type: "VariableDeclaration",
                kind: "const",
                declarations: [
                  {
                    type: "VariableDeclarator",
                    id: { type: "Identifier", name: "readingSource" },
                    init: { type: "Literal", value: source },
                  },
                ],
              },
            },
          ],
        },
      },
    });
  };
}
