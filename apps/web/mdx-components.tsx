import { cn } from "@jongminchung/ui/lib/utils";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps } from "react";
import { FootnoteReference } from "#components/FootnoteReference";
import { investmentMdxComponents } from "#invest-components/mdx-components";
import { docsMdxComponents } from "#tech-components/mdx-components";

function MdxLink({ href = "", children, ...props }: ComponentProps<"a">) {
  if ("data-footnote-ref" in props) {
    return (
      <FootnoteReference {...props} href={href}>
        {children}
      </FootnoteReference>
    );
  }

  const isExternal = href.startsWith("http://") || href.startsWith("https://");
  return (
    <Link
      {...props}
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer" : undefined}
    >
      {children}
    </Link>
  );
}

function BlogMdxHeading2({
  children,
  className,
  ...props
}: ComponentProps<"h2">) {
  return (
    <h2
      {...props}
      className={cn(
        "mt-14 mb-5 scroll-mt-20 text-[28px] leading-[1.35] font-semibold tracking-[-.023em]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function BlogMdxHeading3({
  children,
  className,
  ...props
}: ComponentProps<"h3">) {
  return (
    <h3
      {...props}
      className={cn(
        "mt-11 mb-4 scroll-mt-20 text-[22px] leading-[1.4] font-semibold tracking-[-.01em]",
        className,
      )}
    >
      {children}
    </h3>
  );
}

function BlogMdxParagraph({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      {...props}
      className={cn("mt-0 mb-4 text-[16px] leading-7", className)}
    />
  );
}

function BlogMdxUnorderedList({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      {...props}
      className={cn(
        "mt-0 mb-6 pl-[26px] text-[16px] leading-7 [&>li]:pl-1.5 [&>li]:marker:text-border [&>li+li]:mt-2",
        className,
      )}
    />
  );
}

function BlogMdxOrderedList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      {...props}
      className={cn(
        "mt-0 mb-6 pl-[26px] text-[16px] leading-7 [&>li]:pl-1.5 [&>li+li]:mt-2",
        className,
      )}
    />
  );
}

function BlogMdxBlockquote({
  className,
  ...props
}: ComponentProps<"blockquote">) {
  return (
    <blockquote
      {...props}
      className={cn(
        "my-7 border-l-4 border-input bg-transparent py-0 pl-4 text-[16px] leading-7 text-foreground [&>p:last-child]:mb-0",
        className,
      )}
    />
  );
}

export const mdxComponents = {
  a: MdxLink,
  ...docsMdxComponents,
  ...investmentMdxComponents,
} satisfies MDXComponents;

/** Tech Blog와 Invest Note에만 적용되는 장문 읽기 리듬을 제공함 */
export const blogMdxComponents = {
  ...mdxComponents,
  blockquote: BlogMdxBlockquote,
  h2: BlogMdxHeading2,
  h3: BlogMdxHeading3,
  ol: BlogMdxOrderedList,
  p: BlogMdxParagraph,
  ul: BlogMdxUnorderedList,
} satisfies MDXComponents;

/** `useMDXComponents` 훅 상태와 제어 함수를 제공함 */
export function useMDXComponents(): MDXComponents {
  return mdxComponents;
}
