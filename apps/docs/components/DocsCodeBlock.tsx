"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

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
    <div className="docs-code-block" data-language={language}>
      <pre role="group" tabIndex={0} aria-label={`${language} code`}>
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "Copied" : "Copy code"}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
    </div>
  );
}
