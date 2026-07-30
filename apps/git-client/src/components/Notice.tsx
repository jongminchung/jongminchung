import { Alert, AlertDescription } from "@jongminchung/ui/components/alert";
import { cn } from "@jongminchung/ui/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

const toneClasses = {
  neutral: "border-border bg-muted text-foreground",
  success: "border-success bg-success-muted text-success-muted-foreground",
  warning: "border-warning bg-warning-muted text-warning-muted-foreground",
  destructive: "border-destructive bg-destructive-muted text-destructive-muted-foreground",
} as const;

interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  readonly role: "status" | "alert";
  readonly tone?: keyof typeof toneClasses;
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
    <Alert
      className={cn(
        "flex items-start",
        size === "sm" ? "gap-2 p-2 text-xs" : "gap-2.5 p-3 text-sm",
        toneClasses[tone],
        className,
      )}
      role={role}
      variant={tone === "destructive" ? "destructive" : "default"}
      {...props}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      <AlertDescription className="min-w-0 flex-1 text-inherit">{children}</AlertDescription>
    </Alert>
  );
}
