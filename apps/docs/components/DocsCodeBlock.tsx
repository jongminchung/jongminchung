import { CodeBlock } from "@astryxdesign/core/CodeBlock";

export function DocsCodeBlock({
  code,
  language,
}: {
  readonly code: string;
  readonly language: string;
}) {
  return (
    <CodeBlock
      className="docs-code-block"
      code={code}
      language={language}
      hasCopyButton
      hasLanguageLabel={false}
      isWrapped={false}
      width="100%"
    />
  );
}
