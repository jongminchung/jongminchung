"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { useEffect } from "react";
import { cn } from "./utils";

export function Sheet({ open, ...props }: ComponentProps<typeof SheetPrimitive.Root>) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "clip";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [open]);
  return <SheetPrimitive.Root open={open} {...props} />;
}
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;

export function SheetContent({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <SheetPrimitive.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col border-r border-border bg-background text-foreground shadow-xl outline-none",
          className,
        )}
        {...props}
      />
    </SheetPrimitive.Portal>
  );
}
