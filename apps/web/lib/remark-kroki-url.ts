import { deflateSync } from "node:zlib";
import type { Code, Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";

export interface KrokiUrlOptions {
  readonly server?: string;
}

function codeBlockAlt(meta: string | null | undefined): string {
  const match = /(?:^|\s)alt=(?:"([^"]*)"|'([^']*)'|`([^`]*)`|(\S+))/u.exec(
    meta ?? "",
  );
  return (
    match?.slice(1).find((value) => value !== undefined) ?? "PlantUML diagram"
  );
}

/** Kroki GET API가 요구하는 deflate·base64url 형식으로 다이어그램을 인코딩함 */
export function encodeKrokiDiagram(source: string): string {
  return deflateSync(Buffer.from(source, "utf8"), { level: 9 }).toString(
    "base64url",
  );
}

function krokiImage(alt: string, url: string): MdxJsxFlowElement {
  return {
    type: "mdxJsxFlowElement",
    name: "img",
    attributes: [
      { type: "mdxJsxAttribute", name: "alt", value: alt },
      { type: "mdxJsxAttribute", name: "src", value: url },
      { type: "mdxJsxAttribute", name: "loading", value: "lazy" },
    ],
    children: [],
  };
}

/** PlantUML 코드 블록을 빌드 네트워크 호출이 없는 Kroki 이미지 URL로 변환함 */
export function remarkKrokiUrl({
  server = "https://kroki.io",
}: KrokiUrlOptions = {}) {
  const baseUrl = server.replace(/\/+$/u, "");

  return (tree: Root): void => {
    visit(tree, "code", (node: Code, index, parent) => {
      if (
        node.lang !== "plantuml" ||
        index === undefined ||
        parent === undefined
      )
        return;
      parent.children[index] = krokiImage(
        codeBlockAlt(node.meta),
        `${baseUrl}/plantuml/svg/${encodeKrokiDiagram(node.value)}`,
      );
    });
    visit(tree, "image", (node, index, parent) => {
      if (
        !node.url.startsWith(`${baseUrl}/`) ||
        index === undefined ||
        parent === undefined
      )
        return;
      parent.children[index] = krokiImage(
        node.alt ?? "PlantUML diagram",
        node.url,
      );
    });
  };
}
