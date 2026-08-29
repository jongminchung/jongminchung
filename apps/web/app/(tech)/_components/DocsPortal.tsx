import { Badge } from "@jongminchung/ui/components/badge";
import Link from "next/link";
import { Icon } from "#components/Icon";
import { type ContentManifestEntry, type Locale } from "#lib/content-model";
import { getTechMessages } from "#lib/tech/copy";
import {
  createDocsHref,
  docsCategoryIds,
  documentsForDocsCategory,
  getDocsCategory,
  type DocsCategoryId,
} from "#lib/tech/docs";

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
  const text = getTechMessages(locale).docs;
  return (
    <Link
      className="group flex min-h-[260px] flex-col rounded-xl border bg-card p-7 no-underline transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-input hover:shadow-[var(--elevation-medium)]"
      href={createDocsHref(locale, categoryId)}
    >
      <span className="flex items-center justify-between gap-4">
        <Badge variant="secondary">{category.label}</Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          {categoryDocuments.length} {text.documents}
        </span>
      </span>
      <span className="mt-10 block text-[28px] leading-tight font-semibold tracking-[-.035em] text-foreground">
        {category.title}
      </span>
      <span className="mt-3 block text-sm leading-6 text-muted-foreground">
        {category.description}
      </span>
      <span className="mt-auto flex items-center gap-1 pt-8 text-sm font-medium text-primary">
        {text.explore}
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
  const text = getTechMessages(locale).docs;
  return (
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
  );
}
