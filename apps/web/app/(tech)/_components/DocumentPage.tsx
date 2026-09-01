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
import { documentOutlineLabelsFor } from "#lib/i18n-messages";
import { editorialProseClassName } from "#lib/mdx-styles";
import { createTechArticleStructuredData } from "#lib/structured-data";
import { getTechMessages } from "#lib/tech/copy";
import { editorialMdxComponents } from "#mdx-components";
import { DocumentOutline } from "./DocumentOutline";
import { DocumentPageHeader } from "./DocumentPageHeader";
import { DocumentPager } from "./DocumentPager";
import { RelatedDocuments } from "./RelatedDocuments";
import { TechDocsMobileToc } from "./TechDocsMobileToc";

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
        <p
          className={cn(
            "m-0 text-primary",
            locale === "ko"
              ? "font-sans text-xs font-semibold tracking-normal"
              : "font-mono text-[11px] font-medium tracking-[.1em] uppercase",
          )}
        >
          {labels.thesis}
        </p>
        <p
          className={cn(
            "mt-2 mb-0 text-[16px] leading-7 font-medium text-foreground",
            locale === "ko" && "[overflow-wrap:anywhere] break-keep",
          )}
        >
          {thesis}
        </p>
      </div>
      <div>
        <p
          className={cn(
            "m-0 text-muted-foreground",
            locale === "ko"
              ? "font-sans text-xs font-semibold tracking-normal"
              : "font-mono text-[11px] font-medium tracking-[.1em] uppercase",
          )}
        >
          {labels.counterargument}
        </p>
        <p
          className={cn(
            "mt-2 mb-0 text-[15px] leading-7 text-muted-foreground",
            locale === "ko" && "[overflow-wrap:anywhere] break-keep",
          )}
        >
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
  const outlineLabels = documentOutlineLabelsFor(locale);
  return (
    <>
      <StructuredData value={createTechArticleStructuredData(metadata)} />
      <EditorialArticle
        header={<DocumentPageHeader locale={locale} document={document} />}
        rail={<DocumentOutline items={document.toc} labels={outlineLabels} />}
        variant="engineering"
      >
        <TechDocsMobileToc
          backToTopLabel={outlineLabels.backToTop}
          label={text.mobileToc}
          locale={locale}
          toc={document.toc.filter(({ depth }) => depth === 2)}
          variant="editorial"
        />
        <div
          className={cn(
            "w-full text-[15px]",
            locale === "ko" &&
              "[overflow-wrap:anywhere] break-keep [&_p]:[text-wrap:pretty]",
          )}
          lang={locale}
        >
          <div
            className={cn(editorialProseClassName, "pt-0")}
            data-copy-article="true"
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
