import { cn } from "@jongminchung/ui/lib/utils";
import type { ReactNode } from "react";

/** 공통 header·rail·본문의 responsive 읽기 흐름을 제공함 */
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
  const isEngineering = variant === "engineering";

  return (
    <main
      className={
        isEngineering
          ? "mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,760px)_200px] justify-center gap-x-12 px-8 pt-[clamp(48px,6vw,80px)] pb-24 max-[1279px]:block max-[1279px]:max-w-[824px] max-[600px]:px-4 max-[600px]:pt-10"
          : "mx-auto grid w-full max-w-[1080px] grid-cols-[180px_minmax(0,760px)] gap-x-16 px-8 pt-[76px] pb-24 max-[960px]:block max-[960px]:max-w-[824px] max-[600px]:px-4 max-[600px]:pt-10"
      }
      data-variant={variant}
    >
      <header
        className={
          isEngineering
            ? "col-start-1 row-start-1 pb-10"
            : "col-start-2 border-b pb-8"
        }
        data-variant={variant}
      >
        {header}
      </header>
      <aside
        className={
          isEngineering
            ? "sticky top-20 col-start-2 row-span-2 row-start-1 -mt-10 max-h-[calc(100dvh-96px)] self-start overflow-auto max-[1279px]:hidden"
            : "sticky top-20 col-start-1 row-start-2 mt-8 max-h-[calc(100dvh-96px)] self-start overflow-auto border-r pr-5 max-[960px]:relative max-[960px]:top-auto max-[960px]:my-8 max-[960px]:max-h-none max-[960px]:border-r-0 max-[960px]:border-b max-[960px]:pb-8"
        }
        data-variant={variant}
      >
        {rail}
      </aside>
      <article
        className={cn(
          isEngineering
            ? "col-start-1 row-start-2 pt-4"
            : "col-start-2 row-start-2 pt-[18px]",
          "min-w-0 text-[16px] leading-7",
        )}
        data-editorial-article="true"
      >
        {children}
        {footer}
      </article>
    </main>
  );
}
