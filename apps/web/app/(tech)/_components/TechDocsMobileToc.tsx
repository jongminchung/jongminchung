import { cn } from "@jongminchung/ui/lib/utils";
import type { TOCItemType } from "fumadocs-core/toc";
import { ChevronDownIcon } from "lucide-react";
import type { Locale } from "#lib/content-model";
import { getTechMessages } from "#lib/tech/copy";

/** tablet 이하에서 문서 목차를 semantic details navigation으로 제공함 */
export function TechDocsMobileToc({
  locale,
  toc,
  label: labelOverride,
  backToTopLabel,
  variant = "docs",
}: {
  readonly locale: Locale;
  readonly toc: readonly TOCItemType[];
  readonly label?: string;
  readonly backToTopLabel?: string;
  readonly variant?: "docs" | "editorial";
}) {
  if (toc.length === 0) return null;
  const label = labelOverride ?? getTechMessages(locale).docs.mobileToc;
  return (
    <nav
      aria-label={label}
      className={cn(
        "sticky z-20 border-b px-4 py-2 backdrop-blur-sm xl:hidden",
        variant === "docs"
          ? "bg-fd-background/90 top-(--fd-docs-row-2) [grid-area:toc-popover]"
          : "top-16 z-30 -mx-4 mb-6 border-t bg-background/95 min-[1280px]:hidden",
      )}
      data-mobile-toc={variant}
    >
      <details className="group">
        <summary
          className={cn(
            "flex min-h-11 cursor-pointer list-none items-center text-sm",
            variant === "docs"
              ? "text-fd-muted-foreground"
              : "font-medium text-muted-foreground",
          )}
        >
          {label}
          <ChevronDownIcon
            aria-hidden="true"
            className="ml-auto size-4 transition-transform group-open:rotate-180"
          />
        </summary>
        <ul className="m-0 max-h-[50vh] list-none overflow-y-auto p-0 pb-2 text-sm">
          {toc.map((item) => (
            <li key={item.url} style={{ paddingInlineStart: item.depth * 12 }}>
              <a
                className={cn(
                  "flex min-h-11 items-center rounded-md px-2 py-1.5",
                  variant === "docs"
                    ? "hover:bg-fd-accent"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                href={item.url}
              >
                {item.title}
              </a>
            </li>
          ))}
          {backToTopLabel === undefined ? null : (
            <li className="mt-2 border-t pt-2">
              <a
                className="flex min-h-11 items-center rounded-md px-2 font-medium hover:bg-accent"
                href="#top"
              >
                {backToTopLabel}
              </a>
            </li>
          )}
        </ul>
      </details>
    </nav>
  );
}
