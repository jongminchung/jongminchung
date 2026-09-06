import { cn } from "@jongminchung/ui/lib/utils";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  filterEditorialItems,
  getEditorialTags,
  paginateEditorialItems,
  type EditorialCopy,
  type EditorialItem,
  type EditorialQuery,
} from "#lib/editorial";
import { EditorialCard, type EditorialCardProps } from "./EditorialCard";
import {
  EditorialInfiniteResults,
  type EditorialInfiniteResultsProps,
} from "./EditorialInfiniteResults";
import { EditorialViewLink } from "./EditorialViewLink";

const PAGE_SIZE = 9;

const controlLinkClassName =
  "rounded-md border px-2.5 py-1.5 transition-colors hover:bg-accent aria-[current=page]:bg-secondary";

function queryHref(
  pathname: string,
  query: EditorialQuery,
  changes: Partial<EditorialQuery>,
): string {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.tag !== undefined) params.set("tag", next.tag);
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.view !== "grid") params.set("view", next.view);
  if (next.page !== 1) params.set("page", String(next.page));
  const search = params.toString();
  return search.length === 0 ? pathname : `${pathname}?${search}`;
}

/** `EditorialIndex` URL 동기화 topic·sort·view·점진 목록을 렌더링함 */
export function EditorialIndex({
  pathname,
  items,
  query,
  copy,
  promotedTags = [],
  tagLabels = {},
  Card = EditorialCard,
  Results = EditorialInfiniteResults,
  headerClassName,
  navigationClassName,
  tagClassName,
  resultsClassName,
  pagination,
}: {
  readonly pathname: string;
  readonly items: readonly EditorialItem[];
  readonly query: EditorialQuery;
  readonly copy: EditorialCopy;
  readonly promotedTags?: readonly string[];
  readonly tagLabels?: Readonly<Record<string, string>>;
  readonly Card?: ComponentType<EditorialCardProps>;
  readonly Results?: ComponentType<EditorialInfiniteResultsProps>;
  readonly headerClassName?: string;
  readonly navigationClassName?: string;
  readonly tagClassName?: string;
  readonly resultsClassName?: string;
  readonly pagination: "links" | "infinite";
}): React.JSX.Element {
  const tagLinkClassName = cn(
    "shrink-0 rounded-lg text-xs transition-colors aria-[current=page]:font-medium aria-[current=page]:text-foreground",
    "border px-3 py-1.5 hover:bg-accent aria-[current=page]:border-secondary aria-[current=page]:bg-secondary",
    tagClassName,
  );
  const tagPriority = new Map(
    promotedTags.map((tag, index) => [tag, index] as const),
  );
  const tags = getEditorialTags(items).toSorted((left, right) => {
    const leftPriority = tagPriority.get(left.tag);
    const rightPriority = tagPriority.get(right.tag);
    if (leftPriority !== undefined || rightPriority !== undefined)
      return (
        (leftPriority ?? Number.POSITIVE_INFINITY) -
        (rightPriority ?? Number.POSITIVE_INFINITY)
      );
    return right.count - left.count || left.tag.localeCompare(right.tag);
  });
  const selected = filterEditorialItems(items, query);
  const page = paginateEditorialItems(selected, query.page, PAGE_SIZE);
  const currentQuery = { ...query, page: page.page };
  const infiniteItems = selected.slice(0, page.page * PAGE_SIZE);
  const visibleTags = [
    ...tags.filter(({ tag }) => tag === query.tag),
    ...tags.slice(0, 7).filter(({ tag }) => tag !== query.tag),
  ];
  const remainingTags = tags.filter((entry) => !visibleTags.includes(entry));
  const resultClassName =
    query.view === "grid"
      ? "grid grid-cols-3 gap-x-5 gap-y-12 max-[840px]:grid-cols-2 max-[560px]:grid-cols-1"
      : "grid gap-4";
  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-[clamp(56px,7vw,88px)] pb-24 max-[680px]:px-4 max-[680px]:pt-10">
      <header className={cn("max-w-[760px] border-b pb-10", headerClassName)}>
        <p className="text-xs font-medium tracking-[.02em] text-muted-foreground">
          {copy.eyebrow}
        </p>
        <h1 className="mt-4 mb-0 text-[clamp(40px,5vw,56px)] leading-[1.02] font-semibold tracking-[-.04em]">
          {copy.title}
        </h1>
        <p className="mt-5 mb-0 text-[clamp(16px,2vw,18px)] leading-[1.6] text-muted-foreground">
          {copy.description}
        </p>
      </header>
      <nav
        className={cn(
          "flex gap-2 overflow-x-auto border-b py-4",
          navigationClassName,
        )}
        aria-label={copy.all}
      >
        <Link
          aria-current={query.tag === undefined ? "page" : undefined}
          className={tagLinkClassName}
          href={queryHref(pathname, currentQuery, { tag: undefined, page: 1 })}
        >
          {copy.all}
        </Link>
        {visibleTags.map(({ tag, count }) => (
          <Link
            aria-current={query.tag === tag ? "page" : undefined}
            className={tagLinkClassName}
            href={queryHref(pathname, currentQuery, { tag, page: 1 })}
            key={tag}
          >
            {tagLabels[tag] ?? tag}{" "}
            <span className="font-mono text-metadata">{count}</span>
          </Link>
        ))}
      </nav>
      {remainingTags.length > 0 ? (
        <details className="border-b py-3" key={query.tag ?? "all"}>
          <summary className="cursor-pointer text-sm focus-visible:outline-2 focus-visible:outline-ring">
            {copy.allTags}
          </summary>
          <nav aria-label={copy.allTags} className="flex flex-wrap gap-3 pt-4">
            {remainingTags.map(({ tag, count }) => (
              <Link
                className={tagLinkClassName}
                href={queryHref(pathname, currentQuery, { tag, page: 1 })}
                key={tag}
              >
                {tagLabels[tag] ?? tag}{" "}
                <span className="font-mono text-metadata">{count}</span>
              </Link>
            ))}
          </nav>
        </details>
      ) : null}
      <section
        aria-labelledby="editorial-results"
        className={cn("pt-7", resultsClassName)}
      >
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <h2
            className="m-0 font-mono text-caption tracking-metadata text-muted-foreground uppercase"
            id="editorial-results"
          >
            {copy.all} / {String(selected.length).padStart(2, "0")}
          </h2>
          <div
            className="flex items-center gap-2 text-xs"
            aria-label={copy.controls}
          >
            <Link
              aria-current={query.sort === "newest" ? "page" : undefined}
              className={controlLinkClassName}
              href={queryHref(pathname, currentQuery, {
                sort: "newest",
                page: 1,
              })}
            >
              {copy.newest}
            </Link>
            <Link
              aria-current={query.sort === "oldest" ? "page" : undefined}
              className={controlLinkClassName}
              href={queryHref(pathname, currentQuery, {
                sort: "oldest",
                page: 1,
              })}
            >
              {copy.oldest}
            </Link>
            <span aria-hidden="true" className="mx-1 h-4 border-l" />
            <EditorialViewLink
              aria-current={query.view === "grid" ? "page" : undefined}
              className={controlLinkClassName}
              href={queryHref(pathname, currentQuery, { view: "grid" })}
            >
              {copy.grid}
            </EditorialViewLink>
            <EditorialViewLink
              aria-current={query.view === "list" ? "page" : undefined}
              className={controlLinkClassName}
              href={queryHref(pathname, currentQuery, { view: "list" })}
            >
              {copy.list}
            </EditorialViewLink>
          </div>
        </div>
        {selected.length === 0 ? (
          <p className="border bg-card p-8 text-muted-foreground">
            {copy.empty}
          </p>
        ) : pagination === "infinite" ? (
          <Results
            className={resultClassName}
            endLabel={copy.end ?? copy.empty}
            hasMore={infiniteItems.length < selected.length}
            nextPageHref={queryHref(pathname, currentQuery, {
              page: page.page + 1,
            })}
            key={`${pathname}:${query.tag ?? "all"}:${query.sort}:${query.view}:${page.page}`}
            loadMoreLabel={copy.loadMore}
            view={query.view}
          >
            {infiniteItems.map((item, index) => (
              <Card eager={index < 3} item={item} key={item.id} />
            ))}
          </Results>
        ) : (
          <div
            className={resultClassName}
            data-document-grid={query.view === "grid" ? "true" : undefined}
            data-view={query.view}
          >
            {page.items.map((item, index) => (
              <Card eager={index < 3} item={item} key={item.id} />
            ))}
          </div>
        )}
        {pagination === "links" && page.totalPages > 1 ? (
          <nav
            aria-label={copy.pagination}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            {page.page > 1 ? (
              <Link
                className={controlLinkClassName}
                rel="prev"
                href={queryHref(pathname, currentQuery, {
                  page: page.page - 1,
                })}
              >
                {copy.previousPage}
              </Link>
            ) : null}
            <span role="status" className="text-sm text-muted-foreground">
              {copy.pageLabel(page.page, page.totalPages)}
            </span>
            {page.hasMore ? (
              <Link
                className={controlLinkClassName}
                rel="next"
                href={queryHref(pathname, currentQuery, {
                  page: page.page + 1,
                })}
              >
                {copy.nextPage}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
