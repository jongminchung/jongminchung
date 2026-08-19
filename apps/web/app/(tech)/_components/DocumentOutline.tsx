"use client";

import { useEffect, useState } from "react";
import type { Locale, OutlineEntry } from "#lib/content-model";
import { BackToTopButton } from "./BackToTopButton";
import styles from "./DocumentOutline.module.css";

/** `DocumentOutline` UI 컴포넌트를 렌더링함 */
export function DocumentOutline({
    locale,
    items,
}: {
    readonly locale: Locale;
    readonly items: readonly OutlineEntry[];
}): React.JSX.Element {
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        if (items.length === 0) return;

        const headings = items.flatMap((item) => {
            const heading = document.getElementById(item.id);
            return heading === null ? [] : [heading];
        });
        let frameId: number | null = null;
        const updateActiveHeading = () => {
            frameId = null;
            const activeHeading = headings.findLast(
                (heading) => heading.getBoundingClientRect().top <= 120,
            );
            setActiveId((activeHeading ?? headings[0])?.id ?? null);
        };
        const handleScroll = () => {
            if (frameId === null)
                frameId = window.requestAnimationFrame(updateActiveHeading);
        };

        frameId = window.requestAnimationFrame(updateActiveHeading);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", handleScroll);
            if (frameId !== null) window.cancelAnimationFrame(frameId);
        };
    }, [items]);

    return (
        <aside
            className={styles.container}
            aria-label={locale === "ko" ? "이 페이지에서" : "On this page"}
        >
            <p className={styles.label}>
                {locale === "ko" ? "이 페이지에서" : "On this page"}
            </p>
            <nav
                aria-label={locale === "ko" ? "문서 목차" : "Document outline"}
            >
                <ul className={styles.list}>
                    {items.map((item) => (
                        <li
                            key={item.id}
                            data-active={activeId === item.id}
                            data-level={item.level}
                        >
                            <a
                                aria-current={
                                    activeId === item.id
                                        ? "location"
                                        : undefined
                                }
                                href={`#${item.id}`}
                                onClick={() => setActiveId(item.id)}
                            >
                                {item.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
            <BackToTopButton locale={locale} />
        </aside>
    );
}
