import { cn } from "@jongminchung/ui/lib/utils";
import { EditorialArticle } from "#components/Editorial";
import { StructuredData } from "#components/StructuredData";
import type { Locale } from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
import { createTechArticleStructuredData } from "#lib/structured-data";
import { mdxComponents } from "#mdx-components";
import { DocumentOutline } from "./DocumentOutline";
import { DocumentPageHeader } from "./DocumentPageHeader";
import { DocumentPager } from "./DocumentPager";
import { RelatedDocuments } from "./RelatedDocuments";

/** `DocumentPage` 페이지 UI를 렌더링함 */
export function DocumentPage({
  locale,
  document,
}: {
  readonly locale: Locale;
  readonly document: LoadedDocument;
}) {
  const { Content, metadata, previous, next } = document;
  return (
    <>
      <StructuredData value={createTechArticleStructuredData(metadata)} />
      <EditorialArticle
        header={<DocumentPageHeader locale={locale} document={document} />}
        rail={<DocumentOutline items={document.toc} />}
        variant="engineering"
      >
        <div className="w-full text-[15px]" lang={locale}>
          <div
            className={cn(
              "text-base leading-[1.6] tracking-[-.01em] break-words [&_[data-footnotes]]:mt-12 [&_[data-footnotes]]:border-t [&_[data-footnotes]]:pt-5 [&_[data-footnotes]]:text-sm [&_[data-footnotes]]:leading-[1.6] [&_[data-footnotes]]:text-muted-foreground [&_[data-footnotes]_a]:text-primary [&_code:not(pre_code)]:rounded-[var(--radius-xs)] [&_code:not(pre_code)]:bg-accent/55 [&_code:not(pre_code)]:px-[.3rem] [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[.875rem] [&_code:not(pre_code)]:text-primary [&_li+li]:mt-1.5 [&_td]:border [&_td]:px-3 [&_td]:py-2.5 [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2.5 [&>h2:first-child]:mt-4",
              "pt-0",
            )}
            data-docs-prose="true"
          >
            <Content components={mdxComponents} />
          </div>
          <RelatedDocuments documents={document.related} locale={locale} />
          <DocumentPager locale={locale} previous={previous} next={next} />
        </div>
      </EditorialArticle>
    </>
  );
}
