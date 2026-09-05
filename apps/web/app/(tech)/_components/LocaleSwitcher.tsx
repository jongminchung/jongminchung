"use client";

import { cn } from "@jongminchung/ui/lib/utils";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import type { Locale } from "#lib/content-model";
import { alternateLocale } from "#lib/locale";

function rememberTechLocale(locale: Locale): void {
  localStorage.setItem("tech-locale", locale);
  document.cookie = `tech-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

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
  const nextLocale = alternateLocale(locale);
  const targetHref = preserveCurrentPath
    ? pathname
        .replace(/^\/tech(?=\/(?:ko|en)(?:\/|$))/u, "")
        .replace(/^\/(?:ko|en)(?=\/|$)/u, `/${nextLocale}`)
    : href;
  const label =
    nextLocale === "en" ? t("switchToEnglish") : t("switchToKorean");
  return (
    <a
      aria-label={label}
      className={cn(
        "inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-transparent px-3 text-xs font-medium whitespace-nowrap transition-colors outline-none",
        "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
      )}
      href={targetHref}
      onClick={() => rememberTechLocale(nextLocale)}
    >
      {compact ? nextLocale.toUpperCase() : label}
    </a>
  );
}
