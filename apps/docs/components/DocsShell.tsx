"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { ContentManifestEntry, Locale } from "@/lib/content-model";
import { Icon } from "./Icon";
import { ContextNavigation, GlobalRail, MobileNavigation, MobileTopNavigation } from "./Navigation";
import { RouteTransitionContent, RouteTransitionProvider } from "./RouteTransition";
import { SearchProvider } from "./SearchPalette";
import type { ThemeMode } from "./ThemeControl";
import styles from "./DocsShell.module.css";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function TabletContextDrawer({
  locale,
  current,
  documents,
}: {
  readonly locale: Locale;
  readonly current: ContentManifestEntry;
  readonly documents: readonly ContentManifestEntry[];
}) {
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => setIsOpen(false), [pathname]);
  const setOpen = (nextOpen: boolean): void => {
    setIsOpen(nextOpen);
    if (!nextOpen) requestAnimationFrame(() => triggerRef.current?.focus());
  };
  return (
    <div className={styles.tabletContext}>
      <Button
        ref={triggerRef}
        aria-label={locale === "ko" ? "현재 섹션 메뉴" : "Current section menu"}
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Icon icon="menu" />
        {locale === "ko" ? "현재 섹션" : "Current section"}
      </Button>
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent className="w-80">
          <SheetTitle className="sr-only">
            {locale === "ko" ? "현재 섹션" : "Current section"}
          </SheetTitle>
          <ContextNavigation locale={locale} current={current} documents={documents} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function DocsShell({
  locale,
  current,
  documents,
  children,
}: {
  readonly locale: Locale;
  readonly current: ContentManifestEntry;
  readonly documents: readonly ContentManifestEntry[];
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const [mode, setMode] = useState<ThemeMode>("system");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setIsMobileOpen(false), [pathname]);

  const changeMobileOpen = (nextOpen: boolean): void => {
    setIsMobileOpen(nextOpen);
    if (!nextOpen) requestAnimationFrame(() => mobileTriggerRef.current?.focus());
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    const storedMode = localStorage.getItem("docs-theme");
    if (isThemeMode(storedMode)) setMode(storedMode);
  }, [locale]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (): void => {
      document.documentElement.dataset.theme =
        mode === "system" ? (media.matches ? "dark" : "light") : mode;
      document.documentElement.style.colorScheme =
        mode === "system" ? (media.matches ? "dark" : "light") : mode;
    };
    applyTheme();
    if (mode !== "system") return;
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [mode]);

  const changeMode = (nextMode: ThemeMode): void => {
    setMode(nextMode);
    localStorage.setItem("docs-theme", nextMode);
  };

  const navigation = (
    <div className={styles.navigationFrame}>
      <GlobalRail
        locale={locale}
        current={current}
        documents={documents}
        mode={mode}
        onModeChange={changeMode}
      />
      <ContextNavigation
        locale={locale}
        current={current}
        documents={documents}
        className={styles.contextInline}
      />
    </div>
  );

  return (
    <RouteTransitionProvider locale={locale}>
      <SearchProvider locale={locale}>
        <div className={styles.shell}>
          {navigation}
          <main className={styles.main}>
            <MobileTopNavigation
              locale={locale}
              onMenuClick={() => changeMobileOpen(true)}
              triggerRef={mobileTriggerRef}
            />
            <Sheet open={isMobileOpen} onOpenChange={changeMobileOpen}>
              <SheetContent>
                <SheetTitle className={styles.mobileTitle}>
                  {locale === "ko" ? "모바일 문서 탐색" : "Mobile documentation navigation"}
                </SheetTitle>
                <MobileNavigation
                  key={`${locale}:${current.section}`}
                  locale={locale}
                  current={current}
                  documents={documents}
                  mode={mode}
                  onModeChange={changeMode}
                />
              </SheetContent>
            </Sheet>
            <TabletContextDrawer locale={locale} current={current} documents={documents} />
            <RouteTransitionContent>{children}</RouteTransitionContent>
          </main>
        </div>
      </SearchProvider>
    </RouteTransitionProvider>
  );
}
