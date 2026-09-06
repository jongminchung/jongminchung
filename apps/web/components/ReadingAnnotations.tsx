import { cn } from "@jongminchung/ui/lib/utils";
import {
  CircleAlert,
  Info,
  Lightbulb,
  MessageSquareWarning,
  TriangleAlert,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/** 줄바꿈·테마·고대비 모드에서도 읽을 수 있는 의미론적 형광펜 강조. */
export function Highlight({ className, ...props }: ComponentProps<"mark">) {
  return (
    <mark
      {...props}
      className={cn(
        "rounded-xs bg-highlight box-decoration-clone px-0.5 text-highlight-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
        className,
      )}
    />
  );
}

const appearances = {
  note: {
    icon: Info,
    panel: "border-annotation-note/40 bg-annotation-note/5",
    title: "text-annotation-note",
  },
  tip: {
    icon: Lightbulb,
    panel: "border-annotation-tip/40 bg-annotation-tip/5",
    title: "text-annotation-tip",
  },
  important: {
    icon: MessageSquareWarning,
    panel: "border-annotation-important/40 bg-annotation-important/5",
    title: "text-annotation-important",
  },
  warning: {
    icon: TriangleAlert,
    panel: "border-annotation-warning/40 bg-annotation-warning/5",
    title: "text-annotation-warning",
  },
  caution: {
    icon: CircleAlert,
    panel: "border-annotation-caution/40 bg-annotation-caution/5",
    title: "text-annotation-caution",
  },
};

/** 정적 글의 알림을 live region 없이 아이콘·제목·색상으로 구분함. */
export function MarkdownAlert({
  kind,
  title,
  children,
}: {
  readonly kind: keyof typeof appearances;
  readonly title: string;
  readonly children: ReactNode;
}) {
  const appearance = appearances[kind];
  const Icon = appearance.icon;
  return (
    <aside
      role="note"
      aria-label={title}
      className={cn(
        "my-6 min-w-0 rounded-lg border border-l-4 p-4 [overflow-wrap:anywhere] text-foreground forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]",
        appearance.panel,
      )}
    >
      <p
        className={cn(
          "m-0 mb-2 flex items-center gap-2 font-semibold forced-colors:text-[CanvasText]",
          appearance.title,
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {title}
      </p>
      <div className="min-w-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
}
