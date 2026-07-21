import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
        secondary:
          "border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
        ghost:
          "border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
      },
      size: {
        sm: "h-7 px-2.5",
        md: "h-8 px-3",
        lg: "h-9 px-4",
      },
    },
    defaultVariants: { size: "md", variant: "secondary" },
  },
);

interface ButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "disabled" | "onClick">,
    VariantProps<typeof buttonVariants> {
  readonly label: string;
  readonly isDisabled?: boolean;
  readonly isLoading?: boolean;
  readonly isInterruptible?: boolean;
  readonly clickAction?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  readonly icon?: ReactNode;
  readonly isIconOnly?: boolean;
  readonly children?: ReactNode;
  readonly endContent?: ReactNode;
  readonly tooltip?: string;
  readonly onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className,
  label,
  variant,
  size,
  isDisabled = false,
  isLoading = false,
  isInterruptible = false,
  clickAction,
  icon,
  isIconOnly = false,
  children,
  endContent,
  tooltip,
  onClick,
  type = "button",
  ref,
  ...props
}: ButtonProps): ReactNode {
  const [pending, setPending] = useState(false);
  const loading = isLoading || pending;

  const handleClick = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    onClick?.(event);
    if (event.defaultPrevented || clickAction === undefined) return;
    const result = clickAction(event);
    if (!(result instanceof Promise)) return;
    setPending(true);
    try {
      await result;
    } finally {
      setPending(false);
    }
  };

  return (
    <ButtonPrimitive
      aria-busy={loading || undefined}
      aria-label={isIconOnly ? label : undefined}
      className={cn(
        buttonVariants({ size, variant }),
        isIconOnly && "aspect-square px-0",
        className,
      )}
      disabled={isDisabled || (loading && !isInterruptible)}
      onClick={(event) => void handleClick(event)}
      ref={ref}
      title={tooltip}
      type={type}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : icon}
      {isIconOnly ? null : (children ?? label)}
      {isIconOnly ? null : endContent}
    </ButtonPrimitive>
  );
}

export { buttonVariants };
