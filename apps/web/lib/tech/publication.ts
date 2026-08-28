import type { Folder, Node, Root } from "fumadocs-core/page-tree";
import type { PublicationStatus } from "../content-contracts.ts";

export interface PublicationMetadata {
  readonly publicationStatus: PublicationStatus;
}

/** 공개 가능한 Tech content인지 판별함 */
export function isPublishedContent<T extends PublicationMetadata>(
  value: T,
): value is T & Readonly<{ publicationStatus: "published" }> {
  return value.publicationStatus === "published";
}

/** source collection에서 공개 가능한 Tech content만 선택함 */
export function publishedContentOnly<T extends PublicationMetadata>(
  values: readonly T[],
): readonly T[] {
  return Object.freeze(values.filter(isPublishedContent));
}

function publicNodes(
  nodes: readonly Node[],
  publicUrls: ReadonlySet<string>,
): Node[] {
  const output: Node[] = [];
  for (const node of nodes) {
    if (node.type === "page") {
      if (publicUrls.has(node.url)) output.push(node);
      continue;
    }
    if (node.type === "separator") {
      output.push(node);
      continue;
    }
    const children = publicNodes(node.children, publicUrls);
    const index =
      node.index !== undefined && publicUrls.has(node.index.url)
        ? node.index
        : undefined;
    if (children.length === 0 && index === undefined) continue;
    output.push({ ...node, children, index } satisfies Folder);
  }
  return output;
}

/** Fumadocs page tree에서 비공개 page와 빈 folder를 제거함 */
export function publicPageTree(
  tree: Root,
  publicUrls: ReadonlySet<string>,
): Root {
  return {
    ...tree,
    children: publicNodes(tree.children, publicUrls),
    fallback:
      tree.fallback === undefined
        ? undefined
        : publicPageTree(tree.fallback, publicUrls),
  };
}
