"use client";

import type { Locale } from "@/lib/content-model";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({
  locale,
  href,
  compact = false,
}: {
  readonly locale: Locale;
  readonly href: string;
  readonly compact?: boolean;
}) {
  const nextLocale = locale === "ko" ? "en" : "ko";
  const label = locale === "ko" ? "Read in English" : "한국어로 읽기";
  const rememberLocale = (): void => {
    localStorage.setItem("docs-locale", nextLocale);
    document.cookie = `docs-locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };
  return (
    <a
      aria-label={label}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-transparent px-3 text-xs font-medium outline-none transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
      )}
      href={href}
      onClick={rememberLocale}
    >
      {compact ? nextLocale.toUpperCase() : label}
    </a>
  );
}
