import type { ReactNode } from "react";

/** 공통 header·rail·본문의 responsive 읽기 흐름을 제공함 */
export function EditorialArticle({
  header,
  rail,
  children,
  footer,
}: {
  readonly header: ReactNode;
  readonly rail: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}): React.JSX.Element {
  return (
    <main className="mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,760px)_200px] justify-center gap-x-12 px-8 pt-[clamp(48px,6vw,80px)] pb-24 max-[1279px]:block max-[1279px]:max-w-[824px] max-[600px]:px-4 max-[600px]:pt-10">
      <header className="col-start-1 row-start-1 pb-10">{header}</header>
      <aside className="sticky top-20 col-start-2 row-span-2 row-start-1 -mt-10 max-h-[calc(100dvh-96px)] self-start overflow-auto max-[1279px]:hidden">
        {rail}
      </aside>
      <article
        className="col-start-1 row-start-2 min-w-0 pt-4 text-[16px] leading-7"
        data-editorial-article="true"
      >
        {children}
        {footer}
      </article>
    </main>
  );
}
