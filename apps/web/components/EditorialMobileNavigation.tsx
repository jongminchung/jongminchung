"use client";

import { Button } from "@jongminchung/ui/components/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@jongminchung/ui/components/sheet";
import { cn } from "@jongminchung/ui/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import type { EditorialNavigationItem } from "./EditorialChrome";
import { Icon } from "./Icon";
import { useHeaderOverlay } from "./useHeaderOverlay";

/** 작은 화면에서 editorial 목적지를 대체 탐색으로 제공함 */
export function EditorialMobileNavigation({
  closeLabel,
  label,
  navigation,
  localeControl,
}: {
  readonly localeControl: ReactNode;
  readonly closeLabel: string;
  readonly label: string;
  readonly navigation: readonly EditorialNavigationItem[];
}) {
  const { open, setOpen, triggerRef, finalFocus } = useHeaderOverlay();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        ref={triggerRef}
        render={
          <Button
            aria-label={label}
            className="size-11 md:hidden"
            size="icon"
            variant="ghost"
          />
        }
      >
        <Icon icon="menu" />
      </SheetTrigger>
      <SheetContent
        className="overflow-hidden"
        finalFocus={finalFocus}
        closeLabel={closeLabel}
        side="right"
      >
        <SheetHeader className="shrink-0 border-b pr-16">
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>
        <nav
          aria-label={label}
          className="grid min-h-0 gap-5 overflow-y-auto overscroll-contain px-4 pb-6"
        >
          {navigation.map((item) => (
            <div className="grid gap-1" key={item.href}>
              <SheetClose
                aria-current={item.isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-3 text-base font-medium transition-colors hover:bg-accent",
                  item.isActive && "bg-secondary text-foreground",
                )}
                render={<Link href={item.href} />}
              >
                {item.label}
              </SheetClose>
              {item.options === undefined ? null : (
                <div className="grid border-l pl-3">
                  {item.options.map((option) => (
                    <SheetClose
                      aria-current={option.isActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        option.isActive &&
                          "bg-secondary font-medium text-foreground",
                      )}
                      key={option.href}
                      render={<Link href={option.href} />}
                    >
                      {option.label}
                    </SheetClose>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div
            className="border-t pt-4"
            onClickCapture={(event) => {
              if (event.target instanceof Element && event.target.closest("a"))
                setOpen(false);
            }}
          >
            {localeControl}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
