"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "#lib/content-contracts";
import { alternateLocale } from "#lib/locale";

/** 언어를 바꿔도 현재 투자 글·목록의 경로를 유지한다. */
export function InvestmentLocaleLink({ locale }: { readonly locale: Locale }) {
  const pathname = usePathname();
  const alternate = alternateLocale(locale);
  const href = pathname
    .replace(/^\/invest(?=\/(?:ko|en)(?:\/|$))/u, "")
    .replace(/^\/(?:ko|en)(?=\/|$)/u, `/${alternate}`);

  return (
    <Link
      aria-label={alternate === "en" ? "Read in English" : "한국어로 읽기"}
      className="inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-[11px]"
      href={href}
    >
      {alternate.toUpperCase()}
    </Link>
  );
}
