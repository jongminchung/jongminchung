import { cn } from "@jongminchung/ui/lib/utils";

const sharedMdxProseClassName =
  "break-words [&_[data-footnotes]]:mt-12 [&_[data-footnotes]]:border-t [&_[data-footnotes]]:pt-5 [&_[data-footnotes]]:text-sm [&_[data-footnotes]]:leading-[1.6] [&_[data-footnotes]]:text-muted-foreground [&_[data-footnotes]_a]:text-primary [&_code:not(pre_code)]:rounded-[var(--radius-xs)] [&_code:not(pre_code)]:bg-accent/55 [&_code:not(pre_code)]:px-[.3rem] [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[.875rem] [&_code:not(pre_code)]:text-primary [&_td]:border [&_td]:px-3 [&_td]:py-2.5 [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2.5";

/** Blog와 Note 장문 본문의 앱 소유 typography 계약임 */
export const editorialProseClassName = cn(
  "text-[16px] leading-7 tracking-[-.01em] [&_li+li]:mt-2",
  sharedMdxProseClassName,
);

/** Fumadocs DocsBody에 추가하는 제품별 prose 계약임 */
export const docsProseClassName = cn(
  "mt-8 text-base leading-[1.65] tracking-[-.01em]",
  sharedMdxProseClassName,
);
