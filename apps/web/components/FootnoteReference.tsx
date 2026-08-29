"use client";

import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@jongminchung/ui/components/preview-card";
import { type ComponentProps, useRef, useState } from "react";
import {
  createFootnotePreviewHtml,
  footnotePreviewLabel,
} from "#lib/footnote-preview";

/** 각주 이동을 유지하면서 데스크톱 미리보기를 제공함 */
export function FootnoteReference({
  href = "",
  children,
  onFocus,
  onKeyDown,
  onMouseEnter,
  ...props
}: ComponentProps<"a">) {
  const [preview, setPreview] = useState<{
    readonly html: string;
    readonly label: string;
  } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const loadPreview = () => {
    if (preview !== null) return;
    const html = createFootnotePreviewHtml(href);
    if (html !== null)
      setPreview({
        html,
        label: footnotePreviewLabel(document.documentElement.lang),
      });
  };

  return (
    <PreviewCard>
      <PreviewCardTrigger
        {...props}
        href={href}
        closeDelay={150}
        delay={150}
        onFocus={(event) => {
          onFocus?.(event);
          loadPreview();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "Tab" || event.shiftKey)
            return;
          if (!previewRef.current?.matches("[data-open]")) return;
          const firstLink =
            previewRef.current?.querySelector<HTMLAnchorElement>("a[href]");
          if (firstLink === undefined || firstLink === null) return;
          event.preventDefault();
          firstLink.focus();
        }}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          loadPreview();
        }}
      >
        {children}
      </PreviewCardTrigger>
      <PreviewCardContent
        ref={previewRef}
        aria-label={preview?.label}
        className="[&_a]:font-medium [&_a]:text-inherit [&_a]:underline [&_a]:decoration-background/55 [&_a]:underline-offset-2 [&_code]:rounded-sm [&_code]:bg-background/15 [&_code]:px-1 [&_p]:m-0"
        data-footnote-preview="true"
        dangerouslySetInnerHTML={{ __html: preview?.html ?? "" }}
        role="region"
      />
    </PreviewCard>
  );
}
