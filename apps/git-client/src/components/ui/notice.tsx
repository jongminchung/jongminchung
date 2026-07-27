import { cva } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

const noticeVariants = cva("flex items-start rounded-md border", {
  variants: {
    size: {
      sm: "gap-2 p-2 text-xs",
      md: "gap-2.5 p-3 text-sm",
    },
    tone: {
      neutral: "border-border bg-muted text-foreground",
      success: "border-success bg-success-muted text-success-muted-foreground",
      warning: "border-warning bg-warning-muted text-warning-muted-foreground",
      destructive: "border-destructive bg-destructive-muted text-destructive-muted-foreground",
    },
  },
  defaultVariants: {
    size: "md",
    tone: "neutral",
  },
});

interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  readonly role: "status" | "alert";
  readonly tone?: "neutral" | "success" | "warning" | "destructive";
  readonly size?: "sm" | "md";
  readonly icon?: ReactNode;
}

export function Notice({
  role,
  tone = "neutral",
  size = "md",
  icon,
  children,
  className,
  ...props
}: NoticeProps): ReactNode {
  return (
    <div className={cn(noticeVariants({ size, tone }), className)} role={role} {...props}>
      {icon ? <span aria-hidden>{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export { noticeVariants };
