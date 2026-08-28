import {
  CodeBlock,
  Pre,
  type CodeBlockProps,
} from "fumadocs-ui/components/codeblock";
import { useId, type ReactNode } from "react";

/** Fumadocs CodeBlock으로 Shiki 결과와 복사·제목·라인 메타데이터를 보존함 */
export function DocsCodeBlock({
  children,
  title,
  viewportProps,
  ...props
}: Omit<CodeBlockProps, "children"> & { readonly children?: ReactNode }) {
  const regionId = useId();
  const regionLabel =
    typeof title === "string"
      ? `Code block: ${title} (${regionId})`
      : `Code block ${regionId}`;
  return (
    <CodeBlock
      {...props}
      data-docs-code-block="true"
      title={title}
      viewportProps={{ "aria-label": regionLabel, ...viewportProps }}
    >
      <Pre className="[&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
        {children}
      </Pre>
    </CodeBlock>
  );
}
