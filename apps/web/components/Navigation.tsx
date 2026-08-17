"use client";

import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import Link from "next/link";
import { type Ref, useState } from "react";
import {
    type CurrentNavigationEntry,
    createSectionHref,
    sections as allSections,
    type DocSection,
    type Locale,
    type NavigationEntry,
} from "#lib/content-model";
import { techSectionLabels } from "#lib/tech-copy";
import { BrandWordmark } from "./BrandWordmark";
import {
    DeepDiveIcon,
    HandbookIcon,
    OverviewIcon,
    RepositoryIcon,
} from "./DocsIcons";
import { Icon, type IconType } from "./Icon";
import { LocaleSwitcher } from "./LocaleSwitcher";
import {
    SideNav,
    SideNavHeading,
    SideNavItem,
    SideNavSection,
} from "./NavigationPrimitives";
import { SearchTrigger } from "./SearchPalette";
import {
    documentsForSection,
    localizedNavigationHref,
    otherLocale,
    sectionNavigationItems,
    techNavigationCopy,
} from "./tech-navigation";
import { ThemeControl } from "./ThemeControl";
import styles from "./Navigation.module.css";

const sectionIcons: Readonly<Record<DocSection, IconType>> = {
    overview: OverviewIcon,
    handbook: HandbookIcon,
    "deep-dive": DeepDiveIcon,
};

function SectionItems({
    locale,
    current,
    documents,
}: {
    readonly locale: Locale;
    readonly current: CurrentNavigationEntry;
    readonly documents: readonly NavigationEntry[];
}) {
    const items = sectionNavigationItems(current, documents);
    const sectionDocuments = documentsForSection(documents, current.section);
    const copy = techNavigationCopy[locale];
    const title =
        sectionDocuments.length === 1 ? copy.onThisPage : copy.inSection;

    return (
        <SideNavSection title={title} isHeaderHidden>
            {items.map((item) => (
                <SideNavItem
                    key={item.id}
                    label={item.label}
                    href={item.href}
                    isSelected={item.selected}
                    size="md"
                />
            ))}
        </SideNavSection>
    );
}

export function ContextNavigation({
    locale,
    current,
    documents,
    className,
}: {
    readonly locale: Locale;
    readonly current: CurrentNavigationEntry;
    readonly documents: readonly NavigationEntry[];
    readonly className?: string;
}) {
    return (
        <SideNav
            className={`${styles.contextNavigation}${className === undefined ? "" : ` ${className}`}`}
            header={
                <SideNavHeading
                    heading={techSectionLabels[locale][current.section]}
                    superheading="Engineering Notes"
                    headingHref={createSectionHref(locale, current.section)}
                />
            }
        >
            <SectionItems
                locale={locale}
                current={current}
                documents={documents}
            />
        </SideNav>
    );
}

export function GlobalRail({
    locale,
    current,
}: {
    readonly locale: Locale;
    readonly current: CurrentNavigationEntry;
}) {
    const alternateLocale = otherLocale(locale);
    return (
        <nav
            className={styles.globalRail}
            aria-label={techNavigationCopy[locale].allDocumentation}
        >
            <Link
                href={`/${locale}`}
                className={styles.brand}
                aria-label="jongminchung tech"
            >
                <BrandWordmark compact suffix="tech" />
            </Link>
            <span className={styles.version}>v1</span>
            <div className={styles.railSearch}>
                <SearchTrigger compact />
            </div>
            <div className={styles.sectionLinks}>
                {allSections.map((section) => (
                    <Link
                        key={section}
                        href={createSectionHref(locale, section)}
                        className={
                            current.section === section
                                ? styles.sectionLinkActive
                                : styles.sectionLink
                        }
                        aria-current={
                            current.section === section ? "page" : undefined
                        }
                    >
                        <Icon icon={sectionIcons[section]} />
                        <span>{techSectionLabels[locale][section]}</span>
                    </Link>
                ))}
            </div>
            <div className={styles.railFooter}>
                <a
                    href="https://github.com/jongminchung/jongminchung"
                    className={styles.utilityLink}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="GitHub"
                >
                    <Icon icon={RepositoryIcon} />
                </a>
                <ThemeControl locale={locale} />
                <span className={styles.localeSwitch}>
                    <LocaleSwitcher
                        locale={locale}
                        href={localizedNavigationHref(alternateLocale, current)}
                        compact
                    />
                </span>
            </div>
        </nav>
    );
}

export function MobileNavigation({
    locale,
    current,
    documents,
}: {
    readonly locale: Locale;
    readonly current: CurrentNavigationEntry;
    readonly documents: readonly NavigationEntry[];
}) {
    const alternateLocale = otherLocale(locale);
    const copy = techNavigationCopy[locale];
    const [section, setSection] = useState<DocSection | null>(current.section);

    return (
        <div className={styles.mobileNavigation}>
            <div className={styles.mobileNavigationBody}>
                {section === null ? (
                    <nav aria-label={copy.documentationSections}>
                        <p className={styles.mobileTreeTitle}>
                            {copy.documentation}
                        </p>
                        <div className={styles.mobileSectionTree}>
                            {allSections.map((item) => (
                                <Button
                                    key={item}
                                    className={cn(
                                        "min-h-[52px] w-full justify-start gap-2 px-5 text-sm",
                                        "[&>:last-child]:ml-auto",
                                    )}
                                    onClick={() => setSection(item)}
                                    variant="ghost"
                                    size="default"
                                >
                                    <Icon icon={sectionIcons[item]} />
                                    {techSectionLabels[locale][item]}
                                    <Icon icon="chevronRight" />
                                </Button>
                            ))}
                        </div>
                    </nav>
                ) : (
                    <div className={styles.mobileSectionView}>
                        <Button
                            aria-label={copy.backToAll}
                            className={
                                "sticky top-0 z-[1] min-h-[52px] w-full justify-start gap-2 rounded-none border-b-border px-5 text-[17px]"
                            }
                            onClick={() => setSection(null)}
                            variant="outline"
                            size="default"
                        >
                            <Icon icon="chevronLeft" />
                            {techSectionLabels[locale][section]}
                        </Button>
                        <SideNav className={styles.mobileContextNavigation}>
                            {section === current.section ? (
                                <SectionItems
                                    locale={locale}
                                    current={current}
                                    documents={documents}
                                />
                            ) : (
                                <SideNavSection
                                    title={techSectionLabels[locale][section]}
                                    isHeaderHidden
                                >
                                    {documentsForSection(
                                        documents,
                                        section,
                                    ).map((document) => (
                                        <SideNavItem
                                            key={document.id}
                                            label={document.label}
                                            href={document.href}
                                            size="md"
                                        />
                                    ))}
                                </SideNavSection>
                            )}
                        </SideNav>
                    </div>
                )}
            </div>
            <div className={styles.mobileUtilities}>
                <SearchTrigger />
                <ThemeControl locale={locale} />
                <LocaleSwitcher
                    locale={locale}
                    href={localizedNavigationHref(alternateLocale, current)}
                    compact
                />
            </div>
        </div>
    );
}

export function MobileTopNavigation({
    locale,
    onMenuClick,
    triggerRef,
}: {
    readonly locale: Locale;
    readonly onMenuClick: () => void;
    readonly triggerRef: Ref<HTMLButtonElement>;
}) {
    return (
        <header className={styles.mobileTopNav}>
            <Button
                ref={triggerRef}
                aria-label={techNavigationCopy[locale].openNavigation}
                className={"size-9 gap-2 p-0 text-sm"}
                onClick={onMenuClick}
                variant="ghost"
                size="icon"
            >
                <Icon icon="menu" />
            </Button>
            <Link
                href={`/${locale}`}
                className={styles.mobileHeading}
                aria-label="jongminchung tech"
            >
                <BrandWordmark compact suffix="tech" />
            </Link>
            <SearchTrigger compact showShortcut={false} />
        </header>
    );
}
