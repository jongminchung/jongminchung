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
      className="group flex min-h-[228px] flex-col rounded-lg border bg-card p-6 no-underline transition-[border-color,background-color] hover:border-input hover:bg-muted/35"
      href={createDocsHref(locale, categoryId)}
    >
      <span className="flex items-center justify-between gap-4">
        <Badge variant="secondary">{category.label}</Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          {categoryDocuments.length} {text.documents}
        </span>
      </span>
      <span className="mt-9 block text-[24px] leading-tight font-semibold tracking-[-.025em] text-foreground">
        {category.title}
      </span>
      <span className="mt-3 block text-sm leading-6 text-muted-foreground">
        {category.description}
      </span>
      <span className="mt-auto flex items-center gap-1 pt-7 text-sm font-medium text-foreground">
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
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-[clamp(56px,7vw,88px)] pb-24 max-[680px]:px-4 max-[680px]:pt-10">
      <header className="max-w-[760px]">
        <p className="m-0 text-xs font-medium tracking-[.02em] text-muted-foreground">
          {text.eyebrow}
        </p>
        <h1 className="mt-4 mb-4 text-[clamp(36px,5vw,48px)] leading-[1.05] font-semibold tracking-[-.035em]">
          {text.title}
        </h1>
        <p className="m-0 max-w-[680px] text-[17px] leading-7 text-muted-foreground">
          {text.description}
        </p>
      </header>
      <section
        aria-labelledby="docs-categories"
        className="mt-14 border-t pt-10"
      >
        <h2
          className="mb-5 text-[28px] leading-tight font-semibold tracking-[-.025em]"
          id="docs-categories"
        >
          {text.categories}
        </h2>
        <div className="grid grid-cols-2 gap-5 max-[680px]:grid-cols-1">
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
