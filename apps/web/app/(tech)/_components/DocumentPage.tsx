import { cn } from "@jongminchung/ui/lib/utils";
import { EditorialArticle } from "#components/Editorial";
import type { Locale } from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
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
  const { Content, previous, next } = document;
  return (
    <EditorialArticle
      header={<DocumentPageHeader locale={locale} document={document} />}
      rail={<DocumentOutline items={document.toc} />}
      variant="engineering"
    >
      <div className="w-full text-[15px]" lang={locale}>
        <div
          className={cn(
            "text-sm leading-[1.4rem] tracking-[-.00875rem] break-words [&_[data-footnotes]]:mt-10 [&_[data-footnotes]]:border-t [&_[data-footnotes]]:pt-[18px] [&_[data-footnotes]]:text-[13px] [&_[data-footnotes]]:leading-[1.35rem] [&_[data-footnotes]]:text-muted-foreground [&_[data-footnotes]_a]:text-primary [&_blockquote]:my-4 [&_blockquote]:border-l-[3px] [&_blockquote]:border-input [&_blockquote]:bg-muted [&_blockquote]:px-[18px] [&_blockquote]:py-[14px] [&_blockquote]:text-muted-foreground [&_code:not(pre_code)]:rounded-[var(--radius-xs)] [&_code:not(pre_code)]:bg-accent/55 [&_code:not(pre_code)]:px-[.3rem] [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[.875rem] [&_code:not(pre_code)]:text-primary [&_li+li]:mt-1 [&_ol]:my-4 [&_p]:my-4 [&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:px-3 [&_td]:py-2.5 [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2.5 [&_ul]:my-4 [&>h2]:mt-14 [&>h2]:mb-4 [&>h2]:scroll-mt-6 [&>h2]:text-[32px] [&>h2]:leading-[1.2] [&>h2]:font-medium [&>h2]:tracking-[-.02em] [&>h3]:mt-9 [&>h3]:mb-3 [&>h3]:scroll-mt-6 [&>h3]:text-2xl [&>h3]:leading-[1.25] [&>h3]:font-medium [&>h3]:tracking-[-.012em]",
            "pt-[18px]",
          )}
          data-docs-prose="true"
        >
          <Content components={mdxComponents} />
        </div>
        <RelatedDocuments documents={document.related} locale={locale} />
        <DocumentPager locale={locale} previous={previous} next={next} />
      </div>
    </EditorialArticle>
  );
}
