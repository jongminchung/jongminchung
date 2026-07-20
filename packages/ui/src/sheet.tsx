"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./utils";

export function Sheet({ open, ...props }: ComponentProps<typeof SheetPrimitive.Root>): ReactNode {
  return <SheetPrimitive.Root open={open} {...props} />;
}
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;

export function SheetContent({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Popup>): ReactNode {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <SheetPrimitive.Popup
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col border-r border-border bg-background text-foreground shadow-xl outline-none",
          className,
        )}
        {...props}
      />
    </SheetPrimitive.Portal>
  );
}
