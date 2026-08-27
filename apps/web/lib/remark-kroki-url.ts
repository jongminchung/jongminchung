import { deflateSync } from "node:zlib";
import type { Code, Image, Root } from "mdast";
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
      const image: Image = {
        type: "image",
        alt: codeBlockAlt(node.meta),
        url: `${baseUrl}/plantuml/svg/${encodeKrokiDiagram(node.value)}`,
      };
      parent.children[index] = image;
    });
  };
}
