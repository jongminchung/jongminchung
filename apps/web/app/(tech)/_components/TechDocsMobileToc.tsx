import type { TOCItemType } from "fumadocs-core/toc";
import type { Locale } from "#lib/content-model";

/** tablet 이하에서 문서 목차를 semantic details navigation으로 제공함 */
export function TechDocsMobileToc({
  locale,
  toc,
}: {
  readonly locale: Locale;
  readonly toc: readonly TOCItemType[];
}) {
  if (toc.length === 0) return null;
  const label = locale === "ko" ? "이 페이지의 목차" : "On this page";
  return (
    <nav
      aria-label={label}
      className="bg-fd-background/90 sticky top-(--fd-docs-row-2) z-20 border-b px-4 py-2 backdrop-blur-sm [grid-area:toc-popover] xl:hidden"
    >
      <details>
        <summary className="text-fd-muted-foreground cursor-pointer text-sm">
          {label}
        </summary>
        <ul className="max-h-[50vh] overflow-y-auto py-2 text-sm">
          {toc.map((item) => (
            <li key={item.url} style={{ paddingInlineStart: item.depth * 12 }}>
              <a
                className="hover:bg-fd-accent block rounded-md px-2 py-1.5"
                href={item.url}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
