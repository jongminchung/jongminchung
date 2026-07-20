"use client";

import { Button } from "@jongminchung/ui/button";
import type { Locale } from "@/lib/content-model";

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
    <Button asChild variant="ghost" size="sm">
      <a href={href} onClick={rememberLocale} aria-label={label}>
        {compact ? nextLocale.toUpperCase() : label}
      </a>
    </Button>
  );
}
