"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Icon, type IconType } from "@astryxdesign/core/Icon";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import type { ThemeMode } from "@astryxdesign/core/theme";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { createIconDataUrl } from "@jongminchung/icon";
import Link from "next/link";
import { useState } from "react";
import {
  displayTitleFor,
  type ContentManifestEntry,
  type DocSection,
  type Locale,
} from "@/lib/content-model";
import { DeepDiveIcon, HandbookIcon, OverviewIcon, PackageIcon, RepositoryIcon } from "./DocsIcons";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SearchTrigger } from "./SearchPalette";
import { ThemeControl } from "./ThemeControl";
import styles from "./Navigation.module.css";

const sectionLabels: Readonly<Record<Locale, Readonly<Record<DocSection, string>>>> = {
  ko: {
    overview: "개요",
    handbook: "핸드북",
    packages: "패키지",
    "deep-dive": "Deep Dive",
  },
  en: {
    overview: "Overview",
    handbook: "Handbook",
    packages: "Packages",
    "deep-dive": "Deep Dive",
  },
};

const sectionIcons: Readonly<Record<DocSection, IconType>> = {
  overview: OverviewIcon,
  handbook: HandbookIcon,
  packages: PackageIcon,
  "deep-dive": DeepDiveIcon,
};

const allSections = ["overview", "handbook", "packages", "deep-dive"] as const;
const personalIcon = createIconDataUrl("personal");

function sectionHref(
  locale: Locale,
  section: DocSection,
  documents: readonly ContentManifestEntry[],
): string {
  return documents.find((document) => document.section === section)?.href ?? `/${locale}/overview`;
}

function SectionItems({
  locale,
  current,
  documents,
}: {
  readonly locale: Locale;
  readonly current: ContentManifestEntry;
  readonly documents: readonly ContentManifestEntry[];
}) {
  const sectionDocuments = documents.filter((document) => document.section === current.section);
  const items =
    sectionDocuments.length === 1
      ? current.outline
          .filter((item) => item.level === 2)
          .map((item) => ({
            id: item.id,
            href: `#${item.id}`,
            label: item.label,
            selected: false,
          }))
      : sectionDocuments.map((document) => ({
          id: document.id,
          href: document.href,
          label: displayTitleFor(document),
          selected: document.id === current.id,
        }));
  const title =
    sectionDocuments.length === 1
      ? locale === "ko"
        ? "이 페이지에서"
        : "On this page"
      : locale === "ko"
        ? "이 섹션에서"
        : "In this section";

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
  readonly current: ContentManifestEntry;
  readonly documents: readonly ContentManifestEntry[];
  readonly className?: string;
}) {
  return (
    <SideNav
      className={`${styles.contextNavigation}${className === undefined ? "" : ` ${className}`}`}
      header={
        <SideNavHeading
          heading={sectionLabels[locale][current.section]}
          superheading="Jongmin Chung Docs"
          headingHref={sectionHref(locale, current.section, documents)}
          headerEndContent={<Badge label="v1" variant="purple" />}
        />
      }
    >
      <SectionItems locale={locale} current={current} documents={documents} />
    </SideNav>
  );
}

export function GlobalRail({
  locale,
  current,
  documents,
  mode,
  onModeChange,
}: {
  readonly locale: Locale;
  readonly current: ContentManifestEntry;
  readonly documents: readonly ContentManifestEntry[];
  readonly mode: ThemeMode;
  readonly onModeChange: (mode: ThemeMode) => void;
}) {
  const otherLocale = locale === "ko" ? "en" : "ko";
  return (
    <nav
      className={styles.globalRail}
      aria-label={locale === "ko" ? "전체 문서" : "All documentation"}
    >
      <Link
        href={`/${locale}/overview`}
        className={styles.brand}
        aria-label="Jongmin Chung Docs"
      >
        <img
          alt=""
          aria-hidden="true"
          className={styles.brandIcon}
          height="38"
          src={personalIcon}
          width="38"
        />
      </Link>
      <span className={styles.version}>v1</span>
      <div className={styles.railSearch}>
        <SearchTrigger compact />
      </div>
      <div className={styles.sectionLinks}>
        {allSections.map((section) => (
          <Link
            key={section}
            href={sectionHref(locale, section, documents)}
            className={current.section === section ? styles.sectionLinkActive : styles.sectionLink}
            aria-current={current.section === section ? "page" : undefined}
          >
            <Icon icon={sectionIcons[section]} size="md" />
            <span>{sectionLabels[locale][section]}</span>
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
          <Icon icon={RepositoryIcon} size="sm" />
        </a>
        <ThemeControl locale={locale} mode={mode} onModeChange={onModeChange} />
        <span className={styles.localeSwitch}>
          <LocaleSwitcher locale={locale} href={`/${otherLocale}/${current.id}`} compact />
        </span>
      </div>
    </nav>
  );
}

export function MobileNavigation({
  locale,
  current,
  documents,
  mode,
  onModeChange,
}: {
  readonly locale: Locale;
  readonly current: ContentManifestEntry;
  readonly documents: readonly ContentManifestEntry[];
  readonly mode: ThemeMode;
  readonly onModeChange: (mode: ThemeMode) => void;
}) {
  const otherLocale = locale === "ko" ? "en" : "ko";
  const [section, setSection] = useState<DocSection | null>(current.section);

  return (
    <div className={styles.mobileNavigation}>
      <div className={styles.mobileNavigationBody}>
        {section === null ? (
          <nav aria-label={locale === "ko" ? "문서 섹션" : "Documentation sections"}>
            <p className={styles.mobileTreeTitle}>{locale === "ko" ? "문서" : "Documentation"}</p>
            <div className={styles.mobileSectionTree}>
              {allSections.map((item) => (
                <Button
                  key={item}
                  label={sectionLabels[locale][item]}
                  variant="ghost"
                  size="lg"
                  className={styles.mobileSectionButton}
                  icon={<Icon icon={sectionIcons[item]} size="md" />}
                  endContent={<Icon icon="chevronRight" size="sm" />}
                  onClick={() => setSection(item)}
                />
              ))}
            </div>
          </nav>
        ) : (
          <div className={styles.mobileSectionView}>
            <Button
              label={locale === "ko" ? "전체 문서로 돌아가기" : "Back to all documentation"}
              variant="ghost"
              size="lg"
              className={styles.mobileBackButton}
              icon={<Icon icon="chevronLeft" size="md" />}
              onClick={() => setSection(null)}
            >
              {sectionLabels[locale][section]}
            </Button>
            <SideNav className={styles.mobileContextNavigation}>
              {section === current.section ? (
                <SectionItems locale={locale} current={current} documents={documents} />
              ) : (
                <SideNavSection title={sectionLabels[locale][section]} isHeaderHidden>
                  {documents
                    .filter((document) => document.section === section)
                    .map((document) => (
                      <SideNavItem
                        key={document.id}
                        label={displayTitleFor(document)}
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
        <ThemeControl locale={locale} mode={mode} onModeChange={onModeChange} />
        <LocaleSwitcher locale={locale} href={`/${otherLocale}/${current.id}`} compact />
      </div>
    </div>
  );
}

export function MobileTopNavigation({ locale }: { readonly locale: Locale }) {
  return (
    <TopNav
      className={styles.mobileTopNav}
      label={locale === "ko" ? "모바일 문서 탐색" : "Mobile documentation navigation"}
      heading={
        <TopNavHeading
          heading="Docs"
          headingHref={`/${locale}/overview`}
          logo={
            <img
              alt=""
              aria-hidden="true"
              className={styles.mobileBrand}
              height="30"
              src={personalIcon}
              width="30"
            />
          }
        />
      }
      endContent={<SearchTrigger compact showShortcut={false} />}
    />
  );
}
