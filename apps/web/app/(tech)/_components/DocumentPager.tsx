import { cn } from "@jongminchung/ui/lib/utils";
import Link from "next/link";
import { displayTitleFor, type Locale } from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";

function PageLink({
  direction,
  document,
  locale,
}: {
  readonly direction: "previous" | "next";
  readonly document: NonNullable<LoadedDocument["previous"]>;
  readonly locale: Locale;
}) {
  const isPrevious = direction === "previous";
  return (
    <Link
      className={cn(
        "inline-flex h-auto min-h-[68px] shrink-0 items-center gap-2 rounded-md border border-border bg-card px-5 text-sm font-medium whitespace-nowrap text-card-foreground transition-colors outline-none",
        isPrevious ? "justify-start" : "justify-end",
        "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60",
      )}
      href={document.href}
    >
      <span
        className={cn(
          "grid w-full gap-0.5",
          isPrevious ? "text-left" : "text-right",
        )}
      >
        <small className="text-[10px] font-medium text-primary uppercase">
          {locale === "ko"
            ? isPrevious
              ? "이전"
              : "다음"
            : isPrevious
              ? "Previous"
              : "Next"}
        </small>
        {displayTitleFor(document)}
      </span>
    </Link>
  );
}

/** `DocumentPager` UI 컴포넌트를 렌더링함 */
export function DocumentPager({
  locale,
  previous,
  next,
}: {
  readonly locale: Locale;
  readonly previous: LoadedDocument["previous"];
  readonly next: LoadedDocument["next"];
}) {
  return (
    <nav
      className="mt-[72px] grid grid-cols-2 gap-3 border-t border-border pt-6 max-[600px]:grid-cols-1 [&>*]:min-h-[68px]"
      aria-label={
        locale === "ko" ? "이전 및 다음 문서" : "Previous and next documents"
      }
    >
      {previous === null ? (
        <span />
      ) : (
        <PageLink direction="previous" document={previous} locale={locale} />
      )}
      {next === null ? (
        <span />
      ) : (
        <PageLink direction="next" document={next} locale={locale} />
      )}
    </nav>
  );
}
