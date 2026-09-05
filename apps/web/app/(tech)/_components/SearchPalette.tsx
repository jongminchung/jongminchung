"use client";

import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import {
  SearchProvider as FumadocsSearchProvider,
  useSearchContext,
  type SharedProps,
} from "fumadocs-ui/contexts/search";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Icon } from "#components/Icon";
import type { Locale } from "#lib/content-model";

const SearchDialog = dynamic(
  () => import("./SearchDialog").then((module) => module.SearchDialog),
  { ssr: false },
);

function findVisibleTrigger(): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-docs-search-trigger]",
      ),
    ).find((trigger) => trigger.getClientRects().length > 0) ?? null
  );
}

/** `SearchProvider` UI 컴포넌트를 렌더링함 */
export function SearchProvider({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}) {
  return (
    <FumadocsSearchProvider
      preload={false}
      SearchDialog={FumadocsSearchDialog}
      options={{ locale }}
    >
      {children}
    </FumadocsSearchProvider>
  );
}

function FumadocsSearchDialog({
  locale,
  onOpenChange,
  open,
}: SharedProps & { readonly locale: Locale }) {
  return (
    <SearchDialog
      locale={locale}
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={findVisibleTrigger}
    />
  );
}

/** `SearchTrigger` UI 컴포넌트를 렌더링함 */
export function SearchTrigger({
  compact = false,
  showShortcut = true,
}: {
  readonly compact?: boolean;
  readonly showShortcut?: boolean;
}) {
  const search = useSearchContext();
  const t = useTranslations("tech.search");
  const label = t("triggerLabel");
  return (
    <Button
      aria-label={label}
      className={cn(
        "[&_kbd]:rounded-xs [&_kbd]:border [&_kbd]:border-border [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:text-[10px] [&_kbd]:text-foreground",
        compact
          ? "min-h-11 min-w-11 px-[7px]"
          : "h-8 w-full justify-between px-3 text-xs",
      )}
      data-docs-search-trigger="true"
      onClick={() => {
        search.setOpenSearch(true);
      }}
      size={compact ? "icon" : "default"}
      variant="ghost"
    >
      <span className="inline-flex items-center gap-[7px]">
        <Icon icon="search" />
        {compact ? null : <span>{t("shortLabel")}</span>}
      </span>
      {showShortcut && !compact ? (
        <span aria-hidden="true" className="inline-flex gap-0.5">
          {search.hotKey.map((hotKey, index) => (
            <kbd key={index}>{hotKey.display}</kbd>
          ))}
        </span>
      ) : null}
    </Button>
  );
}
