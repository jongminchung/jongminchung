import { Card as CardPrimitive } from "@jongminchung/ui/components/card";
import { cn } from "@jongminchung/ui/lib/utils";
import {
  CircleCheck,
  CircleX,
  Info,
  Lightbulb,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Fumadocs UI 16.15.1의 https://fumadocs.dev/docs/ui/components source pattern을 기준으로 함
 * Tech theme와 Base UI 소유권을 유지하기 위해 runtime package 대신 app composition으로 적용함
 * Fumadocs major update 시 공식 component source와 접근성 계약을 다시 비교해야 함
 */
type CalloutType = "error" | "idea" | "info" | "success" | "warning";

const calloutIcons = {
  error: CircleX,
  idea: Lightbulb,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
} satisfies Record<CalloutType, typeof Info>;

/** Fumadocs Callout 패턴을 Tech semantic token에 맞춰 렌더링함 */
export function Callout({
  children,
  title,
  type = "info",
}: {
  readonly children: ReactNode;
  readonly title?: string;
  readonly type?: CalloutType | "tip" | "warn";
}) {
  const normalizedType =
    type === "tip" ? "info" : type === "warn" ? "warning" : type;
  const Icon = calloutIcons[normalizedType];
  return (
    <div
      aria-label={title}
      className="my-6 grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs data-[callout-type=error]:border-destructive/35 data-[callout-type=warning]:border-primary/35"
      data-callout-type={normalizedType}
      data-docs-callout="true"
      role="note"
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4",
          normalizedType === "error" ? "text-destructive" : "text-primary",
        )}
      />
      <div className="min-w-0 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {title === undefined ? null : (
          <p className="mb-1 font-medium text-foreground">{title}</p>
        )}
        {children}
      </div>
    </div>
  );
}

/** Fumadocs Steps 패턴의 순서 컨테이너를 렌더링함 */
export function Steps({ children }: { readonly children: ReactNode }) {
  return (
    <ol
      className="my-6 list-none p-0 [counter-reset:docs-step] [&>li+li]:mt-0 [&>li:last-child]:pb-0"
      data-docs-steps="true"
    >
      {children}
    </ol>
  );
}

/** Fumadocs Step 패턴의 단일 단계를 렌더링함 */
export function Step({ children }: { readonly children: ReactNode }) {
  return (
    <li className="relative border-l border-border pb-8 pl-8 [counter-increment:docs-step] before:absolute before:-left-3.5 before:grid before:size-7 before:place-items-center before:rounded-full before:border before:bg-background before:font-mono before:text-xs before:font-medium before:text-primary before:content-[counter(docs-step)] [&>h3:first-child]:mt-0">
      {children}
    </li>
  );
}

/** Fumadocs Cards 패턴의 반응형 문서 카드 목록을 렌더링함 */
export function Cards({
  className,
  ...props
}: ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      {...props}
      data-docs-cards="true"
      className={cn(
        "my-6 grid grid-cols-2 gap-3 max-[680px]:grid-cols-1",
        className,
      )}
    />
  );
}

/** Fumadocs Card 패턴을 공용 shadcn Card primitive로 조합함 */
export function Card({
  children,
  description,
  href,
  title,
}: {
  readonly children?: ReactNode;
  readonly description?: string;
  readonly href?: string;
  readonly title: string;
}) {
  const content = (
    <CardPrimitive className="h-full rounded-lg border p-4 transition-colors group-hover:bg-muted group-focus-visible:bg-muted">
      <h3 className="mt-0 mb-1 text-base font-medium text-foreground">
        {title}
      </h3>
      {description === undefined ? null : (
        <p className="my-0 text-sm text-muted-foreground">{description}</p>
      )}
      {children === undefined ? null : (
        <div className="mt-3 text-sm text-muted-foreground">{children}</div>
      )}
    </CardPrimitive>
  );
  return href === undefined ? (
    content
  ) : (
    <Link
      className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      href={href}
    >
      {content}
    </Link>
  );
}
