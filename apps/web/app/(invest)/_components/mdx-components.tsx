import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";

function SourceSummary({ children }: { readonly children: ReactNode }) {
  return (
    <section
      className="my-12 border border-l-[.35rem] border-l-accent bg-card p-[clamp(1.25rem,3vw,2rem)]"
      aria-labelledby="source-summary-title"
    >
      <p
        className="mb-4 font-mono text-[.72rem] font-bold tracking-[.1em] text-primary uppercase"
        id="source-summary-title"
      >
        Source summary
      </p>
      {children}
    </section>
  );
}

function JamieNotes({ children }: { readonly children: ReactNode }) {
  return (
    <section
      className="my-12 border border-l-[.35rem] border-l-primary bg-card p-[clamp(1.25rem,3vw,2rem)]"
      aria-labelledby="jamie-notes-title"
    >
      <p
        className="mb-4 font-mono text-[.72rem] font-bold tracking-[.1em] text-primary uppercase"
        id="jamie-notes-title"
      >
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
