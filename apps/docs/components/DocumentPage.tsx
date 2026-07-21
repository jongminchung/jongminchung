import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayTitleFor, type DocSection, type Locale } from "@/lib/content-model";
import type { LoadedDocument } from "@/lib/documents";
import { DocumentOutline } from "./DocumentOutline";
import { EditPageLink } from "./EditPageLink";
import { Icon } from "./Icon";
import { TransitionLink } from "./RouteTransition";
import styles from "./DocumentPage.module.css";

const versionById: Readonly<Record<string, string>> = {
  "deep-dive/nextjs-16": "16.2.10",
  "deep-dive/pnpm-11": "11.13.0",
  "deep-dive/node-26": "26.5.0",
  "deep-dive/typescript-6": "6.0.3",
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
              <Badge variant="default">{versionFor(document)}</Badge>
              <Badge variant={metadata.status === "deprecated" ? "warning" : "secondary"}>
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
        <nav
          className="mt-[72px] grid grid-cols-2 gap-3 border-t border-border pt-6 max-[600px]:grid-cols-1 [&>*]:min-h-[68px]"
          aria-label={locale === "ko" ? "이전 및 다음 문서" : "Previous and next documents"}
        >
          {previous === null ? (
            <span />
          ) : (
            <Button asChild variant="secondary" size="lg">
              <TransitionLink href={previous.href} className="h-auto min-h-[68px] justify-start">
                <span className="grid w-full gap-0.5 text-left">
                  <small className="text-primary text-[10px] font-medium uppercase">
                    {locale === "ko" ? "이전" : "Previous"}
                  </small>
                  {displayTitleFor(previous)}
                </span>
              </TransitionLink>
            </Button>
          )}
          {next === null ? (
            <span />
          ) : (
            <Button asChild variant="secondary" size="lg">
              <TransitionLink href={next.href} className="h-auto min-h-[68px] justify-end">
                <span className="grid w-full gap-0.5 text-right">
                  <small className="text-primary text-[10px] font-medium uppercase">
                    {locale === "ko" ? "다음" : "Next"}
                  </small>
                  {displayTitleFor(next)}
                </span>
              </TransitionLink>
            </Button>
          )}
        </nav>
      </article>
      {isOverview ? null : <DocumentOutline locale={locale} items={metadata.outline} />}
    </div>
  );
}
