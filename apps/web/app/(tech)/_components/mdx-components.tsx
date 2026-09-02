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
import { ExcalidrawAssetDiagram } from "./ExcalidrawAssetDiagram";
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

/** Blog와 Docs에서 사용하는 코드 블록을 렌더링함 */
function SharedMdxPre({
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

function DocsMdxHeading2({
  children,
  className,
  ...props
}: ComponentProps<"h2">) {
  return (
    <h2
      {...props}
      className={cn(
        "mt-7 mb-2 scroll-mt-20 text-[20px] leading-[26px] font-semibold tracking-[-.01em]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function DocsMdxHeading3({
  children,
  className,
  ...props
}: ComponentProps<"h3">) {
  return (
    <h3
      {...props}
      className={cn(
        "mt-7 mb-2 scroll-mt-20 text-[18px] leading-6 font-semibold tracking-[-.01em]",
        className,
      )}
    >
      {children}
    </h3>
  );
}

function SharedMdxParagraph({ className, ...props }: ComponentProps<"p">) {
  return <p {...props} className={cn("mt-0 mb-4", className)} />;
}

function SharedMdxUnorderedList({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      {...props}
      className={cn(
        "mt-0 mb-6 list-disc pl-[26px] [&:lang(en)>li]:leading-[1.6] [&:lang(ko)>li]:leading-7 [&:lang(ko)>li+li]:mt-2 [&>li]:my-0 [&>li]:pl-1.5 [&>li]:marker:text-border",
        className,
      )}
    />
  );
}

function SharedMdxOrderedList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      {...props}
      className={cn(
        "mt-0 mb-6 list-decimal pl-[26px] [&:lang(en)>li]:leading-[1.6] [&:lang(ko)>li]:leading-7 [&:lang(ko)>li+li]:mt-2 [&>li]:my-0 [&>li]:pl-1.5 [&>li]:marker:text-muted-foreground",
        className,
      )}
    />
  );
}

function SharedMdxBlockquote({
  className,
  ...props
}: ComponentProps<"blockquote">) {
  return (
    <blockquote
      {...props}
      className={cn(
        "my-7 border-l-4 border-input bg-transparent py-0 pl-4 text-foreground [&>p:last-child]:mb-0",
        className,
      )}
    />
  );
}

export function SharedMdxTable({
  className,
  ...props
}: ComponentProps<"table">) {
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

function SharedMdxDataCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      {...props}
      className={cn("border px-3 py-2.5 text-left text-sm", className)}
    />
  );
}

function SharedMdxHeaderCell({ className, ...props }: ComponentProps<"th">) {
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

function SharedMdxDiv({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("my-4", className)} />;
}

export const sharedMdxContentComponents = {
  blockquote: SharedMdxBlockquote,
  div: SharedMdxDiv,
  ol: SharedMdxOrderedList,
  p: SharedMdxParagraph,
  pre: SharedMdxPre,
  table: SharedMdxTable,
  td: SharedMdxDataCell,
  th: SharedMdxHeaderCell,
  ul: SharedMdxUnorderedList,
  Callout,
  Card,
  Cards,
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
  ExcalidrawDiagram,
  ExcalidrawAssetDiagram,
  OverviewCards,
  OverviewCta,
  OverviewHero,
  QuickStart,
  Step,
  Steps,
} satisfies MDXComponents;

/** 빠른 탐색과 절차 확인을 위한 Docs 제목 리듬을 제공함 */
export const docsMdxTypographyComponents = {
  h2: DocsMdxHeading2,
  h3: DocsMdxHeading3,
} satisfies MDXComponents;
