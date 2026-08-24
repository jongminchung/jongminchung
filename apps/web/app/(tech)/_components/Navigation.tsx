// @ts-nocheck
// oxlint-disable typescript/no-redundant-type-constituents
"use client";

import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import Link from "next/link";
import { type Ref, useState } from "react";
import { BrandWordmark } from "#components/BrandWordmark";
import { Icon, type IconType } from "#components/Icon";
import { ThemeControl } from "#components/ThemeControl";
import {
  type CurrentNavigationEntry,
  createSectionHref,
  sections as allSections,
  type DocSection,
  type Locale,
  type NavigationEntry,
} from "#lib/content-model";
import { techSectionLabels } from "#lib/tech/copy";
import {
  DeepDiveIcon,
  HandbookIcon,
  OverviewIcon,
  RepositoryIcon,
} from "./DocsIcons";
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

/** `ContextNavigation` UI 컴포넌트를 렌더링함 */
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
      className={cn(
        "[&_.side-nav-item]:min-h-11 [&_.side-nav-item[data-selected=true]]:bg-transparent [&_.side-nav-item[data-selected=true]]:text-primary [&_.side-nav-item[data-selected=true]]:shadow-[inset_3px_0_var(--primary)]",
        className,
      )}
      header={
        <SideNavHeading
          heading={techSectionLabels[locale][current.section]}
          superheading="Engineering Notes"
          headingHref={createSectionHref(locale, current.section)}
        />
      }
    >
      <SectionItems locale={locale} current={current} documents={documents} />
    </SideNav>
  );
}

/** `GlobalRail` UI 컴포넌트를 렌더링함 */
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
      className="sticky top-0 flex h-dvh w-[148px] shrink-0 flex-col items-center border-r bg-background px-3 pt-4 pb-3"
      aria-label={techNavigationCopy[locale].allDocumentation}
    >
      <Link
        href={`/${locale}`}
        className="flex min-h-[38px] w-full place-items-center items-center justify-center"
        aria-label="jongminchung tech"
      >
        <BrandWordmark compact suffix="tech" />
      </Link>
      <span className="mt-[7px] font-mono text-[10px] text-muted-foreground">
        v1
      </span>
      <div className="mt-[14px]">
        <SearchTrigger compact />
      </div>
      <div className="mt-[14px] grid w-full gap-1">
        {allSections.map((section) => (
          <Link
            key={section}
            href={createSectionHref(locale, section)}
            className={
              current.section === section
                ? "grid min-h-[54px] place-items-center gap-0.5 rounded-[.55rem] bg-accent px-[3px] py-1.5 text-center text-[10px] leading-[1.15] text-foreground"
                : "grid min-h-[54px] place-items-center gap-0.5 rounded-[.55rem] px-[3px] py-1.5 text-center text-[10px] leading-[1.15] text-muted-foreground transition-colors hover:text-foreground"
            }
            aria-current={current.section === section ? "page" : undefined}
          >
            <Icon icon={sectionIcons[section]} />
            <span>{techSectionLabels[locale][section]}</span>
          </Link>
        ))}
      </div>
      <div className="mt-auto grid place-items-center gap-1.5">
        <a
          href="https://github.com/jongminchung/jongminchung"
          className="grid size-11 place-items-center rounded-[var(--radius-xs)] text-muted-foreground hover:bg-muted hover:text-foreground"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
        >
          <Icon icon={RepositoryIcon} />
        </a>
        <ThemeControl locale={locale} />
        <span className="[&_a]:max-w-[82px] [&_a]:overflow-hidden [&_a]:text-[10px] [&_a]:text-ellipsis">
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

/** `MobileNavigation` UI 컴포넌트를 렌더링함 */
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
    <div className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
      <div className="min-h-0 overflow-y-auto">
        {section === null ? (
          <nav aria-label={copy.documentationSections}>
            <p className="m-0 px-5 pt-6 pb-3 text-[26px] font-medium">
              {copy.documentation}
            </p>
            <div className="grid gap-1 px-3 pt-1 pb-6">
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
          <div className="min-h-full">
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
            <SideNav className="pt-2 [&_.side-nav-item]:min-h-12 [&_.side-nav-item]:rounded-none [&_.side-nav-item[data-selected=true]]:bg-transparent [&_.side-nav-item[data-selected=true]]:text-primary [&_.side-nav-item[data-selected=true]]:shadow-[inset_3px_0_var(--primary)]">
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
                  {documentsForSection(documents, section).map((document) => (
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
      <div className="flex min-h-[68px] items-center gap-2 border-t bg-card p-3 [&>:first-child]:flex-1">
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

/** `MobileTopNavigation` UI 컴포넌트를 렌더링함 */
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
    <header className="sticky top-0 z-20 hidden min-h-14 items-center gap-2 border-b bg-card/90 p-2 px-3 backdrop-blur-xl max-[768px]:flex">
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
        className="mr-auto inline-flex items-center gap-2"
        aria-label="jongminchung tech"
      >
        <BrandWordmark compact suffix="tech" />
      </Link>
      <SearchTrigger compact showShortcut={false} />
    </header>
  );
}
