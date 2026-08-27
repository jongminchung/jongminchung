import {
  CodeBlock,
  Pre,
  type CodeBlockProps,
} from "fumadocs-ui/components/codeblock";
import type { ReactNode } from "react";

/** Fumadocs CodeBlock으로 Shiki 결과와 복사·제목·라인 메타데이터를 보존함 */
export function DocsCodeBlock({
  children,
  ...props
}: Omit<CodeBlockProps, "children"> & { readonly children?: ReactNode }) {
  return (
    <CodeBlock {...props} data-docs-code-block="true">
      <Pre className="[&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
        {children}
      </Pre>
    </CodeBlock>
  );
}
