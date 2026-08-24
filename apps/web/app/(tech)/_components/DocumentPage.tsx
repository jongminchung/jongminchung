import { cn } from "@jongminchung/ui/lib/utils";
import { EditorialArticle } from "#components/Editorial";
import type { Locale } from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
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
  const { metadata, Content, previous, next } = document;
  return (
    <EditorialArticle
      header={<DocumentPageHeader locale={locale} document={document} />}
      rail={<DocumentOutline locale={locale} items={metadata.outline} />}
      variant="engineering"
    >
      <div className="w-full text-[15px]" lang={locale}>
        <div
          className={cn(
            "text-sm leading-[1.4rem] tracking-[-.00875rem] break-words [&>h2]:mt-14 [&>h2]:mb-4 [&>h2]:scroll-mt-6 [&>h2]:text-[32px] [&>h2]:leading-[1.2] [&>h2]:font-medium [&>h2]:tracking-[-.02em] [&>h3]:mt-9 [&>h3]:mb-3 [&>h3]:scroll-mt-6 [&>h3]:text-2xl [&>h3]:leading-[1.25] [&>h3]:font-medium [&>h3]:tracking-[-.012em] [&_p]:my-4 [&_ul]:my-4 [&_ol]:my-4 [&_table]:my-4 [&_blockquote]:my-4 [&_li+li]:mt-1 [&_code:not(pre_code)]:rounded-[var(--radius-xs)] [&_code:not(pre_code)]:bg-accent/55 [&_code:not(pre_code)]:px-[.3rem] [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[.875rem] [&_code:not(pre_code)]:text-primary [&_.docs-code-block]:relative [&_.docs-code-block]:my-4 [&_.docs-code-block]:max-w-full [&_.docs-code-block]:overflow-hidden [&_.docs-code-block]:rounded-[var(--radius-xs)] [&_.docs-code-block]:border [&_.docs-code-block]:bg-muted [&_.docs-code-block]:font-mono [&_.docs-code-block]:text-sm [&_.docs-code-block]:leading-[1.4rem] [&_.docs-code-block_[role=group]]:max-w-full [&_.docs-code-block_[role=group]]:overflow-x-auto [&_.docs-code-block_[role=group]]:py-3 [&_blockquote]:border-l-[3px] [&_blockquote]:border-input [&_blockquote]:bg-muted [&_blockquote]:px-[18px] [&_blockquote]:py-[14px] [&_blockquote]:text-muted-foreground [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2.5 [&_td]:border [&_td]:px-3 [&_td]:py-2.5 [&_[data-footnotes]]:mt-10 [&_[data-footnotes]]:border-t [&_[data-footnotes]]:pt-[18px] [&_[data-footnotes]]:text-[13px] [&_[data-footnotes]]:leading-[1.35rem] [&_[data-footnotes]]:text-muted-foreground [&_[data-footnotes]_a]:text-primary",
            "pt-[18px]",
          )}
          data-docs-prose="true"
        >
          <Content />
        </div>
        <RelatedDocuments documents={document.related} locale={locale} />
        <DocumentPager locale={locale} previous={previous} next={next} />
      </div>
    </EditorialArticle>
  );
}
