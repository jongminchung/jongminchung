"use client";

import { cn } from "@jongminchung/ui/lib/utils";
import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import { PanelLeft } from "lucide-react";
import type { Locale } from "#lib/content-model";
import { getTechMessages } from "#lib/tech/copy";

/** Editorial header 아래에서 Fumadocs mobile sidebar를 여는 비-landmark control을 렌더링함 */
export function TechDocsMobileHeader({ locale }: { readonly locale: Locale }) {
  const { slots } = useDocsLayout();
  const SidebarTrigger = slots.sidebar.trigger;
  const text = getTechMessages(locale).docs;
  return (
    <div
      aria-label={text.mobileNavigation}
      className={cn(
        "bg-fd-background/80 sticky top-(--fd-docs-row-1) z-30 flex items-center border-b px-4 backdrop-blur-sm",
        "max-md:layout:[--fd-header-height:--spacing(14)] h-(--fd-header-height) [grid-area:header] md:hidden",
      )}
      role="navigation"
    >
      <span className="text-sm font-semibold">
        {text.mobileNavigationLabel}
      </span>
      <span className="flex-1" />
      <SidebarTrigger className="hover:bg-fd-accent focus-visible:ring-fd-ring inline-flex size-9 items-center justify-center rounded-md focus-visible:ring-2">
        <PanelLeft aria-hidden="true" className="size-4.5" />
      </SidebarTrigger>
    </div>
  );
}
