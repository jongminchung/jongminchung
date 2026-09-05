"use client";

import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@jongminchung/ui/components/preview-card";
import {
  type ComponentProps,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import {
  createFootnotePreviewHtml,
  footnotePreviewLabel,
} from "#lib/footnote-preview";

/** 각주 이동을 유지하면서 데스크톱 미리보기를 제공함 */
export function FootnoteReference({
  href = "",
  id,
  children,
  onKeyDown,
  ...props
}: ComponentProps<"a">) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{
    readonly html: string;
    readonly label: string;
  } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen && preview === null) {
      const html = createFootnotePreviewHtml(href);
      if (html !== null)
        setPreview({
          html,
          label: footnotePreviewLabel(document.documentElement.lang),
        });
    }
    setOpen(nextOpen);
  };

  const restoreFocusedPreview = useEffectEvent(() => {
    const focused = document.activeElement;
    if (focused?.id === triggerId && focused.matches(":focus-visible"))
      changeOpen(true);
  });
  useEffect(() => {
    // HTML에 먼저 도달한 키보드 초점은 hydration 이후 focus 이벤트를 다시 보내지 않는다.
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize DOM focus established before React hydrated; it cannot be derived from props.
    restoreFocusedPreview();
  }, []);

  return (
    <PreviewCard open={open} onOpenChange={changeOpen} triggerId={triggerId}>
      <PreviewCardTrigger
        {...props}
        href={href}
        id={triggerId}
        closeDelay={150}
        delay={150}
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
