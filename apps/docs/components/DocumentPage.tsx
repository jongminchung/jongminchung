import { Badge } from "@astryxdesign/core/Badge";
import { BreadcrumbItem, Breadcrumbs } from "@astryxdesign/core/Breadcrumbs";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { displayTitleFor, type DocSection, type Locale } from "@/lib/content-model";
import type { LoadedDocument } from "@/lib/documents";
import { DocumentOutline } from "./DocumentOutline";
import { EditPageLink } from "./EditPageLink";
import styles from "./DocumentPage.module.css";

const versionById: Readonly<Record<string, string>> = {
  "deep-dive/nextjs-16": "16.2.10",
  "deep-dive/pnpm-11": "11.13.0",
  "deep-dive/node-26": "26.5.0",
  "deep-dive/typescript-6": "6.0.3",
  "deep-dive/astryx-0.1.5": "0.1.5",
};

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

const sectionFirstDocument: Readonly<Record<DocSection, string>> = {
  overview: "overview",
  handbook: "handbook/collaboration",
  packages: "packages/remark-plantuml",
  "deep-dive": "deep-dive/nextjs-16",
};

function versionFor(document: LoadedDocument): string {
  return document.metadata.packageVersion ?? versionById[document.metadata.id] ?? "v1";
}

function editHref(locale: Locale, id: string): string {
  return `https://github.com/jongminchung/jongminchung/edit/main/apps/docs/content/${locale}/${id}.mdx`;
}

export function DocumentPage({
  locale,
  document,
}: {
  readonly locale: Locale;
  readonly document: LoadedDocument;
}) {
  const { metadata, Content, previous, next } = document;
  const isOverview = metadata.id === "overview";
  const title = displayTitleFor(metadata);
  const sectionHref = `/${locale}/${sectionFirstDocument[metadata.section]}`;
  return (
    <div className={styles.pageFrame}>
      <article className={isOverview ? styles.overviewArticle : styles.article} lang={locale}>
        {isOverview ? null : (
          <header className={styles.documentHeader}>
            <Breadcrumbs
              label={locale === "ko" ? "현재 위치" : "Breadcrumb"}
              variant="supporting"
              separator={<Icon icon="chevronRight" size="xsm" />}
            >
              <BreadcrumbItem href={`/${locale}/overview`}>Docs</BreadcrumbItem>
              <BreadcrumbItem href={sectionHref}>
                {sectionLabels[locale][metadata.section]}
              </BreadcrumbItem>
              <BreadcrumbItem isCurrent>{title}</BreadcrumbItem>
            </Breadcrumbs>
            <div className={styles.badges}>
              <Badge label={versionFor(document)} variant="purple" />
              <Badge
                label={metadata.status}
                variant={metadata.status === "deprecated" ? "warning" : "neutral"}
              />
            </div>
            <div className={styles.titleRow}>
              <h1>{title}</h1>
              <EditPageLink
                label={locale === "ko" ? "이 페이지 편집" : "Edit this page"}
                href={editHref(locale, metadata.id)}
              />
            </div>
            <p className={styles.description}>{metadata.description}</p>
            <div className={styles.metadata}>
              <span>
                {metadata.verifiedAt === undefined
                  ? locale === "ko"
                    ? "업데이트"
                    : "Updated"
                  : locale === "ko"
                    ? "검증일"
                    : "Verified"}{" "}
                <time dateTime={metadata.verifiedAt ?? metadata.updatedAt}>
                  {metadata.verifiedAt ?? metadata.updatedAt}
                </time>
              </span>
              <a href={metadata.sourceUrl} target="_blank" rel="noreferrer">
                {locale === "ko" ? "공식 출처" : "Official source"}
                <Icon icon="externalLink" size="xsm" />
              </a>
            </div>
          </header>
        )}
        <div className={styles.prose}>
          <Content />
        </div>
        <nav
          className={styles.pagination}
          aria-label={locale === "ko" ? "이전 및 다음 문서" : "Previous and next documents"}
        >
          {previous === null ? (
            <span />
          ) : (
            <Button
              label={displayTitleFor(previous)}
              href={previous.href}
              variant="secondary"
              size="lg"
            >
              <span className={styles.pageLink}>
                <small>{locale === "ko" ? "이전" : "Previous"}</small>
                {displayTitleFor(previous)}
              </span>
            </Button>
          )}
          {next === null ? (
            <span />
          ) : (
            <Button label={displayTitleFor(next)} href={next.href} variant="secondary" size="lg">
              <span className={`${styles.pageLink} ${styles.pageLinkNext}`}>
                <small>{locale === "ko" ? "다음" : "Next"}</small>
                {displayTitleFor(next)}
              </span>
            </Button>
          )}
        </nav>
      </article>
      {isOverview ? null : <DocumentOutline locale={locale} items={metadata.outline} />}
    </div>
  );
}
