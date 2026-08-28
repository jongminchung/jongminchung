import Image from "next/image";
import Link from "next/link";
import type { ContentManifestEntry, Locale } from "#lib/content-model";
import {
  createTechArticleImageHref,
  displayTitleFor,
} from "#lib/content-model";
import { documentKindLabel } from "#lib/tech/document-kind";

export type DocumentCardVariant = "featured" | "list" | "related";

/** `DocumentCard` UI 컴포넌트를 렌더링함 */
export function DocumentCard({
  document,
  locale,
  variant,
  label,
  series,
  eager = false,
}: {
  readonly document: ContentManifestEntry;
  readonly locale: Locale;
  readonly variant: DocumentCardVariant;
  readonly label?: string;
  readonly series?: string;
  readonly eager?: boolean;
}): React.JSX.Element {
  const title = displayTitleFor(document);
  const isBlogPost = document.contentType === "blog";
  const imageSource = isBlogPost
    ? createTechArticleImageHref(document.id)
    : "/tech/article-thumbnail-system.png";
  return (
    <Link
      aria-label={title}
      className="group flex overflow-hidden rounded-[var(--radius)] border bg-card text-card-foreground transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-input hover:shadow-[var(--elevation-medium)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[variant=featured]:block data-[variant=related]:block max-[680px]:block"
      data-variant={variant}
      href={document.href}
    >
      <Image
        alt={isBlogPost ? title : ""}
        aria-hidden={isBlogPost ? undefined : "true"}
        className="block min-h-[150px] w-[210px] shrink-0 self-stretch border-r bg-muted object-cover group-data-[variant=featured]:aspect-[1200/630] group-data-[variant=featured]:min-h-0 group-data-[variant=featured]:w-full group-data-[variant=featured]:border-r-0 group-data-[variant=featured]:border-b group-data-[variant=related]:aspect-[1200/630] group-data-[variant=related]:min-h-0 group-data-[variant=related]:w-full group-data-[variant=related]:border-r-0 group-data-[variant=related]:border-b max-[680px]:aspect-[1200/630] max-[680px]:min-h-0 max-[680px]:w-full max-[680px]:border-r-0 max-[680px]:border-b"
        height={630}
        preload={eager}
        src={imageSource}
        width={1200}
        {...(isBlogPost ? { "data-tech-thumbnail": "true" } : {})}
      />
      <span className="flex min-w-0 flex-1 flex-col justify-center px-[22px] py-5 group-data-[variant=featured]:px-[26px] group-data-[variant=featured]:pt-6 group-data-[variant=featured]:pb-[26px] group-data-[variant=related]:min-h-[148px] group-data-[variant=related]:justify-start group-data-[variant=related]:p-4 max-[680px]:p-[18px]">
        <span className="mb-2.5 flex flex-wrap items-center gap-2 font-mono text-[10px] font-medium tracking-[.08em] text-muted-foreground uppercase">
          {label ??
            series ??
            (document.documentKind === undefined
              ? locale === "ko"
                ? "블로그"
                : "Blog"
              : documentKindLabel(locale, document.documentKind))}
          <span aria-hidden="true">·</span>
          <time dateTime={document.updatedAt}>{document.updatedAt}</time>
          <span aria-hidden="true">·</span>
          {document.status}
        </span>
        <span className="text-[19px] leading-[1.25] font-[550] tracking-[-.015em] text-foreground group-data-[variant=featured]:text-[26px] group-data-[variant=related]:text-base max-[680px]:group-data-[variant=featured]:text-[22px]">
          {title}
        </span>
        <span className="mt-2.5 line-clamp-2 text-[13px] leading-[1.35rem] text-muted-foreground group-data-[variant=related]:text-xs group-data-[variant=related]:leading-[1.2rem]">
          {document.description}
        </span>
      </span>
    </Link>
  );
}
