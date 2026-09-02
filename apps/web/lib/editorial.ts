/** 두 editorial 도메인이 공유하는 목록 항목 계약임 */
export interface EditorialItem {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly publishedAt: string;
  readonly tags: readonly string[];
  readonly kind: string;
  readonly mediaSeed: string;
  readonly image?: Readonly<{
    readonly srcLight: string;
    readonly srcDark: string;
    readonly alt: string;
  }>;
}

/** 두 editorial 목록이 공유하는 locale copy 계약임 */
export interface EditorialCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly all: string;
  readonly newest: string;
  readonly oldest: string;
  readonly grid: string;
  readonly list: string;
  readonly loadMore: string;
  readonly end?: string;
  readonly empty: string;
  readonly related: string;
  readonly controls: string;
}

export type EditorialSort = "newest" | "oldest";
export type EditorialView = "grid" | "list";

export interface EditorialQuery {
  readonly tag: string | undefined;
  readonly sort: EditorialSort;
  readonly view: EditorialView;
  readonly page: number;
}

export type EditorialSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

function first(
  value: string | readonly string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

/** `parseEditorialQuery` URL 상태를 안전한 목록 상태로 정규화함 */
export function parseEditorialQuery(
  searchParams: EditorialSearchParams,
  validTags: readonly string[],
): EditorialQuery {
  const requestedTag = first(searchParams.tag);
  const sort = first(searchParams.sort) === "oldest" ? "oldest" : "newest";
  const view = first(searchParams.view) === "list" ? "list" : "grid";
  const requestedPage = Number.parseInt(first(searchParams.page) ?? "1", 10);
  return Object.freeze({
    tag:
      requestedTag !== undefined && validTags.includes(requestedTag)
        ? requestedTag
        : undefined,
    sort,
    view,
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
  });
}

/** `getEditorialTags` 빈도와 이름으로 안정적으로 정렬된 태그를 반환함 */
export function getEditorialTags(
  items: readonly EditorialItem[],
): readonly { readonly tag: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => Object.freeze({ tag, count }))
    .toSorted(
      (left, right) =>
        right.count - left.count || left.tag.localeCompare(right.tag),
    );
}

/** `filterEditorialItems` 필터와 날짜 정렬을 적용함 */
export function filterEditorialItems(
  items: readonly EditorialItem[],
  query: EditorialQuery,
): readonly EditorialItem[] {
  return items
    .filter((item) => query.tag === undefined || item.tags.includes(query.tag))
    .toSorted((left, right) => {
      const dateOrder = left.publishedAt.localeCompare(right.publishedAt);
      return (
        (query.sort === "newest" ? -dateOrder : dateOrder) ||
        left.id.localeCompare(right.id)
      );
    });
}

/** `paginateEditorialItems` 페이지 경계와 후속 페이지 존재 여부를 계산함 */
export function paginateEditorialItems(
  items: readonly EditorialItem[],
  page: number,
  pageSize = 9,
): { readonly items: readonly EditorialItem[]; readonly hasMore: boolean } {
  const start = (page - 1) * pageSize;
  return Object.freeze({
    items: items.slice(start, start + pageSize),
    hasMore: start + pageSize < items.length,
  });
}

/** `rankRelatedEditorialItems` 공통 태그가 많은 항목을 관련 콘텐츠로 선택함 */
export function rankRelatedEditorialItems(
  current: EditorialItem,
  candidates: readonly EditorialItem[],
  limit = 3,
): readonly EditorialItem[] {
  const currentTags = new Set(current.tags);
  return candidates
    .flatMap((candidate) => {
      if (candidate.id === current.id) return [];
      const sharedTags = candidate.tags.filter((tag) =>
        currentTags.has(tag),
      ).length;
      return sharedTags === 0 ? [] : [{ candidate, sharedTags }];
    })
    .toSorted(
      (left, right) =>
        right.sharedTags - left.sharedTags ||
        right.candidate.publishedAt.localeCompare(left.candidate.publishedAt) ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
    .slice(0, Math.max(limit, 0))
    .map(({ candidate }) => candidate);
}
