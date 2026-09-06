import { cn } from "@jongminchung/ui/lib/utils";
import { CircleCheck } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/** native details의 키보드·JavaScript 없는 환경 동작을 유지함. */
export function Details({ className, ...props }: ComponentProps<"details">) {
  return (
    <details
      {...props}
      className={cn(
        "my-6 min-w-0 rounded-lg border bg-card px-4 [overflow-wrap:anywhere] text-card-foreground open:pb-4 [&>:last-child]:mb-0",
        className,
      )}
    />
  );
}

/** 펼치기 상태는 브라우저의 기본 marker로 전달함. */
export function Summary({ className, ...props }: ComponentProps<"summary">) {
  return (
    <summary
      {...props}
      className={cn(
        "-mx-4 cursor-pointer rounded-lg px-4 py-3 font-medium marker:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    />
  );
}

/** 용어와 정의의 관계를 보조 기술에도 제공함. */
export function Glossary({ className, ...props }: ComponentProps<"dl">) {
  return (
    <dl
      {...props}
      className={cn(
        "my-6 min-w-0 border-y py-4 [overflow-wrap:anywhere]",
        className,
      )}
    />
  );
}

export function Term({ className, ...props }: ComponentProps<"dt">) {
  return (
    <dt
      {...props}
      className={cn("mt-5 scroll-mt-24 font-semibold first:mt-0", className)}
    />
  );
}

export function Definition({ className, ...props }: ComponentProps<"dd">) {
  return (
    <dd
      {...props}
      className={cn(
        "mt-1 ml-0 text-muted-foreground forced-colors:text-[CanvasText] [&>:first-child]:mt-0 [&>:last-child]:mb-0",
        className,
      )}
    />
  );
}

/** 코드의 줄 번호와 설명을 순서 있는 목록으로 연결함. */
export function CodeNotes({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      {...props}
      className={cn(
        "my-5 list-decimal space-y-3 pl-6 marker:font-mono marker:text-muted-foreground",
        className,
      )}
    />
  );
}

export function CodeNote({
  lines,
  children,
}: {
  readonly lines: string;
  readonly children: ReactNode;
}) {
  return (
    <li className="min-w-0 pl-1 [overflow-wrap:anywhere]">
      <p className="m-0 mb-1 font-mono text-sm font-medium">{lines}</p>
      <div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </li>
  );
}

/** 비교 항목을 넓은 화면에서는 나란히, 모바일에서는 원래 읽기 순서로 제공함. */
export function Comparison({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <figure className="my-8 min-w-0">
      <figcaption className="mb-3 font-semibold">{title}</figcaption>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">{children}</div>
    </figure>
  );
}

export function ComparisonItem({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={title}
      className="reading-code min-w-0 rounded-lg border bg-card p-4 [overflow-wrap:anywhere] text-card-foreground"
    >
      <p className="m-0 mb-3 border-b pb-2 font-medium">{title}</p>
      <div className="min-w-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}

/** 예상 출력·성공 기준을 정적 본문으로 표시하며 실제 성공 상태를 주장하지 않음. */
export function ExpectedResult({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="reading-code my-6 min-w-0 rounded-lg border border-dashed bg-muted/40 p-4 [overflow-wrap:anywhere]"
    >
      <p className="m-0 mb-3 flex items-center gap-2 font-semibold">
        <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
        {title}
      </p>
      <div className="min-w-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </section>
  );
}

/** 코드와 설명의 공통 영역. 생성된 Shiki 요소의 대비 보정을 이 영역에 한정함. */
export function CodeExample({ children }: { readonly children: ReactNode }) {
  return (
    <div className="reading-code my-6 min-w-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      {children}
    </div>
  );
}
