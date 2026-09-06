import { cn } from "@jongminchung/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { EditorialImage } from "#components/EditorialImage";
import type { ContentManifestEntry, Locale } from "#lib/content-model";
import {
  createTechArticleImageHref,
  displayTitleFor,
} from "#lib/content-model";
import { getTechMessages } from "#lib/tech/copy";
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
  const text = getTechMessages(locale).article;
  const isBlogPost = document.contentType === "blog";
  const imageClassName = cn(
    "block shrink-0 self-stretch bg-muted object-cover max-[680px]:aspect-[1200/630] max-[680px]:min-h-0 max-[680px]:w-full max-[680px]:border-r-0 max-[680px]:border-b",
    variant === "list"
      ? "min-h-[150px] w-[210px] border-r"
      : "aspect-[1200/630] min-h-0 w-full border-b",
  );
  return (
    <Link
      aria-label={title}
      className={cn(
        "group flex overflow-hidden rounded-lg border bg-card text-card-foreground transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-input hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-[680px]:block",
        variant === "featured" && "block",
        variant === "related" && "block",
      )}
      href={document.href}
    >
      {isBlogPost ? (
        <EditorialImage
          alt={title}
          className={imageClassName}
          data-tech-thumbnail="true"
          eager={eager}
          height={630}
          src={createTechArticleImageHref(document.id)}
          width={1200}
        />
      ) : (
        <Image
          alt=""
          aria-hidden="true"
          className={imageClassName}
          height={630}
          loading="lazy"
          src="/tech/article-thumbnail-system.png"
          width={1200}
        />
      )}
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col justify-center px-[22px] py-5 max-[680px]:p-[18px]",
          variant === "featured" && "px-[26px] pt-6 pb-[26px]",
          variant === "related" && "min-h-[148px] justify-start p-4",
        )}
      >
        <span className="mb-2.5 flex flex-wrap items-center gap-2 font-mono text-[10px] font-medium tracking-[.08em] text-muted-foreground uppercase">
          {label ??
            series ??
            (document.documentKind === undefined
              ? text.blog
              : documentKindLabel(locale, document.documentKind))}
          <span aria-hidden="true">·</span>
          <time dateTime={document.updatedAt}>{document.updatedAt}</time>
          <span aria-hidden="true">·</span>
          {document.status}
        </span>
        <span
          className={cn(
            "text-[19px] leading-[1.25] font-[550] tracking-[-.015em] text-foreground",
            variant === "featured" && "text-[26px] max-[680px]:text-[22px]",
            variant === "related" && "text-base",
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "mt-2.5 line-clamp-2 text-[13px] leading-[1.35rem] text-muted-foreground",
            variant === "related" && "text-xs leading-[1.2rem]",
          )}
        >
          {document.description}
        </span>
      </span>
    </Link>
  );
}
