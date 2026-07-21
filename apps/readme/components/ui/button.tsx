import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border-border bg-card text-card-foreground hover:bg-muted",
        ghost: "border-transparent bg-transparent hover:bg-muted hover:text-foreground",
        outline: "border-border bg-background text-foreground hover:bg-muted",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4",
        lg: "h-11 px-5",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
  readonly children?: ReactNode;
  readonly ref?: Ref<HTMLButtonElement>;
}

export function Button({
  asChild = false,
  children,
  className,
  size,
  variant,
  ...props
}: ButtonProps): ReactNode {
  const classes = cn(buttonVariants({ size, variant }), className);
  if (asChild) {
    if (!isValidElement(children))
      throw new Error("Button with asChild requires one React element.");
    return (
      <ButtonPrimitive className={classes} nativeButton={false} render={children} {...props} />
    );
  }
  return (
    <ButtonPrimitive className={classes} {...props}>
      {children}
    </ButtonPrimitive>
  );
}
