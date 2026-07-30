import { Button } from "@jongminchung/ui/components/button";
import {
  Dialog as DialogPrimitive,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@jongminchung/ui/components/dialog";
import { cn } from "@jongminchung/ui/lib/utils";
import { X } from "lucide-react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type DialogPurpose = "required" | "form" | "info";

interface DialogProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  readonly isOpen: boolean;
  readonly isInline?: boolean;
  readonly onOpenChange: (isOpen: boolean) => unknown;
  readonly width?: number | string;
  readonly maxHeight?: number | string;
  readonly position?: Readonly<
    Partial<Record<"top" | "right" | "bottom" | "left", number | string>>
  >;
  readonly variant?: "standard" | "fullscreen";
  readonly purpose?: DialogPurpose;
  readonly padding?: number;
  readonly children: ReactNode;
}

function sizeValue(value: number | string | undefined): number | string | undefined {
  return typeof value === "number" ? `${value}px` : value;
}

export function Dialog({
  isOpen,
  isInline = false,
  onOpenChange,
  width = 400,
  maxHeight = "75vh",
  position,
  variant = "standard",
  purpose = "info",
  padding,
  children,
  className,
  style,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: DialogProps): ReactNode {
  const contentStyle: CSSProperties =
    variant === "fullscreen"
      ? { height: "100vh", maxHeight: "100vh", width: "100vw" }
      : {
          width: sizeValue(width),
          maxHeight: sizeValue(maxHeight),
          padding: padding === undefined ? undefined : `${padding * 4}px`,
          ...position,
        };
  const content = (
    <div
      className={cn(
        "flex min-h-0 max-w-[calc(100vw-32px)] flex-col overflow-hidden border border-border bg-popover text-popover-foreground shadow-lg outline-none",
        variant === "fullscreen" ? "h-screen max-w-none rounded-none" : "rounded-lg",
        className,
      )}
      style={{ ...contentStyle, ...style }}
      {...props}
    >
      {children}
    </div>
  );

  if (isInline) return isOpen ? content : null;
  return (
    <DialogPrimitive
      disablePointerDismissal={purpose !== "info"}
      open={isOpen}
      onOpenChange={(open, eventDetails) => {
        if (!open && purpose === "required" && eventDetails.reason === "escape-key") {
          eventDetails.cancel();
          return;
        }
        onOpenChange(open);
      }}
    >
      <DialogContent
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          "z-[121] block max-w-none gap-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-none",
          variant === "fullscreen" && "inset-0 top-0 left-0 translate-x-0 translate-y-0",
        )}
        showCloseButton={false}
      >
        {content}
      </DialogContent>
    </DialogPrimitive>
  );
}

interface DialogHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly hasDivider?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => unknown;
}

export function DialogHeader({
  title,
  subtitle,
  hasDivider = false,
  onOpenChange,
}: DialogHeaderProps): ReactNode {
  return (
    <header
      className={cn(
        "flex min-h-11 items-center gap-3 px-4 py-2",
        hasDivider && "border-b border-border",
      )}
    >
      <div className="min-w-0 flex-1">
        <DialogTitle className="m-0 truncate text-sm font-semibold">{title}</DialogTitle>
        {subtitle ? (
          <DialogDescription className="m-0 truncate text-[11px]">{subtitle}</DialogDescription>
        ) : null}
      </div>
      {onOpenChange ? (
        <Button
          aria-label="Close"
          className="size-7 text-muted-foreground"
          onClick={() => onOpenChange(false)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X aria-hidden className="size-4" />
        </Button>
      ) : null}
    </header>
  );
}

interface DialogBodyProps extends HTMLAttributes<HTMLDivElement> {
  readonly isScrollable?: boolean;
}

export function DialogBody({
  isScrollable = true,
  className,
  ...props
}: DialogBodyProps): ReactNode {
  return <div className={cn("min-h-0", isScrollable && "overflow-auto", className)} {...props} />;
}

interface DialogFooterProps extends HTMLAttributes<HTMLElement> {
  readonly alignment?: "start" | "between" | "end";
}

const footerAlignment = {
  start: "justify-start",
  between: "justify-between",
  end: "justify-end",
} as const;

export function DialogFooter({
  alignment = "end",
  className,
  ...props
}: DialogFooterProps): ReactNode {
  return (
    <footer
      className={cn(
        "flex items-center gap-2 border-t border-border p-3",
        footerAlignment[alignment],
        className,
      )}
      {...props}
    />
  );
}
