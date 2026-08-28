import Link from "next/link";
import { Icon } from "#components/Icon";
import {
  createSeriesHref,
  displayTitleFor,
  type Locale,
} from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
import { documentKindLabel } from "#lib/tech/document-kind";
import { getSeries } from "#lib/tech/series";
import { EditPageLink } from "./EditPageLink";

function editHref(locale: Locale, id: string): string {
  return `https://github.com/jongminchung/jongminchung/edit/main/apps/web/content/tech/${locale}/${id}.mdx`;
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
  const title = displayTitleFor(metadata);
  const section =
    metadata.series === undefined
      ? locale === "ko"
        ? "Engineering"
        : "Engineering"
      : (getSeries(metadata.series, locale)?.title ?? "Engineering");
  const category =
    metadata.documentKind === undefined
      ? section
      : `${section} · ${documentKindLabel(locale, metadata.documentKind)}`;
  return (
    <div className="text-center">
      <nav
        aria-label={locale === "ko" ? "현재 위치" : "Breadcrumb"}
        className="sr-only"
      >
        <ol>
          <li>
            <Link href={`/${locale}`}>Articles</Link>
          </li>
          <li aria-hidden="true">
            <Icon icon="chevronRight" className="size-3" />
          </li>
          {metadata.series === undefined ? null : (
            <>
              <li>
                <Link href={createSeriesHref(locale, metadata.series)}>
                  {getSeries(metadata.series, locale)?.title}
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
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        <time
          className="font-medium text-foreground"
          dateTime={metadata.publishedAt}
        >
          {metadata.publishedAt}
        </time>
        <span className="text-muted-foreground">{category}</span>
      </div>
      <h1 className="mx-auto mt-2 mb-0 max-w-[780px] font-sans text-[clamp(32px,4vw,40px)] leading-[1.12] font-semibold tracking-[-0.03em] text-foreground">
        {title}
      </h1>
      <p className="mx-auto mt-3 mb-0 max-w-xl text-[18px] leading-[1.625] text-muted-foreground">
        {metadata.description}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span>
          {metadata.verifiedAt === undefined
            ? locale === "ko"
              ? "업데이트"
              : "Updated"
            : locale === "ko"
              ? "검증일"
              : "Verified"}{" "}
          <time dateTime={metadata.verifiedAt ?? metadata.updatedAt}>
            {metadata.verifiedAt ?? metadata.updatedAt}
          </time>
        </span>
        <a
          className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
          href={metadata.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {locale === "ko" ? "근거 자료" : "Source"}
          <Icon icon="externalLink" className="size-3" />
        </a>
        <EditPageLink
          label={locale === "ko" ? "이 페이지 편집" : "Edit this page"}
          href={editHref(locale, metadata.id)}
        />
      </div>
    </div>
  );
}
