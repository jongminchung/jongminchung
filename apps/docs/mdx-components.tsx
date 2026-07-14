import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Link } from "@astryxdesign/core/Link";
import type { MDXComponents } from "mdx/types";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { DeprecatedBanner } from "@/components/DeprecatedBanner";
import {
  KnowledgePath,
  OverviewCards,
  OverviewCta,
  OverviewHero,
  QuickStart,
} from "@/components/OverviewBlocks";

interface CodeElementProps {
  readonly children?: ReactNode;
  readonly className?: string;
}

function MdxPre({ children }: ComponentProps<"pre">) {
  if (!isValidElement<CodeElementProps>(children)) return <pre>{children}</pre>;
  const code = typeof children.props.children === "string" ? children.props.children.trimEnd() : "";
  const language = children.props.className?.replace("language-", "") ?? "text";
  return <CodeBlock code={code} language={language} hasCopyButton hasLanguageLabel width="100%" />;
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
  DeprecatedBanner,
  KnowledgePath,
  OverviewCards,
  OverviewCta,
  OverviewHero,
  QuickStart,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
