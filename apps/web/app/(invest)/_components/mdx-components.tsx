import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";

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

export const investmentMdxComponents = {
    SourceSummary,
    JamieNotes,
} satisfies MDXComponents;
