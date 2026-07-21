"use client";

import { Button } from "@/components/ui/button";
import type { Locale, OutlineEntry } from "@/lib/content-model";
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
        variant="ghost"
        size="sm"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <Icon icon="arrowUp" />
        {locale === "ko" ? "맨 위로" : "Back to top"}
      </Button>
    </aside>
  );
}
