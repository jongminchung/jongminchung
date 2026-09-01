import { cn } from "@jongminchung/ui/lib/utils";
import Link from "next/link";
import { Icon } from "#components/Icon";
import {
  createSeriesHref,
  displayTitleFor,
  type Locale,
} from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
import { formatEditorialDate } from "#lib/i18n-date";
import { getTechMessages } from "#lib/tech/copy";
import { documentKindLabel } from "#lib/tech/document-kind";
import { getSeries } from "#lib/tech/series";
import { ArticleCopyButton } from "./ArticleCopyButton";
import { EditPageLink } from "./EditPageLink";

function editHref(locale: Locale, id: string): string {
  return `https://github.com/jongminchung/jongminchung/edit/main/apps/web/content/tech/blog/${locale}/${id}.mdx`;
}

/** `DocumentPageHeader` UI 컴포넌트를 렌더링함 */
export function DocumentPageHeader({
  locale,
  document,
}: {
  readonly locale: Locale;
  readonly document: LoadedDocument;
}) {
  const { metadata } = document;
  const text = getTechMessages(locale).article;
  const series = metadata.contentType === "blog" ? metadata.series : undefined;
  const title = displayTitleFor(metadata);
  const section =
    series === undefined
      ? "Engineering"
      : (getSeries(series, locale)?.title ?? "Engineering");
  const category =
    metadata.documentKind === undefined
      ? section
      : `${section} · ${documentKindLabel(locale, metadata.documentKind)}`;
  return (
    <div>
      <nav aria-label={text.breadcrumb} className="sr-only">
        <ol>
          <li>
            <Link href={`/${locale}`}>{text.articles}</Link>
          </li>
          <li aria-hidden="true">
            <Icon icon="chevronRight" className="size-3" />
          </li>
          {series === undefined ? null : (
            <>
              <li>
                <Link href={createSeriesHref(locale, series)}>
                  {getSeries(series, locale)?.title}
                </Link>
              </li>
              <li aria-hidden="true">
                <Icon icon="chevronRight" className="size-3" />
              </li>
            </>
          )}
          <li aria-current="page" className="text-foreground">
            {title}
          </li>
        </ol>
      </nav>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-1 text-sm",
          locale === "ko" && "[overflow-wrap:anywhere] break-keep",
        )}
      >
        <time
          className="font-medium text-foreground"
          dateTime={metadata.publishedAt}
        >
          {formatEditorialDate(locale, metadata.publishedAt)}
        </time>
        <span className="text-muted-foreground">{category}</span>
      </div>
      <h1
        className={cn(
          "mt-3 mb-0 max-w-[780px] font-sans text-[clamp(34px,4vw,44px)] leading-[1.1] font-semibold text-foreground",
          locale === "ko"
            ? "tracking-[-0.018em] [text-wrap:balance] [overflow-wrap:anywhere] break-keep"
            : "tracking-[-0.035em]",
        )}
        data-copy-title="true"
      >
        {title}
      </h1>
      <p
        className={cn(
          "mt-3 mb-0 max-w-2xl text-[17px] leading-[1.625] text-muted-foreground",
          locale === "ko" &&
            "[text-wrap:pretty] [overflow-wrap:anywhere] break-keep",
        )}
        data-copy-description="true"
      >
        {metadata.description}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span>
          {metadata.verifiedAt === undefined ? text.updated : text.verified}{" "}
          <time dateTime={metadata.verifiedAt ?? metadata.updatedAt}>
            {formatEditorialDate(
              locale,
              metadata.verifiedAt ?? metadata.updatedAt,
            )}
          </time>
        </span>
        <a
          className="-my-2 inline-flex min-h-11 items-center gap-1 font-medium text-primary underline underline-offset-4"
          href={metadata.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {text.source}
          <Icon icon="externalLink" className="size-3" />
        </a>
        <EditPageLink label={text.edit} href={editHref(locale, metadata.id)} />
        <ArticleCopyButton
          copiedLabel={text.copied}
          copyLabel={text.copy}
          failedLabel={text.copyFailed}
        />
      </div>
    </div>
  );
}
