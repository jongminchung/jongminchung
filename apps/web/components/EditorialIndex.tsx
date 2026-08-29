import Link from "next/link";
import {
  filterEditorialItems,
  getEditorialTags,
  paginateEditorialItems,
  type EditorialCopy,
  type EditorialItem,
  type EditorialQuery,
} from "#lib/editorial";
import { EditorialCard } from "./EditorialCard";
import { EditorialInfiniteResults } from "./EditorialInfiniteResults";

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
  variant = "default",
  pagination = "links",
}: {
  readonly pathname: string;
  readonly items: readonly EditorialItem[];
  readonly query: EditorialQuery;
  readonly copy: EditorialCopy;
  readonly promotedTags?: readonly string[];
  readonly tagLabels?: Readonly<Record<string, string>>;
  readonly variant?: "default" | "engineering";
  readonly pagination?: "links" | "infinite";
}): React.JSX.Element {
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
  const page = paginateEditorialItems(selected, query.page);
  const resultClassName =
    query.view === "grid"
      ? "grid grid-cols-3 gap-x-5 gap-y-12 max-[840px]:grid-cols-2 max-[560px]:grid-cols-1"
      : "grid gap-4";
  return (
    <main
      className="mx-auto w-full max-w-[1200px] px-6 pt-[clamp(64px,9vw,112px)] pb-24 data-[variant=engineering]:pt-[clamp(70px,8vw,112px)] max-[680px]:px-4 max-[680px]:pt-12"
      data-variant={variant}
    >
      <header className="max-w-[760px] border-b pb-12 data-[variant=engineering]:max-w-none data-[variant=engineering]:border-b-0 data-[variant=engineering]:pb-3">
        <p className="font-mono text-[11px] font-medium tracking-[.12em] text-primary uppercase">
          {copy.eyebrow}
        </p>
        <h1 className="mt-4 mb-0 text-[clamp(44px,6vw,76px)] leading-[.98] font-medium tracking-[-.055em] data-[variant=engineering]:text-[clamp(44px,5vw,64px)]">
          {copy.title}
        </h1>
        <p className="mt-6 mb-0 text-[clamp(17px,2vw,21px)] leading-[1.6] text-muted-foreground">
          {copy.description}
        </p>
      </header>
      <nav
        className="flex gap-2 overflow-x-auto border-b py-4 data-[variant=engineering]:gap-5 data-[variant=engineering]:border-b-0 data-[variant=engineering]:py-5"
        aria-label={copy.all}
        data-variant={variant}
      >
        <Link
          aria-current={query.tag === undefined ? "page" : undefined}
          className="shrink-0 border px-3 py-1.5 text-xs data-[current=true]:bg-foreground data-[current=true]:text-background data-[variant=engineering]:border-0 data-[variant=engineering]:p-0 data-[variant=engineering]:text-muted-foreground data-[variant=engineering]:data-[current=true]:bg-transparent data-[variant=engineering]:data-[current=true]:font-medium data-[variant=engineering]:data-[current=true]:text-foreground"
          data-current={query.tag === undefined}
          data-variant={variant}
          href={queryHref(pathname, query, { tag: undefined, page: 1 })}
        >
          {copy.all}
        </Link>
        {tags.slice(0, 7).map(({ tag, count }) => (
          <Link
            aria-current={query.tag === tag ? "page" : undefined}
            className="shrink-0 border px-3 py-1.5 text-xs data-[current=true]:bg-foreground data-[current=true]:text-background data-[variant=engineering]:border-0 data-[variant=engineering]:p-0 data-[variant=engineering]:text-muted-foreground data-[variant=engineering]:data-[current=true]:bg-transparent data-[variant=engineering]:data-[current=true]:font-medium data-[variant=engineering]:data-[current=true]:text-foreground"
            data-current={query.tag === tag}
            data-variant={variant}
            href={queryHref(pathname, query, { tag, page: 1 })}
            key={tag}
          >
            {tagLabels[tag] ?? tag}{" "}
            <span className="font-mono text-[10px]">{count}</span>
          </Link>
        ))}
      </nav>
      <section
        aria-labelledby="editorial-results"
        className="pt-7 data-[variant=engineering]:pt-6"
        data-variant={variant}
      >
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <h2
            className="m-0 font-mono text-[11px] tracking-[.08em] text-muted-foreground uppercase"
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
              className="border px-2.5 py-1.5"
              href={queryHref(pathname, query, { sort: "newest", page: 1 })}
            >
              {copy.newest}
            </Link>
            <Link
              aria-current={query.sort === "oldest" ? "page" : undefined}
              className="border px-2.5 py-1.5"
              href={queryHref(pathname, query, { sort: "oldest", page: 1 })}
            >
              {copy.oldest}
            </Link>
            <span aria-hidden="true" className="mx-1 h-4 border-l" />
            <Link
              aria-current={query.view === "grid" ? "page" : undefined}
              className="border px-2.5 py-1.5"
              href={queryHref(pathname, query, { view: "grid" })}
            >
              {copy.grid}
            </Link>
            <Link
              aria-current={query.view === "list" ? "page" : undefined}
              className="border px-2.5 py-1.5"
              href={queryHref(pathname, query, { view: "list" })}
            >
              {copy.list}
            </Link>
          </div>
        </div>
        {selected.length === 0 ? (
          <p className="border bg-card p-8 text-muted-foreground">
            {copy.empty}
          </p>
        ) : pagination === "infinite" ? (
          <EditorialInfiniteResults
            className={resultClassName}
            endLabel={copy.end ?? copy.empty}
            initialPage={query.page}
            initialNextPageHref={queryHref(pathname, query, {
              page: query.page + 1,
            })}
            key={`${query.tag ?? "all"}:${query.sort}:${query.view}`}
            loadMoreLabel={copy.loadMore}
            view={query.view}
          >
            {selected.map((item, index) => (
              <EditorialCard
                eager={index < 3}
                item={item}
                key={item.id}
                variant={variant}
              />
            ))}
          </EditorialInfiniteResults>
        ) : (
          <div
            className={resultClassName}
            data-document-grid={query.view === "grid" ? "true" : undefined}
            data-view={query.view}
          >
            {page.items.map((item, index) => (
              <EditorialCard
                eager={index < 3}
                item={item}
                key={item.id}
                variant={variant}
              />
            ))}
          </div>
        )}
        {pagination === "links" && page.hasMore ? (
          <div className="mt-10 flex justify-center">
            <Link
              className="border px-5 py-3 text-sm hover:bg-muted"
              href={queryHref(pathname, query, { page: query.page + 1 })}
            >
              {copy.loadMore}
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
