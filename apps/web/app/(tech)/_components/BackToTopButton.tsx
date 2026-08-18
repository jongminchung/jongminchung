"use client";

import { Button } from "@jongminchung/ui/components/button";
import { Icon } from "#components/Icon";
import type { Locale } from "#lib/content-model";

/** `BackToTopButton` UI 컴포넌트를 렌더링함 */
export function BackToTopButton({ locale }: { readonly locale: Locale }) {
    return (
        <Button
            className="h-8 px-3 text-xs"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            size="sm"
            variant="ghost"
        >
            <Icon icon="arrowUp" />
            {locale === "ko" ? "맨 위로" : "Back to top"}
        </Button>
    );
}
