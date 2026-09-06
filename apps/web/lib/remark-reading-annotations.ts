import type { Root } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";

const elementNames: Readonly<Record<string, string>> = {
  mark: "Highlight",
  details: "Details",
  summary: "Summary",
  dl: "Glossary",
  dt: "Term",
  dd: "Definition",
};

const titles = {
  NOTE: { en: "Note", ko: "참고" },
  TIP: { en: "Tip", ko: "팁" },
  IMPORTANT: { en: "Important", ko: "중요" },
  WARNING: { en: "Warning", ko: "주의" },
  CAUTION: { en: "Caution", ko: "경고" },
} as const;

/** GitHub 알림과 HTML mark를 공유 MDX 컴포넌트로 연결함. 코드·일반 인용문은 보존함. */
export function remarkReadingAnnotations() {
  return (tree: Root, file: { path?: string }): void => {
    const locale = /(?:^|[/\\])ko(?:[/\\])/u.test(file.path ?? "")
      ? "ko"
      : "en";
    visit(tree, (node, index, parent) => {
      if (
        (node.type === "mdxJsxTextElement" ||
          node.type === "mdxJsxFlowElement") &&
        node.name !== null &&
        elementNames[node.name] !== undefined
      ) {
        node.name = elementNames[node.name] ?? node.name;
      }
      if (node.type !== "blockquote" || index === undefined || !parent) return;
      const paragraph = node.children[0];
      const first =
        paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
      if (first?.type !== "text") return;
      const match =
        /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:[ \t]*\r?\n|[ \t]*$)/u.exec(
          first.value,
        );
      if (!match) return;
      const kind = match[1] as keyof typeof titles;
      first.value = first.value.slice(match[0].length);
      if (!first.value && paragraph?.type === "paragraph")
        paragraph.children.shift();
      if (paragraph?.type === "paragraph" && paragraph.children.length === 0)
        node.children.shift();
      const alert: MdxJsxFlowElement = {
        type: "mdxJsxFlowElement",
        name: "MarkdownAlert",
        attributes: [
          { type: "mdxJsxAttribute", name: "kind", value: kind.toLowerCase() },
          {
            type: "mdxJsxAttribute",
            name: "title",
            value: titles[kind][locale],
          },
        ],
        children: node.children,
      };
      parent.children[index] = alert;
    });
  };
}

/** 직접 쓴 JSX 텍스트도 색인에 포함하되 중첩 문단·제목은 기존 순회에 맡김. */
export const readingStructureOptions = {
  mdxTypes(node: MdxJsxFlowElement | MdxJsxTextElement): boolean {
    if (node.children.length === 0) return true;
    return (
      ["Summary", "Term", "Definition", "CodeNote", "ComparisonItem"].includes(
        node.name ?? "",
      ) &&
      node.children.every((child) =>
        [
          "text",
          "emphasis",
          "strong",
          "delete",
          "inlineCode",
          "link",
          "break",
          "mdxJsxTextElement",
        ].includes(child.type),
      )
    );
  },
};
