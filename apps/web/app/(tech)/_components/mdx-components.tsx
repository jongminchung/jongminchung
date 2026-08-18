import type { MDXComponents } from "mdx/types";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { classifyMdxCodeBlock } from "#lib/mdx-code";
import { DocsCodeBlock } from "./DocsCodeBlock";
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
export function TechMdxPre({ children }: ComponentProps<"pre">) {
    if (!isValidElement<CodeElementProps>(children))
        return <pre>{children}</pre>;
    const block = classifyMdxCodeBlock(
        children.props.className,
        children.props.children,
    );
    if (block.kind === "excalidraw") {
        return <ExcalidrawDiagram source={block.source} />;
    }
    return <DocsCodeBlock code={block.source} language={block.language} />;
}

export const techMdxComponents = {
    pre: TechMdxPre,
    ExcalidrawDiagram,
    OverviewCards,
    OverviewCta,
    OverviewHero,
    QuickStart,
} satisfies MDXComponents;
