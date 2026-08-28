"use client";

import {
  Children,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DEFAULT_PAGE_SIZE = 9;

function replaceHistoryPage(page: number): void {
  const url = new URL(window.location.href);
  if (page <= 1) url.searchParams.delete("page");
  else url.searchParams.set("page", String(page));
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

/** `EditorialInfiniteResults` 관찰 지점이 가까워지면 다음 결과 묶음을 자동으로 공개함 */
export function EditorialInfiniteResults({
  children,
  className,
  initialPage,
  loadingLabel,
  endLabel,
  pageSize = DEFAULT_PAGE_SIZE,
  view,
}: {
  readonly children: ReactNode;
  readonly className: string;
  readonly initialPage: number;
  readonly loadingLabel: string;
  readonly endLabel: string;
  readonly pageSize?: number;
  readonly view: "grid" | "list";
}): React.JSX.Element {
  const items = useMemo(() => Children.toArray(children), [children]);
  const maxPage = Math.max(1, Math.ceil(items.length / pageSize));
  const [visiblePage, setVisiblePage] = useState(() =>
    Math.min(initialPage, maxPage),
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visibleCount = Math.min(items.length, visiblePage * pageSize);
  const hasMore = visibleCount < items.length;

  useEffect(() => {
    replaceHistoryPage(visiblePage);
  }, [visiblePage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || sentinel === null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting)
          setVisiblePage((page) => Math.min(page + 1, maxPage));
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, maxPage]);

  return (
    <>
      <div
        className={className}
        data-document-grid={view === "grid" ? "true" : undefined}
        data-view={view}
      >
        {items.slice(0, visibleCount)}
      </div>
      <div
        className="flex min-h-16 items-center justify-center"
        data-infinite-scroll-sentinel="true"
        ref={sentinelRef}
      >
        <span
          className="font-mono text-[11px] text-muted-foreground"
          role="status"
        >
          {hasMore ? loadingLabel : endLabel}
        </span>
      </div>
    </>
  );
}
