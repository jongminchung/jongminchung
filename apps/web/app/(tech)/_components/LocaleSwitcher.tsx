"use client";

import { cn } from "@jongminchung/ui/lib/utils";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import type { Locale } from "#lib/content-model";

/** `LocaleSwitcher` UI 컴포넌트를 렌더링함 */
export function LocaleSwitcher({
  locale,
  href,
  compact = false,
  preserveCurrentPath = false,
}: {
  readonly locale: Locale;
  readonly href: string;
  readonly compact?: boolean;
  readonly preserveCurrentPath?: boolean;
}) {
  const t = useTranslations("tech.locale");
  const pathname = usePathname();
  const nextLocale = locale === "ko" ? "en" : "ko";
  const targetHref = preserveCurrentPath
    ? pathname
        .replace(/^\/tech(?=\/(?:ko|en)(?:\/|$))/u, "")
        .replace(/^\/(?:ko|en)(?=\/|$)/u, `/${nextLocale}`)
    : href;
  const label =
    nextLocale === "en" ? t("switchToEnglish") : t("switchToKorean");
  const rememberLocale = (): void => {
    localStorage.setItem("tech-locale", nextLocale);
    document.cookie = `tech-locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };
  return (
    <a
      aria-label={label}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-transparent px-3 text-xs font-medium whitespace-nowrap transition-colors outline-none",
        "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
      )}
      href={targetHref}
      onClick={rememberLocale}
    >
      {compact ? nextLocale.toUpperCase() : label}
    </a>
  );
}
