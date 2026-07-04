import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils.js";

const buttonVariants = cva(
  "ds-button inline-flex items-center justify-center gap-2 whitespace-nowrap border transition-[background-color,color,border-color,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-on-primary hover:bg-primary-active",
        secondary:
          "border-hairline bg-canvas-elevated text-ink hover:bg-hairline-soft hover:text-ink",
        dark: "border-transparent bg-primary text-on-primary hover:bg-primary-active",
        outline: "border-hairline bg-transparent text-ink hover:bg-hairline-soft",
        ghost: "border-transparent bg-transparent text-body hover:bg-hairline-soft hover:text-ink",
      },
      size: {
        default: "h-10 rounded-full px-[14px] text-[14px]",
        sm: "h-8 rounded-sm px-2 text-[14px]",
        lg: "h-11 rounded-full px-[14px] text-[16px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps): React.ReactElement {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants, type ButtonProps };
