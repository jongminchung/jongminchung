"use client";

import Link from "next/link";
import {
  type ReactNode,
  Fragment,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import type { EditorialItem, paginateEditorialItems } from "#lib/editorial";
import { EditorialCard } from "./EditorialCard";

export interface EditorialInfiniteResultsProps {
  readonly children: ReactNode;
  readonly className: string;
  readonly hasMore: boolean;
  readonly nextPageHref: string;
  readonly loadMoreLabel: string;
  readonly endLabel: string;
  readonly view: "grid" | "list";
}

/** 첫 화면은 서버에서 렌더링하고 후속 페이지의 항목만 추가함. */
export function EditorialInfiniteResults({
  children,
  className,
  hasMore,
  nextPageHref,
  loadMoreLabel,
  endLabel,
  view,
  renderItem = (item) => <EditorialCard item={item} />,
}: EditorialInfiniteResultsProps & {
  readonly renderItem?: (item: EditorialItem) => ReactNode;
}): React.JSX.Element {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [items, setItems] = useState<readonly EditorialItem[]>([]);
  const [nextHref, setNextHref] = useState(hasMore ? nextPageHref : null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [loadedLocation, setLoadedLocation] = useState<{
    readonly source: string;
    readonly destination: string;
  } | null>(null);

  useEffect(() => {
    if (loadedLocation === null) return;
    const current = new URL(window.location.href);
    if (`${current.pathname}${current.search}` !== loadedLocation.source)
      return;
    // 목록 렌더가 커밋된 뒤 동기화하여 진행 중인 App Router 탐색을 취소하지 않음.
    window.history.replaceState(
      null,
      "",
      `${loadedLocation.destination}${current.hash}`,
    );
  }, [loadedLocation]);

  async function loadMore(): Promise<void> {
    if (nextHref === null || requestRef.current !== null || pending) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setFailed(false);
    try {
      const source = `${window.location.pathname}${window.location.search}`;
      const destination = new URL(nextHref, window.location.href);
      const endpoint = new URL(destination);
      endpoint.pathname = `${endpoint.pathname}/articles`;
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok)
        throw new Error(`Article request failed: ${response.status}`);
      const page = (await response.json()) as ReturnType<
        typeof paginateEditorialItems
      >;
      if (controller.signal.aborted) return;
      const loadedHref = `${destination.pathname}${destination.search}`;
      destination.searchParams.set("page", String(page.page + 1));
      startTransition(() => {
        setItems((previous) => [...previous, ...page.items]);
        setLoadedLocation({ source, destination: loadedHref });
        setNextHref(
          page.hasMore ? `${destination.pathname}${destination.search}` : null,
        );
      });
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  const loadOnIntersection = useEffectEvent(() => {
    void loadMore();
  });
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (
      nextHref === null ||
      failed ||
      sentinel === null ||
      !("IntersectionObserver" in window)
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        loadOnIntersection();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextHref, failed]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      requestRef.current = null;
      setLoading(false);
    },
    [],
  );

  return (
    <>
      <div
        className={className}
        data-document-grid={view === "grid" ? "true" : undefined}
        data-view={view}
        aria-busy={loading || pending}
      >
        {children}
        {items.map((item) => (
          <Fragment key={item.id}>{renderItem(item)}</Fragment>
        ))}
      </div>
      <div
        className="flex min-h-16 items-center justify-center"
        data-infinite-scroll-sentinel="true"
        ref={sentinelRef}
      >
        {nextHref !== null ? (
          <Link
            className="border px-5 py-3 font-mono text-caption text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            data-infinite-scroll-fallback="true"
            href={nextHref}
            prefetch={false}
            scroll={false}
            aria-disabled={loading || pending}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              // 실패 시 일반 페이지 이동으로 계속 탐색함.
              if (failed) return;
              event.preventDefault();
              void loadMore();
            }}
          >
            {loadMoreLabel}
          </Link>
        ) : (
          <span
            className="font-mono text-caption text-muted-foreground"
            role="status"
          >
            {endLabel}
          </span>
        )}
      </div>
    </>
  );
}
