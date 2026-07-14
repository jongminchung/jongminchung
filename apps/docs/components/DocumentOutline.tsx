"use client";

import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Outline } from "@astryxdesign/core/Outline";
import type { Locale, OutlineEntry } from "@/lib/content-model";
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
      <Outline
        items={items.map((item) => ({
          id: item.id,
          label: item.label,
          level: item.level,
        }))}
        label={locale === "ko" ? "문서 목차" : "Document outline"}
        density="compact"
      />
      <Button
        label={locale === "ko" ? "맨 위로" : "Back to top"}
        variant="ghost"
        size="sm"
        icon={<Icon icon="arrowUp" size="sm" />}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        {locale === "ko" ? "맨 위로" : "Back to top"}
      </Button>
    </aside>
  );
}
