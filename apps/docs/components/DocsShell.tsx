"use client";

import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { LinkProvider } from "@astryxdesign/core/Link";
import { MobileNav } from "@astryxdesign/core/MobileNav";
import { Theme, type ThemeMode } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { ContentManifestEntry, Locale } from "@/lib/content-model";
import { ContextNavigation, GlobalRail, MobileNavigation, MobileTopNavigation } from "./Navigation";
import { RouteTransitionContent, RouteTransitionProvider, TransitionLink } from "./RouteTransition";
import { SearchProvider } from "./SearchPalette";
import styles from "./DocsShell.module.css";

const docsTheme = Object.freeze({ ...neutralTheme, icons: {} });

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const setOpen = (nextOpen: boolean): void => {
    setIsOpen(nextOpen);
    if (!nextOpen) requestAnimationFrame(() => triggerRef.current?.focus());
  };
  return (
    <div className={styles.tabletContext}>
      <Button
        ref={triggerRef}
        label={locale === "ko" ? "현재 섹션 메뉴" : "Current section menu"}
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        icon={<Icon icon="menu" size="sm" />}
      />
      <MobileNav
        isOpen={isOpen}
        onOpenChange={setOpen}
        header={locale === "ko" ? "현재 섹션" : "Current section"}
        label={locale === "ko" ? "현재 섹션 탐색" : "Current section navigation"}
        width={320}
        side="start"
      >
        <ContextNavigation locale={locale} current={current} documents={documents} />
      </MobileNav>
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
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    document.documentElement.lang = locale;
    const storedMode = localStorage.getItem("docs-theme");
    if (isThemeMode(storedMode)) setMode(storedMode);
  }, [locale]);

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
    <Theme theme={docsTheme} mode={mode}>
      <RouteTransitionProvider locale={locale}>
        <LinkProvider component={TransitionLink}>
          <SearchProvider locale={locale}>
            <AppShell
              className={styles.shell}
              variant="section"
              height="auto"
              contentPadding={0}
              topNav={<MobileTopNavigation locale={locale} />}
              sideNav={navigation}
              mobileNav={{
                breakpoint: "md",
                content: (
                  <MobileNav
                    header="Jongmin Chung Docs"
                    label={locale === "ko" ? "모바일 문서 탐색" : "Mobile documentation navigation"}
                    width={360}
                    side="start"
                  >
                    <MobileNavigation
                      key={`${locale}:${current.section}`}
                      locale={locale}
                      current={current}
                      documents={documents}
                      mode={mode}
                      onModeChange={changeMode}
                    />
                  </MobileNav>
                ),
              }}
            >
              <TabletContextDrawer locale={locale} current={current} documents={documents} />
              <RouteTransitionContent>{children}</RouteTransitionContent>
            </AppShell>
          </SearchProvider>
        </LinkProvider>
      </RouteTransitionProvider>
    </Theme>
  );
}
