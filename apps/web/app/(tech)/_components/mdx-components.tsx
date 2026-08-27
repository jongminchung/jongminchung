import {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "fumadocs-ui/components/codeblock";
import type { MDXComponents } from "mdx/types";
import {
  isValidElement,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { classifyMdxCodeBlock } from "#lib/mdx-code";
import { DocsCodeBlock } from "./DocsCodeBlock";
import { Callout, Card, Cards, Step, Steps } from "./DocsMdxPrimitives";
import { ExcalidrawDiagram } from "./ExcalidrawDiagram";
import {
  OverviewCards,
  OverviewCta,
  OverviewHero,
  QuickStart,
} from "./OverviewBlocks";

interface CodeElementProps {
  readonly children?: ReactNode;
  readonly className?: string;
}

/** `TechMdxPre` 기술 문서 코드 블록을 렌더링함 */
export function TechMdxPre({
  ref: _ref,
  children,
  ...props
}: ComponentProps<"pre">) {
  if (isValidElement<CodeElementProps>(children)) {
    const block = classifyMdxCodeBlock(
      children.props.className,
      children.props.children,
    );
    if (block.kind === "excalidraw") {
      return <ExcalidrawDiagram source={block.source} />;
    }
  }
  return <DocsCodeBlock {...props}>{children}</DocsCodeBlock>;
}

function MdxHeading2({ children, className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      {...props}
      className={`scroll-mt-6 text-[32px] leading-[1.2] font-medium tracking-[-.02em] ${className ?? ""}`}
    >
      {children}
    </h2>
  );
}

function MdxHeading3({ children, className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      {...props}
      className={`scroll-mt-6 text-2xl leading-[1.25] font-medium tracking-[-.012em] ${className ?? ""}`}
    >
      {children}
    </h3>
  );
}

function MdxParagraph(props: ComponentProps<"p">) {
  return <p className="my-4 text-sm leading-[1.4rem]" {...props} />;
}

function MdxUnorderedList(props: ComponentProps<"ul">) {
  return <ul className="my-4 pl-6 text-sm leading-[1.4rem]" {...props} />;
}

function MdxOrderedList(props: ComponentProps<"ol">) {
  return <ol className="my-4 pl-6 text-sm leading-[1.4rem]" {...props} />;
}

function MdxBlockquote(props: ComponentProps<"blockquote">) {
  return (
    <blockquote
      className="my-4 border-l-[3px] border-input bg-muted px-[18px] py-[14px] text-sm leading-[1.4rem] text-muted-foreground"
      {...props}
    />
  );
}

function MdxTable(props: ComponentProps<"table">) {
  return (
    <table
      className="my-4 block w-full border-collapse overflow-x-auto text-sm"
      {...props}
    />
  );
}

function MdxDataCell(props: ComponentProps<"td">) {
  return <td className="border px-3 py-2.5 text-left text-sm" {...props} />;
}

function MdxHeaderCell(props: ComponentProps<"th">) {
  return (
    <th
      className="border bg-muted px-3 py-2.5 text-left text-sm font-semibold"
      {...props}
    />
  );
}

function MdxDiv(props: HTMLAttributes<HTMLDivElement>) {
  return <div className="my-4" {...props} />;
}

export const techMdxComponents = {
  blockquote: MdxBlockquote,
  div: MdxDiv,
  h2: MdxHeading2,
  h3: MdxHeading3,
  ol: MdxOrderedList,
  p: MdxParagraph,
  pre: TechMdxPre,
  table: MdxTable,
  td: MdxDataCell,
  th: MdxHeaderCell,
  ul: MdxUnorderedList,
  Callout,
  Card,
  Cards,
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
  ExcalidrawDiagram,
  OverviewCards,
  OverviewCta,
  OverviewHero,
  QuickStart,
  Step,
  Steps,
} satisfies MDXComponents;
