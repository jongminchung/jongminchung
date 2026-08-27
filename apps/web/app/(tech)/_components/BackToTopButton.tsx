"use client";

import { Button } from "@jongminchung/ui/components/button";
import { useTranslations } from "next-intl";
import { Icon } from "#components/Icon";

/** `BackToTopButton` UI 컴포넌트를 렌더링함 */
export function BackToTopButton() {
  const t = useTranslations("tech.outline");
  return (
    <Button
      className="h-8 px-3 text-xs"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      size="sm"
      variant="ghost"
    >
      <Icon icon="arrowUp" />
      {t("backToTop")}
    </Button>
  );
}
