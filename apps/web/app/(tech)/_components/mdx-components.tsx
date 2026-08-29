import { cn } from "@jongminchung/ui/lib/utils";
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

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Horizontal table scrollers need Safari keyboard access. */

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
      className={cn(
        "mt-[52px] mb-[26px] scroll-mt-20 text-[26px] leading-[1.5] font-semibold tracking-[-.023em]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function MdxHeading3({ children, className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      {...props}
      className={cn(
        "mt-10 mb-3 scroll-mt-20 text-xl leading-[1.3] font-semibold tracking-[-.01em]",
        className,
      )}
    >
      {children}
    </h3>
  );
}

function MdxParagraph({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      {...props}
      className={cn("mt-0 mb-4 text-base leading-[1.6]", className)}
    />
  );
}

function MdxUnorderedList({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      {...props}
      className={cn(
        "mt-0 mb-6 pl-[26px] text-base leading-[1.6] [&>li]:pl-1.5",
        className,
      )}
    />
  );
}

function MdxOrderedList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      {...props}
      className={cn(
        "mt-0 mb-6 pl-[26px] text-base leading-[1.6] [&>li]:pl-1.5",
        className,
      )}
    />
  );
}

function MdxBlockquote({ className, ...props }: ComponentProps<"blockquote">) {
  return (
    <blockquote
      {...props}
      className={cn(
        "my-[1.6rem] border-l-4 border-input bg-transparent py-0 pl-4 text-base leading-[1.6] text-foreground [&>p:last-child]:mb-0",
        className,
      )}
    />
  );
}

export function MdxTable({ className, ...props }: ComponentProps<"table">) {
  return (
    <div
      className="my-6 w-full max-w-full overflow-x-auto overscroll-x-contain"
      data-docs-table-scroll="true"
      tabIndex={0}
    >
      <table
        {...props}
        className={cn(
          "w-full min-w-[560px] border-collapse text-sm max-[680px]:text-[13px] [&_td:first-child]:whitespace-nowrap [&_th]:whitespace-nowrap",
          className,
        )}
      />
    </div>
  );
}

function MdxDataCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      {...props}
      className={cn("border px-3 py-2.5 text-left text-sm", className)}
    />
  );
}

function MdxHeaderCell({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      {...props}
      className={cn(
        "border bg-muted px-3 py-2.5 text-left text-sm font-semibold",
        className,
      )}
    />
  );
}

function MdxDiv({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("my-4", className)} />;
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
