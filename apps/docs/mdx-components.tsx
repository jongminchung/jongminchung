import { Link } from "@astryxdesign/core/Link";
import type { MDXComponents } from "mdx/types";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { DocsCodeBlock } from "./components/DocsCodeBlock";
import { ExcalidrawDiagram } from "./components/ExcalidrawDiagram";
import { OverviewCards, OverviewCta, OverviewHero, QuickStart } from "./components/OverviewBlocks";
import { classifyMdxCodeBlock } from "./lib/mdx-code";

interface CodeElementProps {
  readonly children?: ReactNode;
  readonly className?: string;
}

export function MdxPre({ children }: ComponentProps<"pre">) {
  if (!isValidElement<CodeElementProps>(children)) return <pre>{children}</pre>;
  const block = classifyMdxCodeBlock(children.props.className, children.props.children);
  if (block.kind === "excalidraw") {
    return <ExcalidrawDiagram source={block.source} />;
  }
  return <DocsCodeBlock code={block.source} language={block.language} />;
}

function MdxLink({ href = "", children }: ComponentProps<"a">) {
  const isExternal = href.startsWith("http://") || href.startsWith("https://");
  return (
    <Link href={href} isExternalLink={isExternal} hasUnderline>
      {children}
    </Link>
  );
}

const components = {
  a: MdxLink,
  pre: MdxPre,
  ExcalidrawDiagram,
  OverviewCards,
  OverviewCta,
  OverviewHero,
  QuickStart,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
