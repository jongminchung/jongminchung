import { cn } from "@jongminchung/ui/lib/utils";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps } from "react";
import { FootnoteReference } from "#components/FootnoteReference";
import { investmentMdxComponents } from "#invest-components/mdx-components";
import {
  docsMdxTypographyComponents,
  sharedMdxContentComponents,
} from "#tech-components/mdx-components";

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

function ArticleMdxHeading2({
  children,
  className,
  ...props
}: ComponentProps<"h2">) {
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

function ArticleMdxHeading3({
  children,
  className,
  ...props
}: ComponentProps<"h3">) {
  return (
    <h3
      {...props}
      className={cn(
        "mt-10 mb-3 scroll-mt-20 text-[20px] leading-[1.4] font-semibold tracking-[-.01em]",
        className,
      )}
    >
      {children}
    </h3>
  );
}

/** 모든 콘텐츠 유형이 공유하는 링크·코드·표·목록 semantics를 제공함 */
export const sharedMdxComponents = {
  a: MdxLink,
  ...sharedMdxContentComponents,
} satisfies MDXComponents;

/** 빠른 탐색과 실행을 위한 Docs MDX 구성을 제공함 */
export const docsMdxComponents = {
  ...sharedMdxComponents,
  ...docsMdxTypographyComponents,
} satisfies MDXComponents;

/** Tech Blog와 Invest Note의 장문 읽기 리듬을 제공함 */
export const articleMdxComponents = {
  ...sharedMdxComponents,
  ...investmentMdxComponents,
  h2: ArticleMdxHeading2,
  h3: ArticleMdxHeading3,
} satisfies MDXComponents;

/** `useMDXComponents` 훅 상태와 제어 함수를 제공함 */
export function useMDXComponents(): MDXComponents {
  return docsMdxComponents;
}
