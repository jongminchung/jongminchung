"use client";

import { Button } from "@astryxdesign/core/Button";
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
    <Button
      label={label}
      href={href}
      variant="ghost"
      size="sm"
      onClick={rememberLocale}
      {...(compact ? { children: nextLocale.toUpperCase() } : {})}
    />
  );
}
