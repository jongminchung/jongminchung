import { cn } from "@jongminchung/ui/lib/utils";
import type { Locale } from "#lib/content-model";

const sharedMdxProseClassName =
  "[overflow-wrap:anywhere] [&_[data-footnotes]]:mt-12 [&_[data-footnotes]]:border-t [&_[data-footnotes]]:pt-5 [&_[data-footnotes]]:text-sm [&_[data-footnotes]]:leading-[1.6] [&_[data-footnotes]]:text-muted-foreground [&_[data-footnotes]_a]:text-primary [&_code:not(pre_code)]:rounded-[var(--radius-xs)] [&_code:not(pre_code)]:bg-accent/55 [&_code:not(pre_code)]:px-[.3rem] [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[.875rem] [&_code:not(pre_code)]:text-primary [&_td]:border [&_td]:px-3 [&_td]:py-2.5 [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2.5";

function localeReadingClassName(locale: Locale): string {
  return locale === "ko"
    ? "leading-7 tracking-[-.01em] break-keep [&_p]:[text-wrap:pretty]"
    : "leading-[1.6] tracking-normal [&_p]:[text-wrap:pretty]";
}

/** Blog와 Note 장문 본문의 언어별 typography 계약을 제공함 */
export function articleProseClassName(locale: Locale): string {
  return cn(
    "text-[16px]",
    localeReadingClassName(locale),
    sharedMdxProseClassName,
  );
}

/** Fumadocs DocsBody의 언어별 탐색·읽기 typography 계약을 제공함 */
export function docsProseClassName(locale: Locale): string {
  return cn(
    "prose-no-margin mt-8 text-[16px]",
    localeReadingClassName(locale),
    sharedMdxProseClassName,
  );
}
