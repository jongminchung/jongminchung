import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

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
  ...props
}: DialogProps): ReactNode {
  const contentStyle: CSSProperties =
    variant === "fullscreen"
      ? { inset: 0, height: "100vh", maxHeight: "100vh", width: "100vw" }
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
        variant === "fullscreen" ? "rounded-none" : "rounded-lg",
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
    <DialogPrimitive.Root
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
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-[1px] data-ending-style:animate-out data-starting-style:animate-in data-ending-style:fade-out-0 data-starting-style:fade-in-0" />
        <DialogPrimitive.Popup
          aria-describedby={undefined}
          render={
            <div className="fixed left-1/2 top-1/2 z-[121] -translate-x-1/2 -translate-y-1/2" />
          }
        >
          {content}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
        <DialogPrimitive.Title className="m-0 truncate text-sm font-semibold">
          {title}
        </DialogPrimitive.Title>
        {subtitle ? (
          <DialogPrimitive.Description className="m-0 truncate text-[11px] text-muted-foreground">
            {subtitle}
          </DialogPrimitive.Description>
        ) : null}
      </div>
      {onOpenChange ? (
        <button
          aria-label="Close"
          className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/55"
          onClick={() => onOpenChange(false)}
          type="button"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </header>
  );
}
