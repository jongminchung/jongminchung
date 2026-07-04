import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils.js";

const badgeVariants = cva(
  "ds-label inline-flex items-center rounded-full border px-3 py-1 text-[12px]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-on-primary",
        secondary: "border-hairline bg-canvas-elevated text-ink",
        outline: "border-hairline bg-transparent text-body",
        success: "border-transparent bg-cyan-soft text-ink",
        warning: "border-transparent bg-warning-soft text-ink",
        destructive: "border-transparent bg-error text-on-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps extends React.ComponentProps<"div">, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): React.ReactElement {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants, type BadgeProps };
