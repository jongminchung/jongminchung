import { cn } from "@jongminchung/ui/lib/utils";
import Image from "next/image";
import { EditorialArticle } from "#components/EditorialArticle";
import { StructuredData } from "#components/StructuredData";
import {
  createTechArticleImageHref,
  displayTitleFor,
  type Locale,
} from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
import { editorialProseClassName } from "#lib/mdx-styles";
import { createTechArticleStructuredData } from "#lib/structured-data";
import { getTechMessages } from "#lib/tech/copy";
import { editorialMdxComponents } from "#mdx-components";
import { DocumentOutline } from "./DocumentOutline";
import { DocumentPageHeader } from "./DocumentPageHeader";
import { DocumentPager } from "./DocumentPager";
import { RelatedDocuments } from "./RelatedDocuments";

function ArticleArgument({
  locale,
  thesis,
  counterargument,
}: {
  readonly locale: Locale;
  readonly thesis: string;
  readonly counterargument: string;
}) {
  const labels = getTechMessages(locale).article;
  return (
    <aside
      aria-label={labels.argument}
      className="mb-10 grid gap-5 border-y py-6 sm:grid-cols-2 sm:gap-8"
      data-article-argument="true"
    >
      <div>
        <p className="m-0 font-mono text-[11px] font-medium tracking-[.1em] text-primary uppercase">
          {labels.thesis}
        </p>
        <p className="mt-2 mb-0 text-[16px] leading-7 font-medium text-foreground">
          {thesis}
        </p>
      </div>
      <div>
        <p className="m-0 font-mono text-[11px] font-medium tracking-[.1em] text-muted-foreground uppercase">
          {labels.counterargument}
        </p>
        <p className="mt-2 mb-0 text-[15px] leading-7 text-muted-foreground">
          {counterargument}
        </p>
      </div>
    </aside>
  );
}

/** `DocumentPage` 페이지 UI를 렌더링함 */
export function DocumentPage({
  locale,
  document,
}: {
  readonly locale: Locale;
  readonly document: LoadedDocument;
}) {
  const { Content, metadata, previous, next } = document;
  const text = getTechMessages(locale).article;
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
            className={cn(editorialProseClassName, "pt-0")}
            data-docs-prose="true"
          >
            {metadata.contentType === "blog" ? (
              <>
                <figure className="mt-0 mb-10" data-tech-article-hero="true">
                  <Image
                    alt={displayTitleFor(metadata)}
                    className="aspect-[1.6] w-full rounded-[var(--radius)] border object-cover"
                    height={1024}
                    preload
                    sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 1279px) calc(100vw - 64px), 760px"
                    src={createTechArticleImageHref(metadata.id)}
                    width={1536}
                  />
                  <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                    {text.generatedImage}
                  </figcaption>
                </figure>
                <ArticleArgument
                  counterargument={metadata.counterargument}
                  locale={locale}
                  thesis={metadata.thesis}
                />
              </>
            ) : null}
            <Content components={editorialMdxComponents} />
          </div>
          <RelatedDocuments documents={document.related} locale={locale} />
          <DocumentPager locale={locale} previous={previous} next={next} />
        </div>
      </EditorialArticle>
    </>
  );
}
