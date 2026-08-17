import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { DocsCodeBlock } from "./components/DocsCodeBlock";
import { ExcalidrawDiagram } from "./components/ExcalidrawDiagram";
import { MaterialDemo } from "./components/materials/MaterialDemo";
import {
    MaterialImage,
    MaterialVideo,
} from "./components/materials/MaterialMedia";
import {
    OverviewCards,
    OverviewCta,
    OverviewHero,
    QuickStart,
} from "./components/OverviewBlocks";
import { classifyMdxCodeBlock } from "./lib/mdx-code";

interface CodeElementProps {
    readonly children?: ReactNode;
    readonly className?: string;
}

function SourceSummary({ children }: { readonly children: ReactNode }) {
    return (
        <section
            className="investment-source-summary"
            aria-labelledby="source-summary-title"
        >
            <p className="investment-section-label" id="source-summary-title">
                Source summary
            </p>
            {children}
        </section>
    );
}

function JamieNotes({ children }: { readonly children: ReactNode }) {
    return (
        <section
            className="investment-jamie-notes"
            aria-labelledby="jamie-notes-title"
        >
            <p className="investment-section-label" id="jamie-notes-title">
                Jamie&apos;s notes
            </p>
            {children}
        </section>
    );
}

export function MdxPre({ children }: ComponentProps<"pre">) {
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

function MdxLink({ href = "", children }: ComponentProps<"a">) {
    const isExternal =
        href.startsWith("http://") || href.startsWith("https://");
    return (
        <Link
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
    pre: MdxPre,
    ExcalidrawDiagram,
    MaterialDemo,
    MaterialImage,
    MaterialVideo,
    OverviewCards,
    OverviewCta,
    OverviewHero,
    QuickStart,
    SourceSummary,
    JamieNotes,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
    return components;
}
