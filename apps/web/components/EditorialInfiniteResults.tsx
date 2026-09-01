"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef } from "react";

/** fallback 링크를 유지하면서 관찰 지점이 가까워지면 다음 결과를 RSC로 요청함 */
export function EditorialInfiniteResults({
  children,
  className,
  hasMore,
  nextPageHref,
  loadMoreLabel,
  endLabel,
  view,
}: {
  readonly children: ReactNode;
  readonly className: string;
  readonly hasMore: boolean;
  readonly nextPageHref: string;
  readonly loadMoreLabel: string;
  readonly endLabel: string;
  readonly view: "grid" | "list";
}): React.JSX.Element {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const nextPageRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || sentinel === null || !("IntersectionObserver" in window))
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        nextPageRef.current?.click();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, nextPageHref]);

  return (
    <>
      <div
        className={className}
        data-document-grid={view === "grid" ? "true" : undefined}
        data-view={view}
      >
        {children}
      </div>
      <div
        className="flex min-h-16 items-center justify-center"
        data-infinite-scroll-sentinel="true"
        ref={sentinelRef}
      >
        {hasMore ? (
          <Link
            className="border px-5 py-3 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            data-infinite-scroll-fallback="true"
            href={nextPageHref}
            prefetch={false}
            ref={nextPageRef}
            scroll={false}
          >
            {loadMoreLabel}
          </Link>
        ) : (
          <span
            className="font-mono text-[11px] text-muted-foreground"
            role="status"
          >
            {endLabel}
          </span>
        )}
      </div>
    </>
  );
}
