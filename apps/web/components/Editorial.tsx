import Link from "next/link";
import type { ReactNode } from "react";
import {
  filterEditorialItems,
  getEditorialTags,
  paginateEditorialItems,
  type EditorialItem,
  type EditorialQuery,
} from "#lib/editorial";

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
  readonly empty: string;
  readonly related: string;
}

export interface EditorialNavigationItem {
  readonly href: string;
  readonly label: string;
}

/** `EditorialHeader` 두 editorial 도메인의 탐색 순서를 공유함 */
export function EditorialHeader({
  brand,
  brandLabel,
  homeHref,
  navigation,
  localeHref,
  localeLabel,
  localeControl,
  actions,
}: {
  readonly brand: ReactNode;
  readonly brandLabel: string;
  readonly homeHref: string;
  readonly navigation: readonly EditorialNavigationItem[];
  readonly localeHref: string;
  readonly localeLabel: string;
  readonly localeControl?: ReactNode;
  readonly actions?: ReactNode;
}): React.JSX.Element {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-14 w-full max-w-[1200px] items-center gap-5 px-6 text-[12px] max-[680px]:px-4">
        <Link
          aria-label={brandLabel}
          className="mr-2 font-semibold tracking-[-.04em]"
          href={homeHref}
        >
          {brand}
        </Link>
        <nav
          className="flex items-center gap-5 text-muted-foreground max-[520px]:hidden"
          aria-label="Editorial navigation"
        >
          {navigation.map((item) => (
            <Link
              className="hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          {localeControl ?? (
            <Link className="font-mono text-[11px]" href={localeHref}>
              {localeLabel}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** `EditorialFooter` 실제 탐색 가능한 링크만 가진 공통 footer임 */
export function EditorialFooter({
  groups,
  note,
}: {
  readonly groups: readonly {
    readonly label: string;
    readonly links: readonly EditorialNavigationItem[];
  }[];
  readonly note: string;
}): React.JSX.Element {
  return (
    <footer className="mx-auto grid w-full max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-8 gap-y-10 border-t px-6 pt-10 pb-8 font-mono text-[10px] text-muted-foreground max-[640px]:grid-cols-1 max-[640px]:px-4">
      {groups.map((group) => (
        <section key={group.label}>
          <p className="mb-3 text-foreground">{group.label}</p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {group.links.map((link) => (
              <li key={link.href}>
                {link.href.startsWith("http") ? (
                  <a href={link.href} rel="noreferrer" target="_blank">
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href}>{link.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="col-span-full m-0 border-t pt-4 max-[640px]:col-auto">
        {note}
      </p>
    </footer>
  );
}

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

/** `EditorialGraphic` 항목 메타데이터로 결정되는 외부 자산 없는 추상 그래픽임 */
export function EditorialGraphic({
  seed,
  variant = "default",
}: {
  readonly seed: string;
  readonly variant?: "default" | "engineering";
}): React.JSX.Element {
  const value = Array.from(seed).reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) % 9973,
    17,
  );
  const offset = 16 + (value % 28);
  const slope = 35 + (value % 48);
  if (variant === "engineering") {
    const palette = [
      ["#081fff", "#67c9ff", "#372cff"],
      ["#0077d8", "#20cff2", "#102eb8"],
      ["#00476d", "#00b5c8", "#003f95"],
      ["#5924ee", "#a84dff", "#2130db"],
      ["#0c62d6", "#54a9f7", "#0937ae"],
    ] as const;
    const [start, end, accent] = palette[value % palette.length] ?? palette[0];
    const gradientId = `editorial-gradient-${value}`;
    const glowId = `editorial-glow-${value}`;
    return (
      <svg
        aria-hidden="true"
        className="aspect-square w-full bg-muted"
        preserveAspectRatio="none"
        viewBox="0 0 320 320"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
            <stop stopColor={start} />
            <stop offset=".52" stopColor={end} />
            <stop offset="1" stopColor={accent} />
          </linearGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
        </defs>
        <rect fill={`url(#${gradientId})`} height="320" width="320" />
        <ellipse
          cx={70 + (value % 180)}
          cy={40 + (value % 180)}
          fill="#ffffff"
          filter={`url(#${glowId})`}
          opacity=".22"
          rx="84"
          ry="46"
        />
        <path
          d="M0 80H320M0 160H320M0 240H320M80 0V320M160 0V320M240 0V320"
          fill="none"
          stroke="#ffffff"
          strokeDasharray="2 5"
          strokeOpacity=".7"
          strokeWidth="1.5"
        />
        <path
          d={`M${54 + (value % 30)} 230 L160 ${78 + (value % 50)} L${244 - (value % 30)} 212`}
          fill="none"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeOpacity=".94"
          strokeWidth="2"
        />
        {[
          { cx: 54 + (value % 30), cy: 230 },
          { cx: 160, cy: 78 + (value % 50) },
          { cx: 244 - (value % 30), cy: 212 },
        ].map(({ cx, cy }, index) => (
          <g key={`${cx}-${cy}`}>
            <rect
              fill="#ffffff"
              fillOpacity=".08"
              height="52"
              rx="8"
              stroke="#ffffff"
              strokeOpacity=".9"
              strokeWidth="1.5"
              width="52"
              x={cx - 26}
              y={cy - 26}
            />
            <circle
              cx={cx}
              cy={cy}
              fill="none"
              r={index === 1 ? 11 : 9}
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        ))}
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      className="aspect-[1.6] w-full border-b bg-muted data-[variant=engineering]:border-0"
      data-variant={variant}
      preserveAspectRatio="none"
      viewBox="0 0 320 200"
    >
      <path
        d="M0 40H320M0 100H320M0 160H320M64 0V200M160 0V200M256 0V200"
        fill="none"
        stroke="var(--border)"
        strokeWidth="1"
      />
      <path
        d={`M0 ${180 - offset} C70 ${slope}, 155 ${190 - slope}, 320 ${offset}`}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
      />
      <path
        d={`M${offset} 188 L${160 - offset / 3} ${35 + offset} L${310 - offset} ${120 + (value % 30)}`}
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity=".55"
        strokeWidth="1.5"
      />
      {[offset, 160 - offset / 3, 310 - offset].map((x, index) => (
        <circle
          cx={x}
          cy={
            index === 0 ? 188 : index === 1 ? 35 + offset : 120 + (value % 30)
          }
          fill="var(--card)"
          key={x}
          r="5"
          stroke="var(--primary)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

/** `EditorialCard` type·date·title·summary 순서의 단일 링크 카드임 */
export function EditorialCard({
  item,
  eager = false,
  variant = "default",
}: {
  readonly item: EditorialItem;
  readonly eager?: boolean;
  readonly variant?: "default" | "engineering";
}): React.JSX.Element {
  return (
    <Link
      className="group block overflow-hidden border bg-card text-card-foreground transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-input hover:shadow-[var(--elevation-medium)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[variant=engineering]:overflow-visible data-[variant=engineering]:border-0 data-[variant=engineering]:bg-transparent data-[variant=engineering]:hover:translate-y-0 data-[variant=engineering]:hover:shadow-none"
      data-variant={variant}
      href={item.href}
      prefetch={eager}
    >
      <span
        className="block data-[variant=engineering]:overflow-hidden data-[variant=engineering]:rounded-[.2rem]"
        data-variant={variant}
      >
        <EditorialGraphic seed={item.mediaSeed} variant={variant} />
      </span>
      <span
        className="block p-5 data-[variant=engineering]:px-0 data-[variant=engineering]:pt-3 data-[variant=engineering]:pb-0"
        data-variant={variant}
      >
        <span className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">
          <span>{item.kind}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.publishedAt}>{item.publishedAt}</time>
        </span>
        <span className="mt-3 block text-[20px] leading-[1.18] font-medium tracking-[-.025em] text-foreground data-[variant=engineering]:mt-2 data-[variant=engineering]:text-[15px] data-[variant=engineering]:leading-[1.25] data-[variant=engineering]:tracking-[-.015em]">
          {item.title}
        </span>
        <span className="mt-3 block text-sm leading-[1.5] text-muted-foreground data-[variant=engineering]:hidden">
          {item.description}
        </span>
      </span>
    </Link>
  );
}

/** `EditorialIndex` URL 동기화 topic·sort·view·pagination 목록을 렌더링함 */
export function EditorialIndex({
  pathname,
  items,
  query,
  copy,
  variant = "default",
}: {
  readonly pathname: string;
  readonly items: readonly EditorialItem[];
  readonly query: EditorialQuery;
  readonly copy: EditorialCopy;
  readonly variant?: "default" | "engineering";
}): React.JSX.Element {
  const tags = getEditorialTags(items);
  const selected = filterEditorialItems(items, query);
  const page = paginateEditorialItems(selected, query.page);
  return (
    <main
      className="mx-auto w-full max-w-[1200px] px-6 pt-[clamp(64px,9vw,112px)] pb-24 max-[680px]:px-4 max-[680px]:pt-12 data-[variant=engineering]:pt-[clamp(70px,8vw,112px)]"
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
            {tag} <span className="font-mono text-[10px]">{count}</span>
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
            aria-label="Editorial controls"
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
        {page.items.length === 0 ? (
          <p className="border bg-card p-8 text-muted-foreground">
            {copy.empty}
          </p>
        ) : (
          <div
            className={
              query.view === "grid"
                ? "grid grid-cols-3 gap-x-5 gap-y-12 max-[840px]:grid-cols-2 max-[560px]:grid-cols-1"
                : "grid gap-4"
            }
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
        {page.hasMore ? (
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

/** `EditorialArticle` 공통 header·rail·본문의 responsive 읽기 흐름을 제공함 */
export function EditorialArticle({
  header,
  rail,
  children,
  footer,
  variant = "default",
}: {
  readonly header: ReactNode;
  readonly rail: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly variant?: "default" | "engineering";
}): React.JSX.Element {
  return (
    <main
      className="mx-auto grid w-full max-w-[1080px] grid-cols-[180px_minmax(0,680px)] gap-x-16 px-8 pt-[76px] pb-24 max-[960px]:block max-[960px]:max-w-[760px] max-[600px]:px-4 max-[600px]:pt-10 data-[variant=engineering]:max-w-[1200px] data-[variant=engineering]:grid-cols-[160px_minmax(0,680px)] data-[variant=engineering]:gap-x-20 data-[variant=engineering]:pt-[clamp(48px,6vw,80px)]"
      data-variant={variant}
    >
      <header
        className="col-start-2 border-b pb-8 data-[variant=engineering]:border-b-0 data-[variant=engineering]:pb-7"
        data-variant={variant}
      >
        {header}
      </header>
      <aside
        className="sticky top-20 col-start-1 row-start-2 mt-8 max-h-[calc(100dvh-96px)] self-start overflow-auto border-r pr-5 data-[variant=engineering]:border-r-0 data-[variant=engineering]:pr-0 max-[960px]:relative max-[960px]:top-auto max-[960px]:my-8 max-[960px]:max-h-none max-[960px]:border-r-0 max-[960px]:border-b max-[960px]:pb-8"
        data-variant={variant}
      >
        {rail}
      </aside>
      <article className="col-start-2 row-start-2 min-w-0 pt-[18px] text-[16px] leading-[1.8]">
        {children}
        {footer}
      </article>
    </main>
  );
}
