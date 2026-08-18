import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps } from "react";
import { investmentMdxComponents } from "#invest-components/mdx-components";
import { techMdxComponents } from "#tech-components/mdx-components";

function MdxLink({ href = "", children, ...props }: ComponentProps<"a">) {
    const isExternal =
        href.startsWith("http://") || href.startsWith("https://");
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

const components = {
    a: MdxLink,
    ...techMdxComponents,
    ...investmentMdxComponents,
} satisfies MDXComponents;

/** `useMDXComponents` 훅 상태와 제어 함수를 제공함 */
export function useMDXComponents(): MDXComponents {
    return components;
}
