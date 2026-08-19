"use client";

import { Button } from "@jongminchung/ui/components/button";
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from "@jongminchung/ui/components/sheet";
import { TooltipProvider } from "@jongminchung/ui/components/tooltip";
import type { ReactNode } from "react";
import { Icon } from "#components/Icon";
import { ThemeProvider } from "#components/ThemeProvider";
import type {
    CurrentNavigationEntry,
    Locale,
    NavigationEntry,
} from "#lib/content-model";
import {
    ContextNavigation,
    GlobalRail,
    MobileNavigation,
    MobileTopNavigation,
} from "./Navigation";
import { SearchProvider } from "./SearchPalette";
import { techNavigationCopy } from "./tech-navigation";
import { TechUiProvider } from "./TechUiProvider";
import { useRouteSheet } from "./useRouteSheet";
import styles from "./DocsShell.module.css";

function TabletContextDrawer({
    locale,
    current,
    documents,
}: {
    readonly locale: Locale;
    readonly current: CurrentNavigationEntry;
    readonly documents: readonly NavigationEntry[];
}) {
    const { isOpen, setOpen, triggerRef } = useRouteSheet();
    const copy = techNavigationCopy[locale];
    return (
        <div className={styles.tabletContext}>
            <Button
                ref={triggerRef}
                aria-label={copy.tabletMenu}
                className={"h-8 gap-2 px-3 text-xs"}
                onClick={() => setOpen(true)}
                variant="outline"
                size="default"
            >
                <Icon icon="menu" />
                {copy.tabletSection}
            </Button>
            <Sheet open={isOpen} onOpenChange={setOpen}>
                <SheetContent
                    className="w-80"
                    closeLabel={copy.closeTabletMenu}
                    side="left"
                >
                    <SheetTitle className="sr-only">
                        {copy.tabletSection}
                    </SheetTitle>
                    <ContextNavigation
                        locale={locale}
                        current={current}
                        documents={documents}
                    />
                </SheetContent>
            </Sheet>
        </div>
    );
}

/** `DocsShell` UI 컴포넌트를 렌더링함 */
export function DocsShell({
    locale,
    current,
    documents,
    children,
}: {
    readonly locale: Locale;
    readonly current: CurrentNavigationEntry;
    readonly documents: readonly NavigationEntry[];
    readonly children: ReactNode;
}) {
    const {
        isOpen: isMobileOpen,
        setOpen: changeMobileOpen,
        triggerRef: mobileTriggerRef,
    } = useRouteSheet();
    const copy = techNavigationCopy[locale];

    const navigation = (
        <div className={styles.navigationFrame}>
            <GlobalRail locale={locale} current={current} />
            <ContextNavigation
                locale={locale}
                current={current}
                documents={documents}
                className={styles.contextInline}
            />
        </div>
    );

    return (
        <ThemeProvider storageKey="tech-theme">
            <TechUiProvider>
                <SearchProvider locale={locale}>
                    <TooltipProvider>
                        <div className={styles.shell}>
                            {navigation}
                            <main className={styles.main}>
                                <MobileTopNavigation
                                    locale={locale}
                                    onMenuClick={() => changeMobileOpen(true)}
                                    triggerRef={mobileTriggerRef}
                                />
                                <Sheet
                                    open={isMobileOpen}
                                    onOpenChange={changeMobileOpen}
                                >
                                    <SheetContent
                                        closeLabel={copy.closeMobileNavigation}
                                        onClickCapture={(event) => {
                                            if (
                                                event.target instanceof
                                                    Element &&
                                                event.target.closest("a[href]")
                                            )
                                                changeMobileOpen(false);
                                        }}
                                        side="left"
                                    >
                                        <SheetTitle
                                            className={styles.mobileTitle}
                                        >
                                            {copy.mobileNavigation}
                                        </SheetTitle>
                                        <MobileNavigation
                                            key={`${locale}:${current.section}`}
                                            locale={locale}
                                            current={current}
                                            documents={documents}
                                        />
                                    </SheetContent>
                                </Sheet>
                                <TabletContextDrawer
                                    locale={locale}
                                    current={current}
                                    documents={documents}
                                />
                                {children}
                            </main>
                        </div>
                    </TooltipProvider>
                </SearchProvider>
            </TechUiProvider>
        </ThemeProvider>
    );
}
