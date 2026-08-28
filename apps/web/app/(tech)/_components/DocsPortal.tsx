import { Badge } from "@jongminchung/ui/components/badge";
import { cn } from "@jongminchung/ui/lib/utils";
import Link from "next/link";
import { Icon } from "#components/Icon";
import {
  displayTitleFor,
  type ContentManifestEntry,
  type Locale,
} from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
import {
  createDocsHref,
  docsCategoryIds,
  docsSeriesLabel,
  documentsForDocsCategory,
  getDocsCategory,
  groupDocsDocuments,
  type DocsCategoryId,
} from "#lib/tech/docs";
import { mdxComponents } from "#mdx-components";
import { DocumentOutline } from "./DocumentOutline";
import { EditPageLink } from "./EditPageLink";

const copy = {
  ko: {
    eyebrow: "ENGINEERING DOCUMENTATION",
    title: "Docs",
    description:
      "업무 중 다시 찾을 기술 지식을 주제와 학습 순서에 따라 탐색할 수 있는 문서 모음",
    categories: "문서 분야",
    allCategories: "모든 문서 분야",
    explore: "문서 살펴보기",
    documents: "문서",
    onThisPage: "이 페이지에서",
    source: "근거 자료",
    edit: "이 페이지 편집",
    updated: "업데이트",
    previous: "이전 문서",
    next: "다음 문서",
    openMenu: "이 분야의 문서 목록",
  },
  en: {
    eyebrow: "ENGINEERING DOCUMENTATION",
    title: "Docs",
    description:
      "Topic-oriented engineering documentation designed for learning and quick reference during real work.",
    categories: "Documentation areas",
    allCategories: "All documentation areas",
    explore: "Explore documentation",
    documents: "Documents",
    onThisPage: "On this page",
    source: "Source",
    edit: "Edit this page",
    updated: "Updated",
    previous: "Previous",
    next: "Next",
    openMenu: "Documents in this area",
  },
} as const;

function editHref(locale: Locale, id: string): string {
  return `https://github.com/jongminchung/jongminchung/edit/main/apps/web/content/tech/${locale}/${id}.mdx`;
}

function DocsCategoryTabs({
  locale,
  current,
}: {
  readonly locale: Locale;
  readonly current?: DocsCategoryId;
}) {
  const text = copy[locale];
  return (
    <nav
      aria-label={text.categories}
      className="sticky top-14 z-10 border-b bg-background/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex min-h-12 w-full max-w-[1440px] items-center gap-1 overflow-x-auto px-6 max-[680px]:px-4">
        <Link
          aria-current={current === undefined ? "page" : undefined}
          className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
          href={createDocsHref(locale)}
        >
          {text.allCategories}
        </Link>
        {docsCategoryIds.map((id) => (
          <Link
            aria-current={current === id ? "page" : undefined}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            href={createDocsHref(locale, id)}
            key={id}
          >
            {getDocsCategory(id, locale).label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function DocsSidebar({
  locale,
  categoryId,
  documents,
  currentId,
  className,
}: {
  readonly locale: Locale;
  readonly categoryId: DocsCategoryId;
  readonly documents: readonly ContentManifestEntry[];
  readonly currentId?: string;
  readonly className?: string;
}) {
  const category = getDocsCategory(categoryId, locale);
  const groups = groupDocsDocuments(documents, categoryId, locale);
  return (
    <nav
      aria-label={`${category.title} ${copy[locale].documents}`}
      className={className}
    >
      <Link
        className="mb-5 block text-lg font-semibold tracking-[-.02em] text-foreground no-underline"
        href={createDocsHref(locale, categoryId)}
      >
        {category.title}
      </Link>
      <div className="grid gap-7">
        {groups.map((group) => (
          <section key={group.id}>
            <h2 className="m-0 mb-2 px-2 font-mono text-[10px] font-medium tracking-[.08em] text-muted-foreground uppercase">
              {group.label}
            </h2>
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {group.documents.map((document) => (
                <li key={document.id}>
                  <Link
                    aria-current={
                      document.id === currentId ? "page" : undefined
                    }
                    className="block rounded-md px-2 py-2 text-[13px] leading-[1.35] text-muted-foreground no-underline hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                    href={createDocsHref(locale, categoryId, document.id)}
                  >
                    {displayTitleFor(document)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

function CategoryCard({
  locale,
  categoryId,
  documents,
}: {
  readonly locale: Locale;
  readonly categoryId: DocsCategoryId;
  readonly documents: readonly ContentManifestEntry[];
}) {
  const category = getDocsCategory(categoryId, locale);
  const categoryDocuments = documentsForDocsCategory(documents, categoryId);
  return (
    <Link
      className="group flex min-h-[260px] flex-col rounded-xl border bg-card p-7 no-underline transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-input hover:shadow-[var(--elevation-medium)]"
      href={createDocsHref(locale, categoryId)}
    >
      <span className="flex items-center justify-between gap-4">
        <Badge variant="secondary">{category.label}</Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          {categoryDocuments.length} {copy[locale].documents}
        </span>
      </span>
      <span className="mt-10 block text-[28px] leading-tight font-semibold tracking-[-.035em] text-foreground">
        {category.title}
      </span>
      <span className="mt-3 block text-sm leading-6 text-muted-foreground">
        {category.description}
      </span>
      <span className="mt-auto flex items-center gap-1 pt-8 text-sm font-medium text-primary">
        {copy[locale].explore}
        <Icon
          className="size-4 transition-transform group-hover:translate-x-0.5"
          icon="chevronRight"
        />
      </span>
    </Link>
  );
}

/** `DocsLandingPage` 확장 가능한 기술 문서 카테고리 허브를 렌더링함 */
export function DocsLandingPage({
  locale,
  documents,
}: {
  readonly locale: Locale;
  readonly documents: readonly ContentManifestEntry[];
}) {
  const text = copy[locale];
  return (
    <>
      <DocsCategoryTabs locale={locale} />
      <main className="mx-auto w-full max-w-[1200px] px-6 pt-[clamp(64px,9vw,112px)] pb-24 max-[680px]:px-4 max-[680px]:pt-12">
        <header className="max-w-[760px]">
          <p className="m-0 font-mono text-[11px] font-medium tracking-[.12em] text-primary uppercase">
            {text.eyebrow}
          </p>
          <h1 className="mt-4 mb-4 text-[clamp(48px,7vw,76px)] leading-none font-semibold tracking-[-.055em]">
            {text.title}
          </h1>
          <p className="m-0 max-w-[680px] text-[18px] leading-7 text-muted-foreground">
            {text.description}
          </p>
        </header>
        <section aria-labelledby="docs-categories" className="mt-16">
          <h2
            className="mb-5 font-mono text-[11px] font-medium tracking-[.08em] text-muted-foreground uppercase"
            id="docs-categories"
          >
            {text.categories}
          </h2>
          <div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
            {docsCategoryIds.map((id) => (
              <CategoryCard
                categoryId={id}
                documents={documents}
                key={id}
                locale={locale}
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

/** `DocsCategoryPage` 한 문서 분야의 계층형 목차와 문서 목록을 렌더링함 */
export function DocsCategoryPage({
  locale,
  categoryId,
  documents,
}: {
  readonly locale: Locale;
  readonly categoryId: DocsCategoryId;
  readonly documents: readonly ContentManifestEntry[];
}) {
  const category = getDocsCategory(categoryId, locale);
  const groups = groupDocsDocuments(documents, categoryId, locale);
  return (
    <>
      <DocsCategoryTabs current={categoryId} locale={locale} />
      <main className="mx-auto grid w-full max-w-[1440px] grid-cols-[240px_minmax(0,1fr)] gap-12 px-6 py-14 max-[960px]:block max-[680px]:px-4 max-[680px]:py-10">
        <aside
          aria-label={`${category.title} ${copy[locale].documents}`}
          className="sticky top-32 max-h-[calc(100dvh-9rem)] self-start overflow-y-auto pr-4 max-[960px]:hidden"
        >
          <DocsSidebar
            categoryId={categoryId}
            documents={documents}
            locale={locale}
          />
        </aside>
        <div className="max-w-[920px] min-w-0">
          <header className="mb-14 border-b pb-10">
            <Badge variant="secondary">{category.label}</Badge>
            <h1 className="mt-5 mb-3 text-[clamp(40px,5vw,64px)] leading-none font-semibold tracking-[-.05em]">
              {category.title}
            </h1>
            <p className="m-0 max-w-[720px] text-[17px] leading-7 text-muted-foreground">
              {category.description}
            </p>
          </header>
          <div className="grid gap-14">
            {groups.map((group) => (
              <section
                aria-labelledby={`docs-group-${group.id}`}
                key={group.id}
              >
                <h2
                  className="mb-5 text-2xl font-semibold tracking-[-.025em]"
                  id={`docs-group-${group.id}`}
                >
                  {group.label}
                </h2>
                <div className="grid gap-3">
                  {group.documents.map((document) => (
                    <Link
                      className="group grid grid-cols-[1fr_auto] gap-6 rounded-lg border bg-card p-5 no-underline hover:border-input hover:shadow-[var(--elevation-low)] max-[560px]:block"
                      href={createDocsHref(locale, categoryId, document.id)}
                      key={document.id}
                    >
                      <span>
                        <span className="block text-base font-medium text-foreground">
                          {displayTitleFor(document)}
                        </span>
                        <span className="mt-1.5 block text-sm leading-5 text-muted-foreground">
                          {document.description}
                        </span>
                      </span>
                      <Icon
                        className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 max-[560px]:mt-4"
                        icon="chevronRight"
                      />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function DocsArticlePager({
  locale,
  categoryId,
  documents,
  currentId,
}: {
  readonly locale: Locale;
  readonly categoryId: DocsCategoryId;
  readonly documents: readonly ContentManifestEntry[];
  readonly currentId: string;
}) {
  const entries = documentsForDocsCategory(documents, categoryId);
  const index = entries.findIndex(({ id }) => id === currentId);
  const previous = index > 0 ? entries[index - 1] : undefined;
  const next = index >= 0 ? entries[index + 1] : undefined;
  if (previous === undefined && next === undefined) return null;
  return (
    <nav
      aria-label={locale === "ko" ? "문서 페이지 이동" : "Document pagination"}
      className="mt-16 grid grid-cols-2 gap-3 border-t pt-8 max-[560px]:grid-cols-1"
    >
      {previous === undefined ? (
        <span />
      ) : (
        <Link
          className="rounded-lg border p-4 no-underline hover:bg-muted"
          href={createDocsHref(locale, categoryId, previous.id)}
        >
          <span className="block text-xs text-muted-foreground">
            {copy[locale].previous}
          </span>
          <span className="mt-1 block text-sm font-medium text-foreground">
            {displayTitleFor(previous)}
          </span>
        </Link>
      )}
      {next === undefined ? (
        <span />
      ) : (
        <Link
          className="rounded-lg border p-4 text-right no-underline hover:bg-muted max-[560px]:text-left"
          href={createDocsHref(locale, categoryId, next.id)}
        >
          <span className="block text-xs text-muted-foreground">
            {copy[locale].next}
          </span>
          <span className="mt-1 block text-sm font-medium text-foreground">
            {displayTitleFor(next)}
          </span>
        </Link>
      )}
    </nav>
  );
}

/** `DocsArticlePage` 좌측 탐색·본문·페이지 목차를 가진 문서 화면을 렌더링함 */
export function DocsArticlePage({
  locale,
  categoryId,
  documents,
  document,
}: {
  readonly locale: Locale;
  readonly categoryId: DocsCategoryId;
  readonly documents: readonly ContentManifestEntry[];
  readonly document: LoadedDocument;
}) {
  const { Content, metadata } = document;
  const category = getDocsCategory(categoryId, locale);
  const series = docsSeriesLabel(metadata, locale);
  const text = copy[locale];
  return (
    <>
      <DocsCategoryTabs current={categoryId} locale={locale} />
      <details className="mx-4 mt-5 rounded-lg border p-3 min-[961px]:hidden">
        <summary className="cursor-pointer text-sm font-medium">
          {text.openMenu}
        </summary>
        <DocsSidebar
          categoryId={categoryId}
          className="mt-5 border-t pt-5"
          currentId={metadata.id}
          documents={documents}
          locale={locale}
        />
      </details>
      <main className="mx-auto grid w-full max-w-[1440px] grid-cols-[240px_minmax(0,760px)_200px] justify-center gap-x-12 px-6 pt-14 pb-24 max-[1280px]:grid-cols-[240px_minmax(0,760px)] max-[960px]:block max-[680px]:px-4 max-[680px]:pt-10">
        <aside
          aria-label={`${category.title} ${text.documents}`}
          className="sticky top-32 col-start-1 row-span-2 max-h-[calc(100dvh-9rem)] self-start overflow-y-auto pr-4 max-[960px]:hidden"
        >
          <DocsSidebar
            categoryId={categoryId}
            currentId={metadata.id}
            documents={documents}
            locale={locale}
          />
        </aside>
        <article className="col-start-2 min-w-0">
          <header className="border-b pb-9">
            <nav
              aria-label={locale === "ko" ? "현재 위치" : "Breadcrumb"}
              className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
            >
              <Link href={createDocsHref(locale)}>Docs</Link>
              <Icon className="size-3.5" icon="chevronRight" />
              <Link href={createDocsHref(locale, categoryId)}>
                {category.label}
              </Link>
              {series === undefined ? null : (
                <>
                  <Icon className="size-3.5" icon="chevronRight" />
                  <span>{series}</span>
                </>
              )}
            </nav>
            <h1 className="m-0 text-[clamp(36px,4.5vw,54px)] leading-[1.06] font-semibold tracking-[-.045em]">
              {displayTitleFor(metadata)}
            </h1>
            <p className="mt-5 mb-0 text-[17px] leading-7 text-muted-foreground">
              {metadata.description}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span>
                {text.updated}{" "}
                <time dateTime={metadata.updatedAt}>{metadata.updatedAt}</time>
              </span>
              <a
                className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
                href={metadata.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                {text.source}
                <Icon className="size-3.5" icon="externalLink" />
              </a>
              <EditPageLink
                href={editHref(locale, metadata.id)}
                label={text.edit}
              />
            </div>
          </header>
          <div
            className={cn(
              "pt-8 text-base leading-[1.6] tracking-[-.01em] break-words [&_[data-footnotes]]:mt-12 [&_[data-footnotes]]:border-t [&_[data-footnotes]]:pt-5 [&_[data-footnotes]]:text-sm [&_[data-footnotes]]:leading-[1.6] [&_[data-footnotes]]:text-muted-foreground [&_[data-footnotes]_a]:text-primary [&_code:not(pre_code)]:rounded-[var(--radius-xs)] [&_code:not(pre_code)]:bg-accent/55 [&_code:not(pre_code)]:px-[.3rem] [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[.875rem] [&_code:not(pre_code)]:text-primary [&_li+li]:mt-1.5 [&_table]:my-6 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:px-3 [&_td]:py-2.5 [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2.5",
            )}
            data-docs-prose="true"
            lang={locale}
          >
            <Content components={mdxComponents} />
          </div>
          <DocsArticlePager
            categoryId={categoryId}
            currentId={metadata.id}
            documents={documents}
            locale={locale}
          />
        </article>
        <aside
          aria-label={text.onThisPage}
          className="sticky top-32 col-start-3 row-start-1 max-h-[calc(100dvh-9rem)] self-start overflow-y-auto max-[1280px]:hidden"
        >
          <p className="mb-4 font-mono text-[10px] font-medium tracking-[.08em] text-muted-foreground uppercase">
            {text.onThisPage}
          </p>
          <DocumentOutline items={document.toc} />
        </aside>
      </main>
    </>
  );
}
