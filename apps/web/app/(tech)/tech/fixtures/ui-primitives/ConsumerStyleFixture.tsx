"use client";

import { Button } from "@jongminchung/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@jongminchung/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jongminchung/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@jongminchung/ui/components/sheet";
import { cn } from "@jongminchung/ui/lib/utils";

/** 소비자의 공개 className과 semantic utility 병합을 실제 CSS에서 확인함. */
export function ConsumerStyleFixture() {
  return (
    <section className="grid gap-3" aria-label="Consumer style contracts">
      <p
        data-token-example="metadata"
        className={cn(
          "text-base tracking-normal text-foreground",
          "text-metadata tracking-metadata",
        )}
      >
        Metadata
      </p>
      <p
        data-token-example="caption"
        className={cn("text-metadata text-muted-foreground", "text-caption")}
      >
        Caption
      </p>
      <Dialog>
        <DialogTrigger render={<Button />}>Open custom dialog</DialogTrigger>
        <DialogContent
          className="max-w-72 gap-6 rounded-md p-6 sm:max-w-lg"
          closeLabel="Close custom dialog"
          aria-describedby={undefined}
        >
          <DialogTitle>Custom dialog</DialogTitle>
        </DialogContent>
      </Dialog>
      <Sheet>
        <SheetTrigger render={<Button />}>Open custom sheet</SheetTrigger>
        <SheetContent
          className="gap-6 rounded-lg p-6 data-[side=right]:w-64 data-[side=right]:sm:max-w-none"
          closeLabel="Close custom sheet"
          aria-describedby={undefined}
        >
          <SheetTitle>Custom sheet</SheetTitle>
        </SheetContent>
      </Sheet>
      <Select defaultValue="alpha">
        <SelectTrigger
          aria-label="Custom branch"
          className="w-64 rounded-md px-4 text-caption data-[size=default]:h-10"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className="w-64 rounded-md p-2"
          alignItemWithTrigger={false}
        >
          <SelectItem value="alpha">Alpha custom</SelectItem>
          <SelectItem value="beta">Beta custom</SelectItem>
        </SelectContent>
      </Select>
    </section>
  );
}
