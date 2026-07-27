"use client";

import { Button } from "@base-ui/react/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function DocsCodeBlock({
  code,
  language,
}: {
  readonly code: string;
  readonly language: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };
  return (
    <div className="docs-code-block group" data-language={language}>
      <pre role="group" tabIndex={0} aria-label={`${language} code`}>
        <code>{code}</code>
      </pre>
      <Button
        aria-label={copied ? "Copied" : "Copy code"}
        className={cn(
          "absolute top-2 right-2 grid size-[30px] place-items-center rounded-sm border border-border bg-card p-0 text-muted-foreground opacity-0 outline-none disabled:pointer-events-none disabled:opacity-50",
          "transition-opacity duration-[var(--duration-fast)] ease-out group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none",
          "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
        )}
        data-slot="button"
        onClick={() => void copy()}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
    </div>
  );
}
