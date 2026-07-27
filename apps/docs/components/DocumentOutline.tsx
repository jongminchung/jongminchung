"use client";

import { Button } from "@base-ui/react/button";
import type { Locale, OutlineEntry } from "@/lib/content-model";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import styles from "./DocumentOutline.module.css";

export function DocumentOutline({
  locale,
  items,
}: {
  readonly locale: Locale;
  readonly items: readonly OutlineEntry[];
}) {
  return (
    <aside
      className={styles.container}
      aria-label={locale === "ko" ? "이 페이지에서" : "On this page"}
    >
      <p className={styles.label}>{locale === "ko" ? "이 페이지에서" : "On this page"}</p>
      <nav aria-label={locale === "ko" ? "문서 목차" : "Document outline"}>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} data-level={item.level}>
              <a href={`#${item.id}`}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <Button
        className={cn(
          "inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-transparent px-3 text-xs font-medium outline-none transition-colors",
          "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        )}
        data-slot="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <Icon icon="arrowUp" />
        {locale === "ko" ? "맨 위로" : "Back to top"}
      </Button>
    </aside>
  );
}
