import Link from "next/link";
import { Icon } from "#components/Icon";
import {
  createSeriesHref,
  displayTitleFor,
  type Locale,
} from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
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
  return (
    <div>
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
      <p className="m-0 font-mono text-[11px] font-medium tracking-[.08em] text-muted-foreground">
        {section}
      </p>
      <div className="mt-4 flex items-start gap-3">
        <h1 className="m-0 flex-1 font-sans text-[clamp(40px,4.5vw,58px)] leading-[1.03] font-medium tracking-[-0.045em] text-foreground">
          {title}
        </h1>
        <EditPageLink
          label={locale === "ko" ? "이 페이지 편집" : "Edit this page"}
          href={editHref(locale, metadata.id)}
        />
      </div>
      <p className="mt-5 mb-0 max-w-[650px] text-[17px] leading-[1.55] text-muted-foreground">
        {metadata.description}
      </p>
      <div className="mt-6 flex flex-wrap gap-x-[18px] gap-y-2 font-mono text-[11px] text-muted-foreground">
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
          className="inline-flex items-center gap-1 text-primary"
          href={metadata.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {locale === "ko" ? "공식 출처" : "Official source"}
          <Icon icon="externalLink" className="size-3" />
        </a>
      </div>
    </div>
  );
}
