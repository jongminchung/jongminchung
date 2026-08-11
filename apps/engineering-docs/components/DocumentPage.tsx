import { Badge } from "@jongminchung/ui/components/badge";
import { cn } from "@jongminchung/ui/lib/utils";
import {
  createSectionHref,
  displayTitleFor,
  type DocSection,
  type Locale,
} from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
import { DocumentOutline } from "./DocumentOutline";
import { EditPageLink } from "./EditPageLink";
import { Icon } from "./Icon";
import { RelatedDocuments } from "./RelatedDocuments";
import { TransitionLink } from "./RouteTransition";
import styles from "./DocumentPage.module.css";

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

function editHref(locale: Locale, id: string): string {
  return `https://github.com/jongminchung/jongminchung/edit/main/apps/engineering-docs/content/${locale}/${id}.mdx`;
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
  const sectionHref = createSectionHref(locale, metadata.section);
  return (
    <div className="mx-auto grid w-full max-w-[1160px] grid-cols-[minmax(0,1fr)_224px] gap-8 px-[50px] pt-[50px] pb-24 max-[1400px]:block max-[1400px]:max-w-[860px] max-[1400px]:px-8 min-[769px]:max-[1024px]:pt-7 max-[600px]:px-4 max-[600px]:pt-8 max-[600px]:pb-[72px]">
      <article
        className={
          isOverview
            ? "col-span-full min-w-0"
            : "min-w-0 w-full max-w-[80ch] justify-self-center text-[14px]"
        }
        lang={locale}
      >
        {isOverview ? null : (
          <header className="border-b border-border pb-8">
            <nav aria-label={locale === "ko" ? "현재 위치" : "Breadcrumb"}>
              <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <li>
                  <TransitionLink href={`/${locale}/overview`}>Docs</TransitionLink>
                </li>
                <li aria-hidden="true">
                  <Icon icon="chevronRight" className="size-3" />
                </li>
                <li>
                  <TransitionLink href={sectionHref}>
                    {sectionLabels[locale][metadata.section]}
                  </TransitionLink>
                </li>
                <li aria-hidden="true">
                  <Icon icon="chevronRight" className="size-3" />
                </li>
                <li aria-current="page" className="text-foreground">
                  {title}
                </li>
              </ol>
            </nav>
            <div className="mt-6 mb-4 flex gap-1.5">
              <Badge variant="default">{metadata.packageVersion ?? "v1"}</Badge>
              <Badge
                className={
                  metadata.status === "deprecated"
                    ? "border-warning/30 bg-warning-muted text-warning-muted-foreground"
                    : undefined
                }
                variant={metadata.status === "deprecated" ? "outline" : "secondary"}
              >
                {metadata.status}
              </Badge>
            </div>
            <div className="flex items-start gap-3">
              <h1 className="m-0 flex-1 font-[family-name:var(--font-inter-tight)] text-[36px] leading-[1.1] font-medium tracking-[-0.025em] text-primary">
                {title}
              </h1>
              <EditPageLink
                label={locale === "ko" ? "이 페이지 편집" : "Edit this page"}
                href={editHref(locale, metadata.id)}
              />
            </div>
            <p className="mt-4 mb-0 max-w-[720px] text-base leading-[1.55] text-muted-foreground">
              {metadata.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-x-[18px] gap-y-2 text-xs text-muted-foreground">
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
              <a
                className="inline-flex items-center gap-1 text-primary"
                href={metadata.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {locale === "ko" ? "공식 출처" : "Official source"}
                <Icon icon="externalLink" className="size-3" />
              </a>
            </div>
          </header>
        )}
        <div className={`${styles.prose} ${isOverview ? "" : "pt-[18px]"}`} data-docs-prose="true">
          <Content />
        </div>
        {isOverview ? null : <RelatedDocuments documents={document.related} locale={locale} />}
        <nav
          className="mt-[72px] grid grid-cols-2 gap-3 border-t border-border pt-6 max-[600px]:grid-cols-1 [&>*]:min-h-[68px]"
          aria-label={locale === "ko" ? "이전 및 다음 문서" : "Previous and next documents"}
        >
          {previous === null ? (
            <span />
          ) : (
            <TransitionLink
              className={cn(
                "inline-flex h-auto min-h-[68px] shrink-0 items-center justify-start gap-2 whitespace-nowrap rounded-md border border-border bg-card px-5 text-sm font-medium text-card-foreground outline-none transition-colors",
                "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60",
              )}
              href={previous.href}
            >
              <span className="grid w-full gap-0.5 text-left">
                <small className="text-primary text-[10px] font-medium uppercase">
                  {locale === "ko" ? "이전" : "Previous"}
                </small>
                {displayTitleFor(previous)}
              </span>
            </TransitionLink>
          )}
          {next === null ? (
            <span />
          ) : (
            <TransitionLink
              className={cn(
                "inline-flex h-auto min-h-[68px] shrink-0 items-center justify-end gap-2 whitespace-nowrap rounded-md border border-border bg-card px-5 text-sm font-medium text-card-foreground outline-none transition-colors",
                "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60",
              )}
              href={next.href}
            >
              <span className="grid w-full gap-0.5 text-right">
                <small className="text-primary text-[10px] font-medium uppercase">
                  {locale === "ko" ? "다음" : "Next"}
                </small>
                {displayTitleFor(next)}
              </span>
            </TransitionLink>
          )}
        </nav>
      </article>
      {isOverview ? null : <DocumentOutline locale={locale} items={metadata.outline} />}
    </div>
  );
}
