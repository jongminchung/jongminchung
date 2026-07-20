import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
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
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          asChild
          onEscapeKeyDown={(event: { preventDefault: () => void }) => {
            if (purpose === "required") event.preventDefault();
          }}
          onPointerDownOutside={(event: { preventDefault: () => void }) => {
            if (purpose !== "info") event.preventDefault();
          }}
        >
          <div className="fixed left-1/2 top-1/2 z-[121] -translate-x-1/2 -translate-y-1/2">
            {content}
          </div>
        </DialogPrimitive.Content>
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
